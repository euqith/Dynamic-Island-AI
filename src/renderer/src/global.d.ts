import { MediaState, NotificationPayload, LyricLine } from '../types';

export interface IElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  onMediaUpdate: (callback: (state: MediaState) => void) => () => void;
  onNotification: (callback: (notification: NotificationPayload) => void) => () => void;
  getMediaState: () => Promise<MediaState>;
  playPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  setDemoMedia: (state: MediaState) => Promise<boolean>;
  getLyrics: (title: string, artist: string) => Promise<LyricLine[]>;
  triggerNotification: (payload: NotificationPayload) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
