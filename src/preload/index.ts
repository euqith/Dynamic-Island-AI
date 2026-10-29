import { contextBridge, ipcRenderer } from 'electron';
import { MediaState, NotificationPayload, SystemHUDEvent } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  onMediaUpdate: (callback: (state: MediaState) => void) => {
    const handler = (_: any, state: MediaState) => callback(state);
    ipcRenderer.on('media:update', handler);
    return () => ipcRenderer.removeListener('media:update', handler);
  },
  onNotification: (callback: (notification: NotificationPayload) => void) => {
    const handler = (_: any, notification: NotificationPayload) => callback(notification);
    ipcRenderer.on('notification:new', handler);
    return () => ipcRenderer.removeListener('notification:new', handler);
  },
  onSystemHUD: (callback: (event: SystemHUDEvent) => void) => {
    const handler = (_: any, event: SystemHUDEvent) => callback(event);
    ipcRenderer.on('system-hud:update', handler);
    return () => ipcRenderer.removeListener('system-hud:update', handler);
  },
  getMediaState: () => ipcRenderer.invoke('media:getState'),
  playPause: () => ipcRenderer.invoke('media:playPause'),
  nextTrack: () => ipcRenderer.invoke('media:next'),
  prevTrack: () => ipcRenderer.invoke('media:previous'),
  setDemoMedia: (state: MediaState) => ipcRenderer.invoke('media:setDemo', state),
  getLyrics: (title: string, artist: string) => ipcRenderer.invoke('lyrics:get', title, artist),
  triggerNotification: (payload: NotificationPayload) => ipcRenderer.invoke('notification:triggerDemo', payload),
  triggerSystemHUD: (event: SystemHUDEvent) => ipcRenderer.invoke('system-hud:triggerDemo', event),
});
