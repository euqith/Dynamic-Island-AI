import { execFile } from 'child_process';
import { promisify } from 'util';
import { MediaState } from '../../../types';
import { WinBridge } from '../platform/winBridge';

const execFileAsync = promisify(execFile);

const JXA_GET_MEDIA_SCRIPT = `(() => {
  try {
    ObjC.import("Foundation");
    const bundle = $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework");
    if (!bundle) return JSON.stringify({ error: "NO_BUNDLE" });
    bundle.load;

    const reqClass = $.NSClassFromString("MRNowPlayingRequest");
    if (!reqClass) return JSON.stringify({ error: "NO_REQ_CLASS" });

    const item = reqClass.localNowPlayingItem;
    if (!item) return JSON.stringify({ error: "NO_ITEM" });

    const meta = item.metadata;
    const dict = item.nowPlayingInfo;

    let title = "";
    let artist = "";
    let album = "";
    let duration = 0;
    let elapsedTime = 0;
    let playbackRate = 0;

    if (meta) {
      title = ObjC.unwrap(meta.title) || "";
      artist = ObjC.unwrap(meta.trackArtistName) || "";
      album = ObjC.unwrap(meta.albumName) || "";
      duration = ObjC.unwrap(meta.duration) || 0;
      elapsedTime = ObjC.unwrap(meta.elapsedTime) || 0;
      playbackRate = ObjC.unwrap(meta.playbackRate) || 0;
    }

    if (!title && dict) {
      try {
        title = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoTitle")) || "";
        artist = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoArtist")) || "";
        album = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoAlbum")) || "";
        duration = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoDuration")) || 0;
        elapsedTime = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoElapsedTime")) || 0;
        playbackRate = ObjC.unwrap(dict.objectForKey("kMRMediaRemoteNowPlayingInfoPlaybackRate")) || 0;
      } catch (e) {}
    }

    let appName = "";
    try {
      const client = reqClass.localNowPlayingPlayerPath.client;
      if (client) appName = ObjC.unwrap(client.displayName) || ObjC.unwrap(client.bundleIdentifier) || "";
    } catch (e) {}

    if (!title && !artist) return JSON.stringify({ error: "EMPTY_CONTENT" });

    return JSON.stringify({
      title: String(title),
      artist: String(artist || appName || "Audio"),
      album: String(album),
      duration: Number(duration) || 0,
      position: Number(elapsedTime) || 0,
      isPlaying: Number(playbackRate) > 0,
      appName: String(appName || "Media")
    });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
})()`;

const JXA_CONTROL_NEXT = `(() => {
  try {
    ObjC.import("Foundation");
    const b = $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework");
    b.load;
    const c = $.NSClassFromString("MRNowPlayingController");
    if (c) {
      c.localRouteController.sendCommandOptionsCompletion(4, $.NSDictionary.alloc.init, null);
      return "OK";
    }
  } catch (e) {}
  return "ERR";
})()`;

const JXA_CONTROL_PREV = `(() => {
  try {
    ObjC.import("Foundation");
    const b = $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework");
    b.load;
    const c = $.NSClassFromString("MRNowPlayingController");
    if (c) {
      c.localRouteController.sendCommandOptionsCompletion(5, $.NSDictionary.alloc.init, null);
      return "OK";
    }
  } catch (e) {}
  return "ERR";
})()`;

export class MediaProvider {
  private lastState: MediaState = {
    title: 'Tidak ada media',
    artist: '',
    album: '',
    coverUrl: '',
    duration: 0,
    position: 0,
    isPlaying: false,
    hasMedia: false,
  };

  private listeners: ((state: MediaState) => void)[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    if (process.platform === 'win32') {
      WinBridge.getInstance().onMedia((state) => {
        this.updateState(state);
      });
    } else {
      this.startPolling();
    }
  }

  public onStateChange(listener: (state: MediaState) => void) {
    this.listeners.push(listener);
    listener(this.lastState);
  }

  public async playPause(): Promise<void> {
    if (process.platform === 'win32') {
      await WinBridge.getInstance().playPause();
      return;
    }

    if (process.platform === 'darwin') {
      const source = (this.lastState.appSource || '').toLowerCase();

      // 1. If currently playing Apple Music, control Apple Music specifically
      if (source.includes('apple music') || (source.includes('music') && !source.includes('youtube') && !source.includes('chrome'))) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Music" to playpause']);
        } catch {}
        this.updateState({ ...this.lastState, isPlaying: !this.lastState.isPlaying });
        return;
      }

      // 2. If currently playing Spotify, control Spotify specifically
      if (source.includes('spotify')) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Spotify" to playpause']);
        } catch {}
        this.updateState({ ...this.lastState, isPlaying: !this.lastState.isPlaying });
        return;
      }

      // 3. For YouTube / Chrome / Browsers / Universal System Media:
      // Reads live playbackRate from MediaRemote directly at click-time:
      // If playing -> sends Command 1 (Pause) ONLY.
      // If paused  -> sends Command 0 (Play) ONLY.
      const jxaToggleScript = `(() => {
        try {
          ObjC.import("Foundation");
          const b = $.NSBundle.bundleWithPath("/System/Library/PrivateFrameworks/MediaRemote.framework");
          b.load;
          const r = $.NSClassFromString("MRNowPlayingRequest");
          const m = r ? r.localNowPlayingItem.metadata : null;
          const isPlaying = m ? (ObjC.unwrap(m.playbackRate) > 0) : false;
          const cmd = isPlaying ? 1 : 0; // 1 = Pause, 0 = Play
          const c = $.NSClassFromString("MRNowPlayingController");
          if (c) {
            c.localRouteController.sendCommandOptionsCompletion(cmd, $.NSDictionary.alloc.init, null);
            return JSON.stringify({ sent: cmd, wasPlaying: isPlaying });
          }
        } catch (e) {
          return JSON.stringify({ error: String(e) });
        }
        return JSON.stringify({ error: "NO_CONTROLLER" });
      })()`;

      try {
        const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', jxaToggleScript]);
        const res = JSON.parse(stdout.trim());
        if (typeof res.wasPlaying === 'boolean') {
          this.updateState({
            ...this.lastState,
            isPlaying: !res.wasPlaying,
          });
          return;
        }
      } catch {}

      // Fallback: direct Chromium video.pause / video.play
      const isCurrentlyPlaying = this.lastState.isPlaying;
      const action = isCurrentlyPlaying ? 'v.pause()' : 'v.play()';
      const browserScript = `
        set browserList to {"Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"}
        repeat with bName in browserList
          try
            tell application "System Events" to set isRunning to exists (processes where name is bName)
            if isRunning then
              tell application bName
                repeat with w in windows
                  repeat with t in tabs of w
                    set u to URL of t
                    if u contains "youtube.com" or u contains "music.youtube.com" or u contains "spotify.com" or u contains "soundcloud.com" then
                      try
                        execute t javascript "const v = document.querySelector('video') || document.querySelector('audio'); if (v) { ${action}; }"
                        return
                      end try
                    end if
                  end repeat
                end repeat
              end tell
            end if
          end try
        end repeat
      `;
      try {
        await execFileAsync('osascript', ['-e', browserScript]);
      } catch {}

      this.updateState({
        ...this.lastState,
        isPlaying: !isCurrentlyPlaying,
      });
    }
  }

  public async next(): Promise<void> {
    if (process.platform === 'win32') {
      await WinBridge.getInstance().next();
      return;
    }

    if (process.platform === 'darwin') {
      const source = (this.lastState.appSource || '').toLowerCase();

      if (source.includes('apple music') || (source.includes('music') && !source.includes('youtube') && !source.includes('chrome'))) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Music" to next track']);
        } catch {}
        return;
      }

      if (source.includes('spotify')) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Spotify" to next track']);
        } catch {}
        return;
      }

      try {
        const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', JXA_CONTROL_NEXT]);
        if (stdout.trim() === 'OK') return;
      } catch {}

      // Browser next button click
      const browserScript = `
        set browserList to {"Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"}
        repeat with bName in browserList
          try
            tell application "System Events" to set isRunning to exists (processes where name is bName)
            if isRunning then
              tell application bName
                repeat with w in windows
                  repeat with t in tabs of w
                    set u to URL of t
                    if u contains "youtube.com" or u contains "music.youtube.com" then
                      try
                        execute t javascript "const b = document.querySelector('.ytp-next-button, .next-button, [aria-label*=\\"Next\\"]'); if (b) b.click();"
                        return
                      end try
                    end if
                  end repeat
                end repeat
              end tell
            end if
          end try
        end repeat
      `;
      try {
        await execFileAsync('osascript', ['-e', browserScript]);
      } catch {}
    }
  }

  public async previous(): Promise<void> {
    if (process.platform === 'win32') {
      await WinBridge.getInstance().previous();
      return;
    }

    if (process.platform === 'darwin') {
      const source = (this.lastState.appSource || '').toLowerCase();

      if (source.includes('apple music') || (source.includes('music') && !source.includes('youtube') && !source.includes('chrome'))) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Music" to previous track']);
        } catch {}
        return;
      }

      if (source.includes('spotify')) {
        try {
          await execFileAsync('osascript', ['-e', 'tell application "Spotify" to previous track']);
        } catch {}
        return;
      }

      try {
        const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', JXA_CONTROL_PREV]);
        if (stdout.trim() === 'OK') return;
      } catch {}

      // Browser prev button click
      const browserScript = `
        set browserList to {"Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"}
        repeat with bName in browserList
          try
            tell application "System Events" to set isRunning to exists (processes where name is bName)
            if isRunning then
              tell application bName
                repeat with w in windows
                  repeat with t in tabs of w
                    set u to URL of t
                    if u contains "youtube.com" or u contains "music.youtube.com" then
                      try
                        execute t javascript "const b = document.querySelector('.previous-button, [aria-label*=\\"Previous\\"]'); if (b) { b.click(); } else { const v = document.querySelector('video'); if (v) v.currentTime = 0; }"
                        return
                      end try
                    end if
                  end repeat
                end repeat
              end tell
            end if
          end try
        end repeat
      `;
      try {
        await execFileAsync('osascript', ['-e', browserScript]);
      } catch {}
    }
  }

  private isPolling = false;

  private startPolling() {
    const loop = async () => {
      await this.poll();
      // Adaptive interval: 1500ms when playing, 3500ms when idle to save battery
      const nextDelay = this.lastState.isPlaying ? 1500 : 3500;
      this.intervalId = setTimeout(loop, nextDelay);
    };
    loop();
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      if (process.platform === 'darwin') {
        const state = await this.pollMacOS();
        if (state) {
          this.updateState(state);
          return;
        }
      }

      // If no media is playing, set idle
      if (this.lastState.hasMedia) {
        this.updateState({
          title: 'Tidak ada media',
          artist: '',
          album: '',
          coverUrl: '',
          duration: 0,
          position: 0,
          isPlaying: false,
          hasMedia: false,
        });
      }
    } catch {
      // safe fallback
    } finally {
      this.isPolling = false;
    }
  }

  private async pollMacOS(): Promise<MediaState | null> {
    // -------------------------------------------------------------
    // 1. UNIVERSAL SYSTEM-WIDE NOW PLAYING (MediaRemote JXA)
    // Works for Chrome, Safari, Edge, Brave, YouTube, YouTube Music,
    // Spotify, Apple Music, VLC, Podcasts, etc.
    // -------------------------------------------------------------
    try {
      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', JXA_GET_MEDIA_SCRIPT]);
      const raw = stdout.trim();
      if (raw && raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        if (!parsed.error && (parsed.title || parsed.artist)) {
          let appSource = parsed.appName || 'Now Playing';
          if (parsed.title.toLowerCase().includes('youtube') || appSource.toLowerCase().includes('chrome')) {
            appSource = 'YouTube / Chrome';
          }

          return {
            title: parsed.title || 'Media Video/Audio',
            artist: parsed.artist || appSource,
            album: parsed.album || '',
            coverUrl: '',
            duration: parsed.duration || 0,
            position: parsed.position || 0,
            isPlaying: parsed.isPlaying,
            hasMedia: true,
            appSource,
          };
        }
      }
    } catch {}

    // -------------------------------------------------------------
    // 2. APPLE MUSIC
    // -------------------------------------------------------------
    try {
      const musicCheck = await execFileAsync('osascript', ['-e', 'tell application "Music" to get player state 2>/dev/null || echo "NOT_RUNNING"']);
      const musicState = musicCheck.stdout.trim();
      if (musicState === 'playing' || musicState === 'paused') {
        const musicData = await execFileAsync('osascript', ['-e', 'tell application "Music" to return (name of current track & "|||" & artist of current track & "|||" & album of current track & "|||" & (duration of current track as string) & "|||" & (player position as string))']);
        const output = musicData.stdout.trim();
        if (output && output.includes('|||')) {
          const [title, artist, album, durStr, posStr] = output.split('|||');
          return {
            title: title || 'Apple Music Track',
            artist: artist || 'Apple Music',
            album: album || '',
            coverUrl: '',
            duration: parseFloat(durStr.replace(',', '.')) || 0,
            position: parseFloat(posStr.replace(',', '.')) || 0,
            isPlaying: musicState === 'playing',
            hasMedia: true,
            appSource: 'Apple Music',
          };
        }
      }
    } catch {}

    // -------------------------------------------------------------
    // 3. SPOTIFY
    // -------------------------------------------------------------
    try {
      const spotifyCheck = await execFileAsync('osascript', ['-e', 'tell application "Spotify" to get player state 2>/dev/null || echo "NOT_RUNNING"']);
      const spotifyState = spotifyCheck.stdout.trim();
      if (spotifyState === 'playing' || spotifyState === 'paused') {
        const spotifyData = await execFileAsync('osascript', ['-e', 'tell application "Spotify" to return (name of current track & "|||" & artist of current track & "|||" & album of current track & "|||" & ((duration of current track) / 1000 as string) & "|||" & (player position as string) & "|||" & artwork url of current track)']);
        const output = spotifyData.stdout.trim();
        if (output && output.includes('|||')) {
          const [title, artist, album, durStr, posStr, coverUrl] = output.split('|||');
          return {
            title: title || 'Spotify Track',
            artist: artist || 'Spotify',
            album: album || '',
            coverUrl: coverUrl || '',
            duration: parseFloat(durStr.replace(',', '.')) || 0,
            position: parseFloat(posStr.replace(',', '.')) || 0,
            isPlaying: spotifyState === 'playing',
            hasMedia: true,
            appSource: 'Spotify',
          };
        }
      }
    } catch {}

    return null;
  }

  private updateState(newState: MediaState) {
    this.lastState = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }

  public getState(): MediaState {
    return this.lastState;
  }

  public setDemoMedia(state: MediaState) {
    this.updateState(state);
  }
}
