import { exec } from 'child_process';
import { promisify } from 'util';
import { MediaState } from '../../../types';

const execAsync = promisify(exec);

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
  private currentSource: 'spotify' | 'music' | 'chrome_youtube' | 'safari_youtube' | 'none' = 'none';

  constructor() {
    this.startPolling();
  }

  public onStateChange(listener: (state: MediaState) => void) {
    this.listeners.push(listener);
    listener(this.lastState);
  }

  public async playPause(): Promise<void> {
    if (process.platform === 'darwin') {
      if (this.currentSource === 'chrome_youtube') {
        try {
          const script = `
            tell application "Google Chrome"
              repeat with w in windows
                repeat with t in tabs of w
                  if URL of t contains "youtube.com/watch" or URL of t contains "music.youtube.com" then
                    execute t javascript "const v = document.querySelector('video'); if (v) { v.paused ? v.play() : v.pause(); }"
                    return
                  end if
                end repeat
              end repeat
            end tell
          `;
          await execAsync(`osascript -e '${script}'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'spotify') {
        try {
          await execAsync(`osascript -e 'tell application "Spotify" to playpause'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'music') {
        try {
          await execAsync(`osascript -e 'tell application "Music" to playpause'`);
          return;
        } catch {}
      }
    }
  }

  public async next(): Promise<void> {
    if (process.platform === 'darwin') {
      if (this.currentSource === 'chrome_youtube') {
        try {
          const script = `
            tell application "Google Chrome"
              repeat with w in windows
                repeat with t in tabs of w
                  if URL of t contains "youtube.com/watch" then
                    execute t javascript "const btn = document.querySelector('.ytp-next-button'); if (btn) btn.click();"
                    return
                  end if
                end repeat
              end repeat
            end tell
          `;
          await execAsync(`osascript -e '${script}'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'spotify') {
        try {
          await execAsync(`osascript -e 'tell application "Spotify" to next track'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'music') {
        try {
          await execAsync(`osascript -e 'tell application "Music" to next track'`);
          return;
        } catch {}
      }
    }
  }

  public async previous(): Promise<void> {
    if (process.platform === 'darwin') {
      if (this.currentSource === 'chrome_youtube') {
        try {
          const script = `
            tell application "Google Chrome"
              repeat with w in windows
                repeat with t in tabs of w
                  if URL of t contains "youtube.com/watch" then
                    execute t javascript "const v = document.querySelector('video'); if (v) v.currentTime = 0;"
                    return
                  end if
                end repeat
              end repeat
            end tell
          `;
          await execAsync(`osascript -e '${script}'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'spotify') {
        try {
          await execAsync(`osascript -e 'tell application "Spotify" to previous track'`);
          return;
        } catch {}
      }

      if (this.currentSource === 'music') {
        try {
          await execAsync(`osascript -e 'tell application "Music" to previous track'`);
          return;
        } catch {}
      }
    }
  }

  private startPolling() {
    this.poll();
    this.intervalId = setInterval(() => {
      this.poll();
    }, 1500);
  }

  private async poll() {
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
        this.currentSource = 'none';
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
    }
  }

  private async pollMacOS(): Promise<MediaState | null> {
    // 1. Try Google Chrome (YouTube / YouTube Music / Spotify Web)
    try {
      const chromeScript = `
        tell application "Google Chrome"
          repeat with w in windows
            repeat with t in tabs of w
              set tabUrl to URL of t
              if tabUrl contains "youtube.com/watch" or tabUrl contains "music.youtube.com" or tabUrl contains "open.spotify.com" or tabUrl contains "soundcloud.com" then
                set tabTitle to title of t
                try
                  set isP to execute t javascript "document.querySelector('video') ? !document.querySelector('video').paused : (document.querySelector('audio') ? !document.querySelector('audio').paused : false);"
                  set curT to execute t javascript "document.querySelector('video') ? document.querySelector('video').currentTime : (document.querySelector('audio') ? document.querySelector('audio').currentTime : 0);"
                  set durT to execute t javascript "document.querySelector('video') ? document.querySelector('video').duration : (document.querySelector('audio') ? document.querySelector('audio').duration : 0);"
                  set art to execute t javascript "(document.querySelector('meta[property=\\"og:image\\"]') ? document.querySelector('meta[property=\\"og:image\\"]').content : '')"
                  return (tabTitle & "|||" & tabUrl & "|||" & isP & "|||" & curT & "|||" & durT & "|||" & art)
                on error
                  return (tabTitle & "|||" & tabUrl & "|||false|||0|||0|||")
                end try
              end if
            end repeat
          end repeat
        end tell
        return "NO_CHROME_MEDIA"
      `;
      const { stdout } = await execAsync(`osascript -e '${chromeScript}'`);
      const output = stdout.trim();
      if (output && output !== 'NO_CHROME_MEDIA' && output.includes('|||')) {
        const [rawTitle, tabUrl, isPlayingStr, posStr, durStr, coverUrl] = output.split('|||');
        
        // Clean YouTube title: "Artist - Title - YouTube"
        let title = rawTitle.replace(/ - YouTube$/, '').trim();
        let artist = 'YouTube';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        const duration = parseFloat(durStr.replace(',', '.')) || 0;
        const position = parseFloat(posStr.replace(',', '.')) || 0;
        const isPlaying = isPlayingStr === 'true';

        this.currentSource = 'chrome_youtube';
        return {
          title: title || 'YouTube Video',
          artist: artist || 'YouTube',
          album: 'Browser Media',
          coverUrl: coverUrl || '',
          duration,
          position,
          isPlaying,
          hasMedia: true,
          appSource: 'Google Chrome',
        };
      }
    } catch {}

    // 2. Try Apple Music
    try {
      const musicCheck = await execAsync(`osascript -e 'tell application "Music" to get player state' 2>/dev/null || echo "NOT_RUNNING"`);
      const musicState = musicCheck.stdout.trim();
      if (musicState === 'playing' || musicState === 'paused') {
        const musicData = await execAsync(`osascript -e 'tell application "Music" to return (name of current track & "|||" & artist of current track & "|||" & album of current track & "|||" & (duration of current track as string) & "|||" & (player position as string))'`);
        const output = musicData.stdout.trim();
        if (output && output.includes('|||')) {
          const [title, artist, album, durStr, posStr] = output.split('|||');
          this.currentSource = 'music';
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

    // 3. Try Spotify
    try {
      const spotifyCheck = await execAsync(`osascript -e 'tell application "Spotify" to get player state' 2>/dev/null || echo "NOT_RUNNING"`);
      const spotifyState = spotifyCheck.stdout.trim();
      if (spotifyState === 'playing' || spotifyState === 'paused') {
        const spotifyData = await execAsync(`osascript -e 'tell application "Spotify" to return (name of current track & "|||" & artist of current track & "|||" & album of current track & "|||" & ((duration of current track) / 1000 as string) & "|||" & (player position as string) & "|||" & artwork url of current track)'`);
        const output = spotifyData.stdout.trim();
        if (output && output.includes('|||')) {
          const [title, artist, album, durStr, posStr, coverUrl] = output.split('|||');
          this.currentSource = 'spotify';
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
