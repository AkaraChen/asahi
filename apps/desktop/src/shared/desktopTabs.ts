export const DESKTOP_OPEN_VIEWER_TAB_CHANNEL = 'asahi:open-viewer-tab';
export const DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL =
  'asahi:get-viewer-tab-request';
export const DESKTOP_SELECT_TAB_CHANNEL = 'asahi:select-tab';
export const DESKTOP_CLOSE_VIEWER_TAB_CHANNEL = 'asahi:close-viewer-tab';
export const DESKTOP_TABS_CHANGED_CHANNEL = 'asahi:tabs-changed';

export const DESKTOP_HOME_TAB_ID = 'home';
export const DESKTOP_TAB_BAR_HEIGHT = 36;

export interface DesktopViewerPrTabRequest {
  id: string;
  type: 'pr';
  owner: string;
  repo: string;
  number: number;
  body?: string;
  title?: string;
  viewerAvatarUrl?: string;
}

export type DesktopViewerTabRequest = DesktopViewerPrTabRequest;

export interface DesktopSelectTabRequest {
  id: string;
}

export interface DesktopTabsSnapshot {
  activeTabId: string;
  tabs: DesktopViewerTabRequest[];
}

export function getViewerTabPath(tab: DesktopViewerTabRequest): string {
  switch (tab.type) {
    case 'pr':
      return `/${tab.owner}/${tab.repo}/pull/${tab.number}`;
    default:
      throw new Error(`Unsupported tab type: ${tab.type}`);
  }
}
