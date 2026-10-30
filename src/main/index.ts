delete process.env.ELECTRON_RUN_AS_NODE;

import { app, BrowserWindow, screen, ipcMain, shell } from 'electron';
import path from 'path';
import { MediaProvider } from './services/media/mediaProvider';
import { LyricsService } from './services/lyrics/lyricsService';
import { NotificationProvider } from './services/notification/notificationProvider';
import { SystemEventProvider } from './services/system/systemEventProvider';
import { WinBridge } from './services/platform/winBridge';
import { MediaState, NotificationPayload, SystemHUDEvent } from '../types';

let mainWindow: BrowserWindow | null = null;
let isHovered = false;
let currentHitbox = { width: 260, height: 40 };
let cursorInterval: NodeJS.Timeout | null = null;
const mediaProvider = new MediaProvider();
const lyricsService = new LyricsService();
const notificationProvider = new NotificationProvider();
const systemEventProvider = new SystemEventProvider();

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;

  // Window width: 960px (wide enough to guarantee expanded 480px and lyrics 740px are never clipped)
  const winWidth = 960;
  const winHeight = 320;
  const xPos = Math.round(bounds.x + (bounds.width - winWidth) / 2);
  const yPos = bounds.y; // Absolute physical top of display (y: 0 on primary)

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
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    enableLargerThanScreen: true,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // macOS level for screen-saver / pop-up level above top menu bar dock
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    // Explicitly set bounds to absolute top (yPos), bypassing macOS menu bar snap
    mainWindow.setBounds({ x: xPos, y: yPos, width: winWidth, height: winHeight }, false);
    mainWindow.once('ready-to-show', () => {
      mainWindow?.setBounds({ x: xPos, y: yPos, width: winWidth, height: winHeight }, false);
    });
  } else {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // Handle display changes / resolution scaling
  const repositionWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const currentDisplay = screen.getPrimaryDisplay();
    const curBounds = currentDisplay.bounds;
    const newX = Math.round(curBounds.x + (curBounds.width - winWidth) / 2);
    const newY = curBounds.y;
    mainWindow.setBounds({ x: newX, y: newY, width: winWidth, height: winHeight }, false);
  };

  screen.on('display-metrics-changed', repositionWindow);
  screen.on('display-added', repositionWindow);
  screen.on('display-removed', repositionWindow);

  // Mouse event pass-through handling:
  // When idle/collapsed, clicks outside the notch pill pass through to desktop/apps behind it.
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Windows & Cross-platform cursor hit-testing for reliable click-through
  if (cursorInterval) clearInterval(cursorInterval);
  cursorInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const winBounds = mainWindow.getBounds();

    const notchLeft = winBounds.x + (winBounds.width - currentHitbox.width) / 2;
    const notchRight = notchLeft + currentHitbox.width;
    const notchTop = winBounds.y;
    const notchBottom = notchTop + currentHitbox.height + 6;

    const inside = cursor.x >= notchLeft && cursor.x <= notchRight && cursor.y >= notchTop && cursor.y <= notchBottom;

    if (inside && !isHovered) {
      isHovered = true;
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.webContents.send('notch:hover-state', true);
    } else if (!inside && isHovered) {
      isHovered = false;
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      mainWindow.webContents.send('notch:hover-state', false);
    }
  }, 75);

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

  // Broadcast System HUD events (Volume, Charging, Bluetooth)
  systemEventProvider.onHUDEvent((hudEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-hud:update', hudEvent);
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

ipcMain.on('update-hitbox', (_, size: { width: number; height: number; expanded: boolean }) => {
  currentHitbox = size;
  if (!size.expanded && !isHovered && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
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

ipcMain.handle('system-hud:triggerDemo', async (_, event: SystemHUDEvent) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system-hud:update', event);
  }
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (cursorInterval) {
    clearInterval(cursorInterval);
    cursorInterval = null;
  }
  if (process.platform === 'win32') {
    WinBridge.getInstance().stop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
