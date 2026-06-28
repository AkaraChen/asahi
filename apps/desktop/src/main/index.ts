import {
  DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER,
  startDiffApiServer,
  type DiffApiServer,
} from '@asahi/server/node';
import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  type WebContents,
} from 'electron';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getGitHubAuthToken } from './githubAuth';
import { installDesktopCliPath } from './cliPath';
import {
  DESKTOP_CLOSE_VIEWER_TAB_CHANNEL,
  DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL,
  DESKTOP_HOME_TAB_ID,
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  DESKTOP_SELECT_TAB_CHANNEL,
  DESKTOP_TAB_BAR_HEIGHT,
  getViewerTabPath,
} from '../shared/desktopTabs';
import type {
  DesktopSelectTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';

const currentDir = dirname(fileURLToPath(import.meta.url));
installDesktopCliPath();

const diffApiAccessToken = randomBytes(32).toString('base64url');
let diffServerPromise: Promise<DiffApiServer> | undefined;
const viewerTabs = new Map<string, WebContentsView>();
const viewerTabRequests = new Map<string, DesktopViewerTabRequest>();
let mainWindow: BrowserWindow | undefined;
let activeTabId = DESKTOP_HOME_TAB_ID;

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

function getDiffServer(): Promise<DiffApiServer> {
  diffServerPromise ??= startDiffApiServer({
    accessToken: diffApiAccessToken,
    getGitHubAuthToken,
  });
  return diffServerPromise;
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: '#101010',
    height: 960,
    minHeight: 640,
    minWidth: 900,
    show: false,
    title: 'Asahi',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDir, '../preload/index.cjs'),
      sandbox: true,
    },
    width: 1440,
  });

  prepareWebContents(mainWindow.webContents);
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  mainWindow.on('resize', layoutActiveViewerTab);
  mainWindow.on('closed', () => {
    viewerTabs.clear();
    viewerTabRequests.clear();
    mainWindow = undefined;
    activeTabId = DESKTOP_HOME_TAB_ID;
  });

  const devRendererURL = import.meta.env.DEV
    ? process.env.ELECTRON_RENDERER_URL
    : undefined;
  if (devRendererURL != null) {
    void mainWindow.loadURL(devRendererURL);
    return;
  }

  void mainWindow.loadFile(join(currentDir, '../renderer/index.html'));
}

function openViewerTab(request: DesktopViewerTabRequest): void {
  viewerTabRequests.set(request.id, request);
  const tab = viewerTabs.get(request.id) ?? createViewerTab(request);
  viewerTabs.set(request.id, tab);
  selectTab(request.id);
}

function createViewerTab(request: DesktopViewerTabRequest): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(currentDir, '../preload/index.cjs'),
      sandbox: true,
    },
  });
  prepareWebContents(view.webContents);
  const search = new URLSearchParams();
  if (request.title != null && request.title.trim() !== '') {
    search.set('asahi-pr-title', request.title);
  }
  if (
    request.viewerAvatarUrl != null &&
    request.viewerAvatarUrl.trim() !== ''
  ) {
    search.set('asahi-pr-viewer-avatar', request.viewerAvatarUrl);
  }
  const path = `${getViewerTabPath(request)}${
    search.size > 0 ? `?${search.toString()}` : ''
  }`;
  void view.webContents.loadURL(getRendererTabUrl(path));
  return view;
}

function prepareWebContents(webContents: WebContents): void {
  webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  webContents.on('will-navigate', (event, url) => {
    if (!isExternalUrl(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });
  webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
}

function selectTab(id: string): void {
  const window = mainWindow;
  if (window == null) return;

  const activeView = viewerTabs.get(activeTabId);
  if (activeView != null) {
    window.contentView.removeChildView(activeView);
  }

  activeTabId = id;
  const nextView = viewerTabs.get(id);
  if (nextView == null) return;

  window.contentView.addChildView(nextView);
  layoutActiveViewerTab();
}

function closeViewerTab(id: string): void {
  const window = mainWindow;
  const view = viewerTabs.get(id);
  if (window != null && view != null) {
    window.contentView.removeChildView(view);
  }
  viewerTabs.delete(id);
  viewerTabRequests.delete(id);
  if (activeTabId === id) {
    activeTabId = DESKTOP_HOME_TAB_ID;
  }
}

function layoutActiveViewerTab(): void {
  const window = mainWindow;
  const view = viewerTabs.get(activeTabId);
  if (window == null || view == null) return;

  const [width, height] = window.getContentSize();
  view.setBounds({
    x: 0,
    y: DESKTOP_TAB_BAR_HEIGHT,
    width,
    height: Math.max(0, height - DESKTOP_TAB_BAR_HEIGHT),
  });
}

function getRendererTabUrl(path: string): string {
  const hash = `#${path}${path.includes('?') ? '&' : '?'}asahi-tab-content=1`;
  const devRendererURL = import.meta.env.DEV
    ? process.env.ELECTRON_RENDERER_URL
    : undefined;
  if (devRendererURL != null) {
    const url = new URL(devRendererURL);
    url.hash = hash;
    return url.toString();
  }

  return `${pathToFileURL(join(currentDir, '../renderer/index.html')).toString()}${hash}`;
}

ipcMain.handle('asahi:get-api-base-url', async () => {
  const server = await getDiffServer();
  return server.origin;
});

ipcMain.handle('asahi:get-api-access-token', () => ({
  header: DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER,
  token: diffApiAccessToken,
}));

ipcMain.handle(
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  (_event, request: DesktopViewerTabRequest) => openViewerTab(request)
);

ipcMain.handle(
  DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL,
  (_event, id: string) => viewerTabRequests.get(id) ?? null
);

ipcMain.handle(
  DESKTOP_SELECT_TAB_CHANNEL,
  (_event, request: DesktopSelectTabRequest) => selectTab(request.id)
);

ipcMain.handle(DESKTOP_CLOSE_VIEWER_TAB_CHANNEL, (_event, id: string) =>
  closeViewerTab(id)
);

function openExternalUrl(value: string): void {
  if (!isExternalUrl(value)) return;
  void shell.openExternal(value);
}

function isExternalUrl(value: string): boolean {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  const devRendererURL = import.meta.env.DEV
    ? process.env.ELECTRON_RENDERER_URL
    : undefined;
  return (
    devRendererURL == null || url.origin !== new URL(devRendererURL).origin
  );
}

void app.whenReady().then(() => {
  if (!singleInstanceLock) return;
  createMainWindow();

  app.on('activate', () => {
    if (mainWindow != null) {
      mainWindow.show();
      mainWindow.focus();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow == null) {
    createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

app.on('before-quit', () => {
  void diffServerPromise?.then((server) => server.close());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
