export const DESKTOP_OPEN_VIEWER_TAB_CHANNEL = 'asahi:open-viewer-tab';
export const DESKTOP_SELECT_TAB_CHANNEL = 'asahi:select-tab';
export const DESKTOP_CLOSE_VIEWER_TAB_CHANNEL = 'asahi:close-viewer-tab';

export const DESKTOP_HOME_TAB_ID = 'home';
export const DESKTOP_TAB_BAR_HEIGHT = 40;

export interface DesktopViewerTabRequest {
  id: string;
  path: string;
  title: string;
}

export interface DesktopSelectTabRequest {
  id: string;
}
