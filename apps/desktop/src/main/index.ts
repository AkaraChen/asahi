import {
  DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER,
  startDiffApiServer,
  type DiffApiServer,
} from '@asahi/server/node';
import { app, BrowserWindow, WebContentsView, ipcMain, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getGitHubAuthToken } from './githubAuth';
import {
  listGitHubOwnerRepositories,
  listGitHubPullRequestsForRepositories,
  listGitHubRepositoryOwners,
} from './githubPullRequests';
import {
  LIST_OWNER_REPOSITORIES_CHANNEL,
  LIST_REPOSITORY_OWNERS_CHANNEL,
  LIST_REPOSITORY_PULL_REQUESTS_CHANNEL,
} from '../shared/githubPullRequests';
import type {
  DesktopListOwnerRepositoriesRequest,
  DesktopListPullRequestsRequest,
} from '../shared/githubPullRequests';
import {
  DESKTOP_CLOSE_VIEWER_TAB_CHANNEL,
  DESKTOP_HOME_TAB_ID,
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  DESKTOP_SELECT_TAB_CHANNEL,
  DESKTOP_TAB_BAR_HEIGHT,
} from '../shared/desktopTabs';
import type {
  DesktopSelectTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const diffApiAccessToken = randomBytes(32).toString('base64url');
let diffServerPromise: Promise<DiffApiServer> | undefined;
const viewerTabs = new Map<string, WebContentsView>();
let mainWindow: BrowserWindow | undefined;
let activeTabId = DESKTOP_HOME_TAB_ID;

function getDiffServer(): Promise<DiffApiServer> {
  diffServerPromise ??= startDiffApiServer({
    accessToken: diffApiAccessToken,
    getGitHubAuthToken,
  });
  return diffServerPromise;
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
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
  mainWindow.on('resize', layoutActiveViewerTab);
  mainWindow.on('closed', () => {
    viewerTabs.clear();
    mainWindow = undefined;
    activeTabId = DESKTOP_HOME_TAB_ID;
  });

  const devRendererURL = import.meta.env.DEV ? process.env.ELECTRON_RENDERER_URL : undefined;
  if (devRendererURL != null) {
    void mainWindow.loadURL(devRendererURL);
    return;
  }

  void mainWindow.loadFile(join(currentDir, '../renderer/index.html'));
}

function openViewerTab(request: DesktopViewerTabRequest): void {
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
  view.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  void view.webContents.loadURL(getRendererTabUrl(request.path));
  return view;
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
  const devRendererURL = import.meta.env.DEV ? process.env.ELECTRON_RENDERER_URL : undefined;
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

ipcMain.handle(LIST_REPOSITORY_OWNERS_CHANNEL, () =>
  listGitHubRepositoryOwners()
);

ipcMain.handle(
  LIST_OWNER_REPOSITORIES_CHANNEL,
  (_event, request: DesktopListOwnerRepositoriesRequest) =>
    listGitHubOwnerRepositories(request)
);

ipcMain.handle(
  LIST_REPOSITORY_PULL_REQUESTS_CHANNEL,
  (_event, request: DesktopListPullRequestsRequest) =>
    listGitHubPullRequestsForRepositories(request)
);

ipcMain.handle(
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  (_event, request: DesktopViewerTabRequest) => openViewerTab(request)
);

ipcMain.handle(
  DESKTOP_SELECT_TAB_CHANNEL,
  (_event, request: DesktopSelectTabRequest) => selectTab(request.id)
);

ipcMain.handle(DESKTOP_CLOSE_VIEWER_TAB_CHANNEL, (_event, id: string) =>
  closeViewerTab(id)
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
