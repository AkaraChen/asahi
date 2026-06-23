import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewUI } from '@asahi/app/components/review-ui';
import {
  PreloadHighlighter,
  ScrollbarGutterVariables,
  ThemeProvider,
  Toaster,
  WorkerPoolContext,
} from '@asahi/app/layout';
import { resolveDiffshubViewerRoute } from '@asahi/app/lib/resolve-viewer-route';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DESKTOP_HOME_TAB_ID,
  DESKTOP_TAB_BAR_HEIGHT,
} from '../shared/desktopTabs';
import type { DesktopViewerTabRequest } from '../shared/desktopTabs';
import { DesktopHomePage } from './DesktopHomePage';
import { navigateDesktop } from './navigation';

const queryClient = new QueryClient();

interface DesktopLocation {
  domain?: string;
  href: string;
  pathSegments: string[];
  routeKey: string;
  tabContent: boolean;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkerPoolContext>
        <ThemeProvider attribute="class">
          <ScrollbarGutterVariables />
          <DesktopRouter />
          <Toaster />
        </ThemeProvider>
        <PreloadHighlighter />
      </WorkerPoolContext>
    </QueryClientProvider>
  );
}

function DesktopRouter() {
  const location = useDesktopLocation();

  if (location.tabContent) {
    return <DesktopViewer location={location} />;
  }

  return <DesktopTabShell location={location} />;
}

function DesktopTabShell({ location }: { location: DesktopLocation }) {
  const [tabs, setTabs] = useState<DesktopViewerTabRequest[]>([]);
  const [activeTabId, setActiveTabId] = useState(DESKTOP_HOME_TAB_ID);

  const openViewerTab = useCallback(
    (tab: DesktopViewerTabRequest) => {
      setTabs((current) =>
        current.some((item) => item.id === tab.id) ? current : [...current, tab]
      );
      setActiveTabId(tab.id);
      void window.asahi.openViewerTab(tab);
    },
    []
  );

  useEffect(() => {
    void window.asahi.selectDesktopTab({ id: DESKTOP_HOME_TAB_ID });
  }, []);

  useEffect(() => {
    if (location.pathSegments.length === 0) return;

    openViewerTab({
      id: location.href,
      path: location.href,
      title: location.pathSegments.at(-1) ?? location.href,
    });
    navigateDesktop('/', { replace: true });
  }, [location.href, location.routeKey, openViewerTab]);

  function selectTab(id: string) {
    setActiveTabId(id);
    void window.asahi.selectDesktopTab({ id });
  }

  function closeTab(id: string) {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const nextTabs = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) {
        const nextActive =
          nextTabs[Math.min(index, nextTabs.length - 1)]?.id ??
          DESKTOP_HOME_TAB_ID;
        setActiveTabId(nextActive);
        void window.asahi.selectDesktopTab({ id: nextActive });
      }
      void window.asahi.closeViewerTab(id);
      return nextTabs;
    });
  }

  return (
    <main
      className="bg-[var(--diffshub-sidebar-bg)] text-foreground grid h-dvh min-h-0 overflow-hidden"
      style={{
        gridTemplateRows: `${DESKTOP_TAB_BAR_HEIGHT}px minmax(0, 1fr)`,
      }}
    >
      <div className="border-border-opaque flex min-w-0 items-end gap-1 overflow-x-auto border-b px-2 pt-1">
        <HomeTabButton
          active={activeTabId === DESKTOP_HOME_TAB_ID}
          onClick={() => selectTab(DESKTOP_HOME_TAB_ID)}
        />
        {tabs.map((tab) => (
          <TabButton
            active={activeTabId === tab.id}
            key={tab.id}
            label={tab.title}
            onClick={() => selectTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </div>
      <div className="min-h-0 overflow-hidden">
        {activeTabId === DESKTOP_HOME_TAB_ID && (
          <DesktopHomePage onOpenViewerTab={openViewerTab} />
        )}
      </div>
    </main>
  );
}

function HomeTabButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Home"
      className={
        active
          ? 'bg-background border-border text-foreground flex h-8 w-9 shrink-0 items-center justify-center rounded-t-md border border-b-0'
          : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground flex h-8 w-9 shrink-0 items-center justify-center rounded-t-md transition-colors'
      }
      onClick={onClick}
    >
      <HomeIcon />
    </button>
  );
}

function TabButton({
  active,
  label,
  onClick,
  onClose,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className={
        active
          ? 'bg-background border-border flex h-8 min-w-36 max-w-56 items-center gap-1 rounded-t-md border border-b-0 px-2 text-sm'
          : 'hover:bg-accent/60 text-muted-foreground flex h-8 min-w-36 max-w-56 items-center gap-1 rounded-t-md px-2 text-sm transition-colors'
      }
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left"
        onClick={onClick}
      >
        {label}
      </button>
      {onClose != null && (
        <button
          type="button"
          aria-label={`Close ${label}`}
          className="hover:bg-accent flex size-5 shrink-0 items-center justify-center rounded-sm"
          onClick={onClose}
        >
          <TabCloseIcon />
        </button>
      )}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m3 10.5 9-7 9 7M5 9v11h14V9M10 20v-6h4v6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TabCloseIcon() {
  return (
    <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DesktopViewer({ location }: { location: DesktopLocation }) {
  const route = useMemo(
    () => resolveDiffshubViewerRoute(location.pathSegments, location.domain),
    [location.domain, location.pathSegments]
  );

  useEffect(() => {
    if (route.kind === 'redirect') {
      navigateDesktop(route.target, { replace: true });
    }
  }, [route]);

  if (route.kind === 'redirect') {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col gap-2">
      <ReviewUI
        key={location.routeKey}
        domain={route.domain}
        initialUrl={route.url}
        path={route.upstreamPath}
      />
    </div>
  );
}

function useDesktopLocation(): DesktopLocation {
  const [href, setHref] = useState(getDesktopHref);

  useEffect(() => {
    const updateHref = () => setHref(getDesktopHref());
    window.addEventListener('hashchange', updateHref);
    window.addEventListener('asahi:navigate', updateHref);
    return () => {
      window.removeEventListener('hashchange', updateHref);
      window.removeEventListener('asahi:navigate', updateHref);
    };
  }, []);

  return useMemo(() => parseDesktopHref(href), [href]);
}

function getDesktopHref(): string {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';
  if (hash === '') {
    return '/';
  }
  return hash.startsWith('/') ? hash : `/${hash}`;
}

function parseDesktopHref(href: string): DesktopLocation {
  const url = new URL(href, 'https://desktop.local');
  const pathSegments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const domain = url.searchParams.get('domain') ?? undefined;
  return {
    domain,
    href: `${url.pathname}${url.search}`,
    pathSegments,
    routeKey: `${url.pathname}?${url.searchParams.toString()}`,
    tabContent: url.searchParams.get('asahi-tab-content') === '1',
  };
}
