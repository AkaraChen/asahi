import type {
  DesktopSelectTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';

export {};

declare global {
  interface Window {
    asahi: {
      closeViewerTab(id: string): Promise<void>;
      getApiAccessToken(): Promise<{ header: string; token: string }>;
      getApiBaseURL(): Promise<string>;
      getViewerTabRequest(
        id: string
      ): Promise<DesktopViewerTabRequest | null>;
      openViewerTab(request: DesktopViewerTabRequest): Promise<void>;
      selectDesktopTab(request: DesktopSelectTabRequest): Promise<void>;
    };
  }
}
