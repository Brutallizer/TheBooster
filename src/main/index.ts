// ============================================
// Electron Main Process
// ============================================
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import log from 'electron-log';
import { getDatabase, closeDatabase } from './database/connection';
import { registerProfileHandlers } from './ipc/profiles';
import { registerProxyHandlers } from './ipc/proxies';
import { registerAuthHandlers } from './ipc/auth';
import { registerWorkspaceHandlers } from './ipc/workspaces';
import { registerAnalyticsHandlers } from './ipc/analytics';
import { registerAutomationHandlers } from './ipc/automation';
import { initFirebaseAdmin } from './firebase-admin';
import { closeAllBrowsers } from './browser/engine';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'MultiAccount Manager',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#8b5cf6',
      height: 36,
    },
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  log.info('[App] Starting MultiAccount Manager...');

  // Initialize database
  getDatabase();

  // Initialize Firebase Admin SDK
  initFirebaseAdmin();

  // Register IPC handlers
  registerProfileHandlers();
  registerProxyHandlers();
  registerAuthHandlers();
  registerWorkspaceHandlers();
  registerAnalyticsHandlers();
  registerAutomationHandlers();

  // App info handlers
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:profilesPath', () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'profiles');
  });

  // Window control handlers
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  log.info('[App] All windows closed. Cleaning up...');
  await closeAllBrowsers();
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  log.info('[App] Quitting...');
  await closeAllBrowsers();
  closeDatabase();
});
