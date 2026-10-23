import { app, BrowserWindow, screen, ipcMain, shell } from 'electron';
import path from 'path';
import { MediaProvider } from './services/media/mediaProvider';
import { LyricsService } from './services/lyrics/lyricsService';
import { NotificationProvider } from './services/notification/notificationProvider';
import { MediaState, NotificationPayload } from '../types';

let mainWindow: BrowserWindow | null = null;
const mediaProvider = new MediaProvider();
const lyricsService = new LyricsService();
const notificationProvider = new NotificationProvider();

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  // Initial window width: wide enough for expanded island/lyrics (800px), height: 320px
  const winWidth = 840;
  const winHeight = 320;
  const xPos = Math.round((width - winWidth) / 2);
  const yPos = 0;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: xPos,
    y: yPos,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // macOS level for screen-saver level always-on-top
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // Mouse event pass-through handling:
  // When idle/collapsed, clicks outside the notch pill pass through to desktop/apps behind it.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load URL
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Security: Prevent navigation to untrusted pages
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Broadcast media updates
  mediaProvider.onStateChange((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('media:update', state);
    }
  });

  // Broadcast notifications
  notificationProvider.onNotification((notification) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification:new', notification);
    }
  });
}

// IPC Handlers
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.handle('media:getState', async () => {
  return mediaProvider.getState();
});

ipcMain.handle('media:playPause', async () => {
  return mediaProvider.playPause();
});

ipcMain.handle('media:next', async () => {
  return mediaProvider.next();
});

ipcMain.handle('media:previous', async () => {
  return mediaProvider.previous();
});

ipcMain.handle('media:setDemo', async (_, state: MediaState) => {
  mediaProvider.setDemoMedia(state);
  return true;
});

ipcMain.handle('lyrics:get', async (_, title: string, artist: string) => {
  return lyricsService.getLyrics(title, artist);
});

ipcMain.handle('notification:triggerDemo', async (_, payload: NotificationPayload) => {
  notificationProvider.emitNotification(payload);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
