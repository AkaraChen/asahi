import type {
  DesktopSelectTabRequest,
  DesktopTabsSnapshot,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';

declare global {
  interface Window {
    asahi: {
      closeViewerTab(id: string): Promise<void>;
      getApiAccessToken(): Promise<{ header: string; token: string }>;
      getApiBaseURL(): Promise<string>;
      getViewerTabRequest(id: string): Promise<DesktopViewerTabRequest | null>;
      onDesktopTabsChanged(
        callback: (snapshot: DesktopTabsSnapshot) => void
      ): () => void;
      openViewerTab(request: DesktopViewerTabRequest): Promise<void>;
      selectDesktopTab(request: DesktopSelectTabRequest): Promise<void>;
    };
  }
}
