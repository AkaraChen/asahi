import { startDiffApiServer, type DiffApiServer } from '@asahi/server/node';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGitHubAuthToken } from './githubAuth';
import { listGitHubPullRequestNotifications } from './githubNotifications';
import {
  LIST_GITHUB_PULL_REQUEST_NOTIFICATIONS_CHANNEL,
} from '../shared/githubNotifications';

const currentDir = dirname(fileURLToPath(import.meta.url));
let diffServerPromise: Promise<DiffApiServer> | undefined;

function getDiffServer(): Promise<DiffApiServer> {
  diffServerPromise ??= startDiffApiServer({ getGitHubAuthToken });
  return diffServerPromise;
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    backgroundColor: '#101010',
    height: 960,
    minHeight: 640,
    minWidth: 900,
    title: 'Asahi',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDir, '../preload/index.cjs'),
      sandbox: true,
    },
    width: 1440,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devRendererURL = import.meta.env.DEV ? process.env.ELECTRON_RENDERER_URL : undefined;
  if (devRendererURL != null) {
    void mainWindow.loadURL(devRendererURL);
    return;
  }

  void mainWindow.loadFile(join(currentDir, '../renderer/index.html'));
}

ipcMain.handle('asahi:get-api-base-url', async () => {
  const server = await getDiffServer();
  return server.origin;
});

ipcMain.handle(LIST_GITHUB_PULL_REQUEST_NOTIFICATIONS_CHANNEL, () =>
  listGitHubPullRequestNotifications()
);

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  void diffServerPromise?.then((server) => server.close());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
