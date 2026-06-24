import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DESKTOP_HOME_TAB_ID } from '../shared/desktopTabs';
import type { DesktopViewerTabRequest } from '../shared/desktopTabs';

interface DesktopTabState {
  activeTabId: string;
  tabs: DesktopViewerTabRequest[];
  closeTab(id: string): string;
  openTab(tab: DesktopViewerTabRequest): void;
  selectTab(id: string): void;
}

export const useDesktopTabStore = create<DesktopTabState>()(
  persist(
    (set, get) => ({
      activeTabId: DESKTOP_HOME_TAB_ID,
      tabs: [],
      closeTab(id) {
        const { activeTabId, tabs } = get();
        const index = tabs.findIndex((tab) => tab.id === id);
        const nextTabs = tabs.filter((tab) => tab.id !== id);
        const nextActiveTabId =
          activeTabId === id
            ? nextTabs[Math.min(index, nextTabs.length - 1)]?.id ??
              DESKTOP_HOME_TAB_ID
            : activeTabId;

        set({ activeTabId: nextActiveTabId, tabs: nextTabs });
        return nextActiveTabId;
      },
      openTab(tab) {
        set((state) => ({
          activeTabId: tab.id,
          tabs: state.tabs.some((item) => item.id === tab.id)
            ? state.tabs.map((item) =>
                item.id === tab.id
                  ? {
                      ...item,
                      body: tab.body ?? item.body,
                      title: tab.title ?? item.title,
                      viewerAvatarUrl:
                        tab.viewerAvatarUrl ?? item.viewerAvatarUrl,
                    }
                  : item
              )
            : [...state.tabs, tab],
        }));
      },
      selectTab(id) {
        set((state) => ({
          activeTabId:
            id === DESKTOP_HOME_TAB_ID ||
            state.tabs.some((tab) => tab.id === id)
              ? id
              : DESKTOP_HOME_TAB_ID,
        }));
      },
    }),
    {
      name: 'asahi:desktop-tabs',
      partialize: ({ activeTabId, tabs }) => ({
        activeTabId,
        tabs,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
