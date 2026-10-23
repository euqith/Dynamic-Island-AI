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

  constructor() {
    this.startPolling();
  }

  public onStateChange(listener: (state: MediaState) => void) {
    this.listeners.push(listener);
    listener(this.lastState);
  }

  public async playPause(): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        await execAsync(`osascript -e 'tell application "Spotify" to playpause'`);
      } catch {
        try {
          await execAsync(`osascript -e 'tell application "Music" to playpause'`);
        } catch {}
      }
    }
  }

  public async next(): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        await execAsync(`osascript -e 'tell application "Spotify" to next track'`);
      } catch {
        try {
          await execAsync(`osascript -e 'tell application "Music" to next track'`);
        } catch {}
      }
    }
  }

  public async previous(): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        await execAsync(`osascript -e 'tell application "Spotify" to previous track'`);
      } catch {
        try {
          await execAsync(`osascript -e 'tell application "Music" to previous track'`);
        } catch {}
      }
    }
  }

  private startPolling() {
    this.poll();
    this.intervalId = setInterval(() => {
      this.poll();
    }, 1200);
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
      
      // Fallback: If no native player running, report idle or retain mock if active
      if (!this.lastState.hasMedia) {
        // default idle
      }
    } catch {
      // safe fallback
    }
  }

  private async pollMacOS(): Promise<MediaState | null> {
    // 1. Try Spotify
    try {
      const spotifyScript = `
        if application "Spotify" is running then
          tell application "Spotify"
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackDuration to (duration of current track) / 1000
            set playerPos to player position
            set playerState to player state as string
            set artUrl to artwork url of current track
            return trackName & "|||" & artistName & "|||" & albumName & "|||" & trackDuration & "|||" & playerPos & "|||" & playerState & "|||" & artUrl
          end tell
        else
          return "NOT_RUNNING"
        end if
      `;
      const { stdout } = await execAsync(`osascript -e '${spotifyScript}'`);
      const output = stdout.trim();
      if (output && output !== 'NOT_RUNNING' && output.includes('|||')) {
        const [title, artist, album, durationStr, posStr, playerState, coverUrl] = output.split('|||');
        return {
          title: title || 'Lagu Aktif',
          artist: artist || '',
          album: album || '',
          coverUrl: coverUrl || '',
          duration: parseFloat(durationStr) || 180,
          position: parseFloat(posStr) || 0,
          isPlaying: playerState === 'playing',
          hasMedia: true,
          appSource: 'Spotify',
        };
      }
    } catch {}

    // 2. Try Apple Music
    try {
      const musicScript = `
        if application "Music" is running then
          tell application "Music"
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackDuration to duration of current track
            set playerPos to player position
            set playerState to player state as string
            return trackName & "|||" & artistName & "|||" & albumName & "|||" & trackDuration & "|||" & playerPos & "|||" & playerState
          end tell
        else
          return "NOT_RUNNING"
        end if
      `;
      const { stdout } = await execAsync(`osascript -e '${musicScript}'`);
      const output = stdout.trim();
      if (output && output !== 'NOT_RUNNING' && output.includes('|||')) {
        const [title, artist, album, durationStr, posStr, playerState] = output.split('|||');
        return {
          title: title || 'Lagu Apple Music',
          artist: artist || '',
          album: album || '',
          coverUrl: '',
          duration: parseFloat(durationStr) || 180,
          position: parseFloat(posStr) || 0,
          isPlaying: playerState === 'playing',
          hasMedia: true,
          appSource: 'Apple Music',
        };
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
