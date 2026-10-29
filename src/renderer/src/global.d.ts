import { MediaState, NotificationPayload, LyricLine, SystemHUDEvent } from '../types';

export interface IElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  onMediaUpdate: (callback: (state: MediaState) => void) => () => void;
  onNotification: (callback: (notification: NotificationPayload) => void) => () => void;
  onSystemHUD: (callback: (event: SystemHUDEvent) => void) => () => void;
  getMediaState: () => Promise<MediaState>;
  playPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  setDemoMedia: (state: MediaState) => Promise<boolean>;
  getLyrics: (title: string, artist: string) => Promise<LyricLine[]>;
  triggerNotification: (payload: NotificationPayload) => Promise<boolean>;
  triggerSystemHUD: (event: SystemHUDEvent) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
