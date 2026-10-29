import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { NotificationPayload } from '../../../types';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export class NotificationProvider {
  private listeners: ((notification: NotificationPayload) => void)[] = [];
  private webhookServer: http.Server | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastDeliveredDate: number = 0;
  private recentNotificationHashes: Set<string> = new Set();
  private dbPath: string | null = null;
  private isChecking: boolean = false;
  private isDbAccessible: boolean = true;

  constructor() {
    this.initDatabasePath();
    this.startWatcher();
    this.startLocalWebhookServer();
  }

  public onNotification(listener: (notification: NotificationPayload) => void) {
    this.listeners.push(listener);
  }

  public emitNotification(payload: NotificationPayload) {
    const hash = `${payload.appName}_${payload.title}_${payload.body}`;
    if (this.recentNotificationHashes.has(hash)) {
      return; // Deduplicate
    }
    this.recentNotificationHashes.add(hash);
    setTimeout(() => {
      this.recentNotificationHashes.delete(hash);
    }, 15000);

    const safePayload: NotificationPayload = {
      ...payload,
      title: this.sanitize(payload.title),
      body: this.sanitize(payload.body),
      appName: this.sanitize(payload.appName),
    };

    for (const listener of this.listeners) {
      listener(safePayload);
    }
  }

  private sanitize(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private initDatabasePath() {
    if (process.platform !== 'darwin') return;

    // Check modern macOS usernoted db path
    const modernPath = path.join(
      os.homedir(),
      'Library/Group Containers/group.com.apple.usernoted/db2/db'
    );
    if (fs.existsSync(modernPath)) {
      this.dbPath = modernPath;
      return;
    }

    // Try finding Darwin user cache path
    try {
      exec('getconf DARWIN_USER_DIR', (err, stdout) => {
        if (!err && stdout.trim()) {
          const darwinPath = path.join(stdout.trim(), 'com.apple.notificationcenter/db/db');
          if (fs.existsSync(darwinPath)) {
            this.dbPath = darwinPath;
          }
        }
      });
    } catch {}
  }

  private startWatcher() {
    if (process.platform !== 'darwin') return;

    // Initial check
    this.checkAllNotificationSources();

    // 2500ms polling interval: highly responsive, never misses banners (which stay 5-7s),
    // and drastically conserves battery compared to aggressive 1s polling.
    this.pollingInterval = setInterval(() => {
      this.checkAllNotificationSources();
    }, 2500);
  }

  private async checkAllNotificationSources() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      await this.checkActiveNotificationBanners();
      if (this.isDbAccessible && this.dbPath) {
        await this.checkUsernotedDatabase();
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Source 1: Active NotificationCenter Banner Windows via JXA
   * Captures live banners as they pop up on macOS without misidentifying system apps as WhatsApp.
   */
  private async checkActiveNotificationBanners() {
    try {
      const jxaScript = `
        (function() {
          var se = Application("System Events");
          if (!se.processes.byName("NotificationCenter").exists()) return "[]";
          var nc = se.processes.byName("NotificationCenter");
          var wins = nc.windows();
          var notifs = [];

          for (var i = 0; i < wins.length; i++) {
            var win = wins[i];
            try {
              var subrole = "";
              try { subrole = win.subrole(); } catch(e){}
              var desc = "";
              try { desc = win.description(); } catch(e){}
              
              // Only scan actual banner notification dialogs
              if (subrole === "AXSystemDialog" || desc === "system dialog") {
                var texts = [];
                function findTexts(el, depth) {
                  if (depth > 6) return;
                  try {
                    var children = el.uiElements();
                    for (var j = 0; j < children.length; j++) {
                      var child = children[j];
                      var role = "";
                      try { role = child.role(); } catch(e){}
                      if (role === "AXStaticText") {
                        var val = "";
                        try { val = child.value(); } catch(e){}
                        if (val && typeof val === "string") {
                          var trimmed = val.trim();
                          if (trimmed.length > 0) texts.push(trimmed);
                        }
                      } else {
                        findTexts(child, depth + 1);
                      }
                    }
                  } catch(e) {}
                }
                findTexts(win, 0);

                if (texts.length >= 2) {
                  notifs.push(texts);

                  // Dismiss the native macOS banner so it is replaced by Dynamic Island
                  try {
                    var actions = win.actions();
                    for (var a = 0; a < actions.length; a++) {
                      if (actions[a].name() === "AXCancel") {
                        actions[a].perform();
                        break;
                      }
                    }
                  } catch(e) {}

                  try {
                    function closeButton(el, depth) {
                      if (depth > 4) return false;
                      try {
                        var children = el.uiElements();
                        for (var c = 0; c < children.length; c++) {
                          var ch = children[c];
                          var role = "";
                          try { role = ch.role(); } catch(e){}
                          var sub = "";
                          try { sub = ch.subrole(); } catch(e){}
                          var desc = "";
                          try { desc = (ch.description() || "").toLowerCase(); } catch(e){}
                          if (role === "AXButton" && (sub === "AXCloseButton" || desc.indexOf("close") !== -1 || desc.indexOf("tutup") !== -1)) {
                            try { ch.actions().byName("AXPress").perform(); return true; } catch(e){}
                          }
                          if (closeButton(ch, depth + 1)) return true;
                        }
                      } catch(e){}
                      return false;
                    }
                    closeButton(win, 0);
                  } catch(e) {}
                }
              }
            } catch(e) {}
          }
          return JSON.stringify(notifs);
        })()
      `;

      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', jxaScript]);
      const raw = stdout.trim();
      if (!raw || raw === '[]') return;

      const items: string[][] = JSON.parse(raw);
      const timeRegex = /^(now|sekarang|\d+\s*(m|min|mnt|s|detik|hr|jam)\s*(ago|lalu)?|\d{1,2}:\d{2}(\s*(AM|PM))?)$/i;

      for (const textList of items) {
        // Filter out relative time stamps (e.g. "now", "1m ago", "10:30")
        const filtered = textList.filter((t) => !timeRegex.test(t.trim()));
        if (filtered.length < 2) continue;

        let appName = 'Notification';
        let title = '';
        let body = '';

        if (filtered.length >= 3) {
          appName = filtered[0];
          title = filtered[1];
          body = filtered.slice(2).join(' - ');
        } else {
          // 2 elements: [App/Title, Body]
          appName = filtered[0];
          title = filtered[0];
          body = filtered[1];
        }

        const formattedApp = this.formatBundleId(appName);

        this.emitNotification({
          id: Date.now().toString(),
          appName: formattedApp,
          title: title || `Notifikasi ${formattedApp}`,
          body: body || 'Pesan baru diterima',
          timestamp: Date.now(),
        });
      }
    } catch {}
  }

  /**
   * Source 2: macOS Notification Center SQLite Database (usernoted)
   * Captures notifications when Full Disk Access is available.
   */
  private async checkUsernotedDatabase() {
    if (!this.dbPath) return;

    try {
      const sqlQuery = `SELECT app.identifier, record.delivered_date, hex(record.data) FROM app INNER JOIN record ON app.app_id = record.app_id ORDER BY record.delivered_date DESC LIMIT 3;`;
      const { stdout } = await execAsync(`/usr/bin/sqlite3 -readonly "${this.dbPath}" "${sqlQuery}"`);
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        if (!line.includes('|')) continue;
        const [bundleId, deliveredStr, hexData] = line.split('|');
        const deliveredDate = parseFloat(deliveredStr) || 0;

        if (this.lastDeliveredDate === 0) {
          this.lastDeliveredDate = deliveredDate;
          break;
        }

        if (deliveredDate > this.lastDeliveredDate) {
          this.lastDeliveredDate = deliveredDate;

          const { title, body } = this.parseStringsFromHex(hexData);
          const appName = this.formatBundleId(bundleId);

          if (title || body) {
            this.emitNotification({
              id: deliveredDate.toString(),
              appName,
              title: title || `Pesan baru di ${appName}`,
              body: body || 'Notifikasi baru diterima',
              timestamp: Date.now(),
            });
          }
        }
      }
    } catch (err: any) {
      // If TCC sandbox blocks sqlite access, mark inaccessible so we don't waste battery querying repeatedly
      if (err?.message?.includes('authorization denied') || err?.message?.includes('not permitted')) {
        this.isDbAccessible = false;
      }
    }
  }

  private parseStringsFromHex(hex: string): { title: string; body: string } {
    try {
      const buf = Buffer.from(hex, 'hex');
      const text = buf.toString('utf-8');

      const matches = text.match(/[A-Za-z0-9\u00C0-\u024F\u4e00-\u9fa5\s.,!?:;'\-_]{2,}/g) || [];
      const filtered = matches
        .map((m) => m.trim())
        .filter((m) => m.length > 1 && !m.startsWith('bplist') && !m.startsWith('NS') && !m.startsWith('req') && !m.startsWith('tit'));

      const title = filtered[0] || '';
      const body = filtered.slice(1, 3).join(' ') || '';

      return { title, body };
    } catch {
      return { title: '', body: '' };
    }
  }

  private formatBundleId(bundleId: string): string {
    const lower = bundleId.toLowerCase();
    if (lower.includes('whatsapp')) return 'WhatsApp';
    if (lower.includes('telegram')) return 'Telegram';
    if (lower.includes('discord')) return 'Discord';
    if (lower.includes('outlook')) return 'Outlook';
    if (lower.includes('mail')) return 'Mail';
    if (lower.includes('slack')) return 'Slack';
    if (lower.includes('github')) return 'GitHub';
    if (lower.includes('chrome')) return 'Chrome';
    if (lower.includes('safari')) return 'Safari';
    if (lower.includes('finder')) return 'Finder';
    if (lower.includes('terminal') || lower.includes('iterm')) return 'Terminal';
    if (lower.includes('setting') || lower.includes('preference')) return 'System Settings';
    if (lower.includes('mobilesms') || lower.includes('message')) return 'Messages';
    if (lower.includes('calendar')) return 'Calendar';
    if (lower.includes('music')) return 'Music';

    const parts = bundleId.split('.');
    return parts[parts.length - 1] || bundleId;
  }

  /**
   * Source 3: Local Webhook & HTTP Endpoint
   */
  private startLocalWebhookServer() {
    try {
      this.webhookServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === 'POST' && req.url === '/notify') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.title || data.body) {
                this.emitNotification({
                  id: Date.now().toString(),
                  appName: data.appName || 'WhatsApp',
                  avatarUrl: data.avatarUrl || data.photoUrl || '',
                  title: data.title || 'Notifikasi Baru',
                  body: data.body || '',
                  timestamp: Date.now(),
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', sent: true }));
                return;
              }
            } catch {}
            res.writeHead(400);
            res.end('Invalid JSON');
          });
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Dynamic Island Notification Webhook Service Active on port 19898');
      });

      this.webhookServer.listen(19898, '127.0.0.1');
      this.webhookServer.on('error', () => {});
    } catch {}
  }

  public destroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.webhookServer) this.webhookServer.close();
  }
}
