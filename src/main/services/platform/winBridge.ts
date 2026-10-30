import { spawn, execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { promisify } from 'util';
import { MediaState, NotificationPayload, SystemHUDEvent } from '../../../types';

const execFileAsync = promisify(execFile);

const EMBEDDED_WIN_BRIDGE_SCRIPT = `# PowerShell Native Bridge for Dynamic Island AI (Windows 10 / 11)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Windows.Forms

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
})[0]

Function Await($WinRtTask, $ResultType) {
    if ($WinRtTask -eq $null) { return $null }
    try {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(2000) | Out-Null
        return $netTask.Result
    } catch {
        return $null
    }
}

try {
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
} catch {}

try {
    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI, ContentType = WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.NotificationKinds, Windows.UI, ContentType = WindowsRuntime] | Out-Null
} catch {}

$mgr = $null
try {
    $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {}

$listener = $null
$hasNotifAccess = $false
try {
    $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
    if ($listener) {
        $access = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
        $hasNotifAccess = ($access -eq [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed)
    }
} catch {}

[Console]::Out.WriteLine('{"type":"status","data":"ready"}')
[Console]::Out.Flush()

$seenNotifIds = [System.Collections.Generic.HashSet[uint32]]::new()

if ($hasNotifAccess -and $listener) {
    try {
        $existing = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
        if ($existing) {
            foreach ($n in $existing) {
                $seenNotifIds.Add($n.Id) | Out-Null
            }
        }
    } catch {}
}

$lastMediaHash = ""
$lastBatteryHash = ""
$tick = 0

while ($true) {
    # 0. Re-acquire manager if needed
    if (-not $mgr) {
        try {
            $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
        } catch {}
    }

    # 1. Check Media Session
    $isPlaying = $false
    if ($mgr) {
        try {
            $session = $mgr.GetCurrentSession()
            if (-not $session) {
                try {
                    $allSessions = $mgr.GetSessions()
                    if ($allSessions -and $allSessions.Count -gt 0) {
                        foreach ($s in $allSessions) {
                            $pInfo = $s.GetPlaybackInfo()
                            if ($pInfo -and [int]$pInfo.PlaybackStatus -eq 4) {
                                $session = $s
                                break
                            }
                        }
                        if (-not $session) {
                            $session = $allSessions[0]
                        }
                    }
                } catch {}
            }

            if ($session) {
                $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                $info = $session.GetPlaybackInfo()
                $timeline = $session.GetTimelineProperties()

                $title = if ($props -and $props.Title) { $props.Title } else { "" }
                $artist = if ($props -and $props.Artist) { $props.Artist } else { "" }
                $album = if ($props -and $props.AlbumTitle) { $props.AlbumTitle } else { "" }
                $appSource = $session.SourceAppUserModelId
                if (-not $appSource) { $appSource = "Now Playing" }
                
                if ($appSource -like "*Chrome*") { $appSource = "Chrome / YouTube" }
                elseif ($appSource -like "*msedge*") { $appSource = "Edge" }
                elseif ($appSource -like "*Spotify*") { $appSource = "Spotify" }
                elseif ($appSource -like "*Firefox*") { $appSource = "Firefox" }

                $statusVal = if ($info) { [int]$info.PlaybackStatus } else { 0 }
                $isPlaying = ($statusVal -eq 4)
                
                $pos = 0
                $dur = 0
                if ($timeline) {
                    $dur = [math]::Round($timeline.EndTime.TotalSeconds, 1)
                    $basePos = $timeline.Position.TotalSeconds
                    $elapsed = 0
                    if ($isPlaying -and $timeline.LastUpdatedTime) {
                        try {
                            $diff = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime).TotalSeconds
                            if ($diff -gt 0) { $elapsed = $diff }
                        } catch {}
                    }
                    $calcPos = $basePos + $elapsed
                    if ($dur -gt 0 -and $calcPos -gt $dur) {
                        $calcPos = $dur
                    }
                    $pos = [math]::Round($calcPos, 1)
                }

                $mediaHash = "$title|$artist|$album|$isPlaying|$pos|$dur|$appSource"
                if ($mediaHash -ne $lastMediaHash) {
                    $lastMediaHash = $mediaHash
                    $mediaObj = [PSCustomObject]@{
                        title = if ($title) { $title } else { "Media Audio/Video" }
                        artist = if ($artist) { $artist } else { $appSource }
                        album = $album
                        coverUrl = ""
                        duration = $dur
                        position = $pos
                        isPlaying = $isPlaying
                        hasMedia = $true
                        appSource = $appSource
                    }
                    $json = [PSCustomObject]@{
                        type = "media"
                        data = $mediaObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            } else {
                if ($lastMediaHash -ne "NO_MEDIA") {
                    $lastMediaHash = "NO_MEDIA"
                    $noMediaObj = [PSCustomObject]@{
                        title = "Tidak ada media"
                        artist = ""
                        album = ""
                        coverUrl = ""
                        duration = 0
                        position = 0
                        isPlaying = $false
                        hasMedia = $false
                        appSource = ""
                    }
                    $json = [PSCustomObject]@{
                        type = "media"
                        data = $noMediaObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            }
        } catch {}
    }

    # 2. Check Notifications
    if (-not $listener -or -not $hasNotifAccess) {
        if ($tick % 5 -eq 0) {
            try {
                $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
                if ($listener) {
                    $access = Await ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
                    $hasNotifAccess = ($access -eq [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed)
                }
            } catch {}
        }
    }

    if ($hasNotifAccess -and $listener) {
        try {
            $notifs = Await ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
            if ($notifs) {
                foreach ($n in $notifs) {
                    if (-not $seenNotifIds.Contains($n.Id)) {
                        $seenNotifIds.Add($n.Id) | Out-Null
                        $bindings = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                        $nTitle = ""
                        $nBody = ""
                        if ($bindings) {
                            $texts = @($bindings.GetTextElements() | ForEach-Object { $_.Text })
                            if ($texts.Count -gt 0) { $nTitle = $texts[0] }
                            if ($texts.Count -gt 1) { $nBody = ($texts[1..($texts.Count - 1)] -join " ") }
                        }
                        
                        $appName = $n.AppInfo.DisplayInfo.DisplayName
                        if (-not $appName) { $appName = "System" }

                        $notifObj = [PSCustomObject]@{
                            id = [string]$n.Id
                            appName = $appName
                            title = $nTitle
                            body = $nBody
                            timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                        }
                        $json = [PSCustomObject]@{
                            type = "notification"
                            data = $notifObj
                        } | ConvertTo-Json -Compress
                        [Console]::Out.WriteLine($json)
                        [Console]::Out.Flush()
                    }
                }
            }
        } catch {}
    }

    # 3. Check Battery
    if ($tick % 3 -eq 0) {
        try {
            $power = [System.Windows.Forms.SystemInformation]::PowerStatus
            if ($power) {
                $pct = [int]($power.BatteryLifePercent * 100)
                $isCharging = ($power.PowerLineStatus -eq "Online")
                $batHash = "$pct|$isCharging"
                if ($batHash -ne $lastBatteryHash) {
                    $lastBatteryHash = $batHash
                    $batObj = [PSCustomObject]@{
                        type = "charging"
                        batteryPercent = $pct
                        isCharging = $isCharging
                        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                    }
                    $json = [PSCustomObject]@{
                        type = "hud"
                        data = $batObj
                    } | ConvertTo-Json -Compress
                    [Console]::Out.WriteLine($json)
                    [Console]::Out.Flush()
                }
            }
        } catch {}
    }

    $tick++
    $sleepDuration = if ($isPlaying) { 1000 } else { 2500 }
    Start-Sleep -Milliseconds $sleepDuration
}
`;

export class WinBridge {
  private static instance: WinBridge | null = null;
  private child: ChildProcess | null = null;
  private scriptPath: string | null = null;
  private isShuttingDown: boolean = false;
  private buffer: string = '';

  private mediaListeners: ((state: MediaState) => void)[] = [];
  private notifListeners: ((notif: NotificationPayload) => void)[] = [];
  private hudListeners: ((event: SystemHUDEvent) => void)[] = [];

  private lastMediaState: MediaState = {
    title: 'Tidak ada media',
    artist: '',
    album: '',
    coverUrl: '',
    duration: 0,
    position: 0,
    isPlaying: false,
    hasMedia: false,
  };

  public static getInstance(): WinBridge {
    if (!WinBridge.instance) {
      WinBridge.instance = new WinBridge();
    }
    return WinBridge.instance;
  }

  private constructor() {
    if (process.platform === 'win32') {
      this.initScriptPath();
      this.startProcess();
    }
  }

  private initScriptPath() {
    try {
      // 1. In development, try to run directly from disk if unpackaged
      if (!app.isPackaged) {
        const localPath = path.join(__dirname, 'winBridge.ps1');
        if (fs.existsSync(localPath)) {
          this.scriptPath = localPath;
          return;
        }
        const srcPath = path.join(app.getAppPath(), 'src/main/services/platform/winBridge.ps1');
        if (fs.existsSync(srcPath)) {
          this.scriptPath = srcPath;
          return;
        }
      }

      // 2. In packaged production app:
      // powershell.exe cannot execute a file inside an asar archive!
      // Check if asarUnpack extracted it into app.asar.unpacked
      const unpackedPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'winBridge.ps1');
      if (fs.existsSync(unpackedPath)) {
        this.scriptPath = unpackedPath;
        console.log('[WinBridge] Found unpacked script at:', this.scriptPath);
        return;
      }

      // 3. Guaranteed real filesystem fallback: write into app userData directory
      const userDataDir = app.getPath('userData');
      const targetPath = path.join(userDataDir, 'winBridge.ps1');

      let scriptContent = '';
      const localAsarPath = path.join(__dirname, 'winBridge.ps1');
      if (fs.existsSync(localAsarPath)) {
        try {
          scriptContent = fs.readFileSync(localAsarPath, 'utf-8');
        } catch {}
      }
      if (!scriptContent) {
        scriptContent = EMBEDDED_WIN_BRIDGE_SCRIPT;
      }

      fs.writeFileSync(targetPath, scriptContent, 'utf-8');
      this.scriptPath = targetPath;
      console.log('[WinBridge] Extracted script to userData:', this.scriptPath);
    } catch (err) {
      console.error('[WinBridge] Failed to init script path:', err);
      this.scriptPath = path.join(app.getPath('userData'), 'winBridge.ps1');
    }
  }

  private startProcess() {
    if (!this.scriptPath || this.isShuttingDown) return;

    try {
      this.child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.scriptPath
      ], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.child.stdout?.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('{')) continue;
          try {
            const parsed = JSON.parse(trimmed);
            this.handleEvent(parsed);
          } catch {}
        }
      });

      this.child.stderr?.on('data', (chunk: Buffer) => {
        console.error('[WinBridge PowerShell stderr]:', chunk.toString('utf-8'));
      });

      this.child.on('exit', (code) => {
        console.log('[WinBridge] Process exited with code:', code);
        this.child = null;
        if (!this.isShuttingDown) {
          setTimeout(() => this.startProcess(), 3000);
        }
      });
    } catch (err) {
      console.error('Failed to spawn Windows native bridge:', err);
    }
  }

  private handleEvent(event: { type: string; data: any }) {
    if (event.type === 'media') {
      this.lastMediaState = event.data as MediaState;
      for (const listener of this.mediaListeners) {
        listener(this.lastMediaState);
      }
    } else if (event.type === 'notification') {
      for (const listener of this.notifListeners) {
        listener(event.data as NotificationPayload);
      }
    } else if (event.type === 'hud') {
      for (const listener of this.hudListeners) {
        listener(event.data as SystemHUDEvent);
      }
    }
  }

  public onMedia(listener: (state: MediaState) => void) {
    this.mediaListeners.push(listener);
    listener(this.lastMediaState);
  }

  public onNotification(listener: (notif: NotificationPayload) => void) {
    this.notifListeners.push(listener);
  }

  public onHUD(listener: (event: SystemHUDEvent) => void) {
    this.hudListeners.push(listener);
  }

  public getLastMediaState(): MediaState {
    return this.lastMediaState;
  }

  public async playPause(): Promise<void> {
    const cmd = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
      Function Await($t, $r) { $at = $asTaskGeneric.MakeGenericMethod($r); $nt = $at.Invoke($null, @($t)); $nt.Wait(1500) | Out-Null; return $nt.Result }
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
      $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
      if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if (-not $session) {
          $all = $mgr.GetSessions()
          if ($all -and $all.Count -gt 0) { $session = $all[0] }
        }
        if ($session) { Await ($session.TryTogglePlayPauseAsync()) ([bool]) | Out-Null }
      }
    `;
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
    } catch {}
  }

  public async next(): Promise<void> {
    const cmd = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
      Function Await($t, $r) { $at = $asTaskGeneric.MakeGenericMethod($r); $nt = $at.Invoke($null, @($t)); $nt.Wait(1500) | Out-Null; return $nt.Result }
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
      $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
      if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if (-not $session) {
          $all = $mgr.GetSessions()
          if ($all -and $all.Count -gt 0) { $session = $all[0] }
        }
        if ($session) { Await ($session.TrySkipNextAsync()) ([bool]) | Out-Null }
      }
    `;
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
    } catch {}
  }

  public async previous(): Promise<void> {
    const cmd = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
      Function Await($t, $r) { $at = $asTaskGeneric.MakeGenericMethod($r); $nt = $at.Invoke($null, @($t)); $nt.Wait(1500) | Out-Null; return $nt.Result }
      [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
      $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
      if ($mgr) {
        $session = $mgr.GetCurrentSession()
        if (-not $session) {
          $all = $mgr.GetSessions()
          if ($all -and $all.Count -gt 0) { $session = $all[0] }
        }
        if ($session) { Await ($session.TrySkipPreviousAsync()) ([bool]) | Out-Null }
      }
    `;
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true });
    } catch {}
  }

  public stop() {
    this.isShuttingDown = true;
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}
