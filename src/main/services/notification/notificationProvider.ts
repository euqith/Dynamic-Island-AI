import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NotificationPayload } from '../../../types';

const execAsync = promisify(exec);

export class NotificationProvider {
  private listeners: ((notification: NotificationPayload) => void)[] = [];
  private lastDockBadges: Map<string, string> = new Map();
  private webhookServer: http.Server | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startDockBadgeWatcher();
    this.startLocalWebhookServer();
  }

  public onNotification(listener: (notification: NotificationPayload) => void) {
    this.listeners.push(listener);
  }

  public emitNotification(payload: NotificationPayload) {
    // Sanitize string content against XSS
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

  /**
   * Watches macOS Dock badges (e.g. WhatsApp, Telegram, Discord, Outlook, Mail).
   * When a new badge number appears or increases, trigger an instant notification on Dynamic Island!
   */
  private startDockBadgeWatcher() {
    if (process.platform !== 'darwin') return;

    this.checkDockBadges();
    this.pollingInterval = setInterval(() => {
      this.checkDockBadges();
    }, 2000);
  }

  private async checkDockBadges() {
    try {
      const script = `
        tell application "System Events" to tell process "Dock"
          set badgeList to {}
          repeat with dockItem in (UI elements of list 1)
            try
              set badgeVal to value of attribute "AXStatusLabel" of dockItem
              if badgeVal is not missing value then
                set itemName to name of dockItem
                set end of badgeList to (itemName & "|||" & badgeVal)
              end if
            end try
          end repeat
          return badgeList
        end tell
      `;
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const lines = stdout.trim().split(', ');
      
      for (const line of lines) {
        if (!line.includes('|||')) continue;
        const [appName, badge] = line.split('|||');
        const prevBadge = this.lastDockBadges.get(appName);

        if (prevBadge === undefined) {
          // Initial recording
          this.lastDockBadges.set(appName, badge);
        } else if (prevBadge !== badge) {
          // Badge changed or increased!
          this.lastDockBadges.set(appName, badge);
          this.emitNotification({
            id: Date.now().toString(),
            appName: appName,
            title: `Pesan baru di ${appName}`,
            body: `${badge} pesan belum terbaca`,
            timestamp: Date.now(),
          });
        }
      }
    } catch {}
  }

  /**
   * Local Webhook & HTTP Endpoint: Allows external webhooks, browser extensions,
   * or curl scripts to push real-time notifications to the Island.
   * Example: curl -X POST http://localhost:19898/notify -H "Content-Type: application/json" -d '{"appName":"WhatsApp","title":"Budi","body":"Halo bro!"}'
   */
  private startLocalWebhookServer() {
    try {
      this.webhookServer = http.createServer((req, res) => {
        // Enable CORS
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

      this.webhookServer.listen(19898, '127.0.0.1', () => {
        // Webhook server running
      });

      this.webhookServer.on('error', () => {
        // Port already in use or fallback
      });
    } catch {}
  }

  public destroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.webhookServer) this.webhookServer.close();
  }
}
