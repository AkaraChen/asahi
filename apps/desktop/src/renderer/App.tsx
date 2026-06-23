import {
  QueryClient,
  QueryClientProvider,
  useQueries,
} from '@tanstack/react-query';
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
  getViewerTabPath,
} from '../shared/desktopTabs';
import type {
  DesktopViewerPrTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';
import type { DesktopPullRequest } from '../shared/githubPullRequests';
import { DesktopHomePage } from './DesktopHomePage';
import { navigateDesktop } from './navigation';

const queryClient = new QueryClient();

interface DesktopLocation {
  domain?: string;
  prViewerAvatarUrl?: string;
  prTitle?: string;
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
  const prRepoKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const tab of tabs) {
      if (tab.type !== 'pr') continue;
      keys.add(`${tab.owner}/${tab.repo}`);
    }
    return [...keys];
  }, [tabs]);

  const prQueries = useQueries({
    queries: prRepoKeys.map((key) => {
      const [owner, repo] = key.split('/');
      return {
        queryKey: ['desktop-prs', owner, repo],
        queryFn: async () => {
          const result = await window.asahi.listRepositoryPullRequests({
            repositories: [
              {
                owner,
                name: repo,
                nameWithOwner: `${owner}/${repo}`,
              },
            ],
          });
          if (!result.ok) {
            throw new Error(result.message);
          }
          return result.items;
        },
        staleTime: 60_000,
      };
    }),
  });

  const prQueryByRepo = useMemo(() => {
    const map = new Map<string, ReturnType<typeof prQueries[number]>>();
    for (let i = 0; i < prRepoKeys.length; i += 1) {
      map.set(prRepoKeys[i], prQueries[i]);
    }
    return map;
  }, [prQueries, prRepoKeys]);

  const getPrTabLabel = useCallback(
    (tab: DesktopViewerPrTabRequest) => {
      const query = prQueryByRepo.get(`${tab.owner}/${tab.repo}`);
      const title = query?.data?.find(
        (item: DesktopPullRequest) =>
          item.number === tab.number &&
          item.owner === tab.owner &&
          item.repo === tab.repo
      )?.title;

      return title ?? `${tab.owner}/${tab.repo} #${tab.number}`;
    },
    [prQueryByRepo]
  );

  const getPrTabViewerAvatarUrl = useCallback(
    (tab: DesktopViewerPrTabRequest) => {
      const query = prQueryByRepo.get(`${tab.owner}/${tab.repo}`);
      const viewerAvatarUrl = query?.data?.find(
        (item: DesktopPullRequest) =>
          item.number === tab.number &&
          item.owner === tab.owner &&
          item.repo === tab.repo
      )?.viewerAvatarUrl;

      if (viewerAvatarUrl == null || viewerAvatarUrl.trim() === '') {
        return undefined;
      }

      return viewerAvatarUrl;
    },
    [prQueryByRepo]
  );

  const getPrTabViewerBody = useCallback(
    (tab: DesktopViewerPrTabRequest) => {
      const query = prQueryByRepo.get(`${tab.owner}/${tab.repo}`);
      return (
        query?.data?.find(
          (item: DesktopPullRequest) =>
            item.number === tab.number &&
            item.owner === tab.owner &&
            item.repo === tab.repo
        )?.bodyHTML ?? tab.body
      );
    },
    [prQueryByRepo]
  );

  const openViewerTab = useCallback(
    (tab: DesktopViewerTabRequest) => {
      const nextTab: DesktopViewerTabRequest =
        tab.type === 'pr' &&
        (tab.title == null || tab.viewerAvatarUrl == null || tab.body == null)
          ? {
              ...tab,
              title: tab.title ?? getPrTabLabel(tab),
              viewerAvatarUrl:
                tab.viewerAvatarUrl ?? getPrTabViewerAvatarUrl(tab),
              body: tab.body ?? getPrTabViewerBody(tab),
            }
          : tab;

      setTabs((current) =>
        current.some((item) => item.id === nextTab.id)
          ? current.map((item) =>
              item.id === nextTab.id
                ? {
                    ...item,
                    viewerAvatarUrl:
                      nextTab.viewerAvatarUrl ?? item.viewerAvatarUrl,
                    body: nextTab.body ?? item.body,
                    title: nextTab.title,
                  }
                : item
            )
          : [...current, nextTab]
      );
      setActiveTabId(nextTab.id);
      void window.asahi.openViewerTab(nextTab);
    },
    [getPrTabLabel, getPrTabViewerAvatarUrl, getPrTabViewerBody]
  );

  useEffect(() => {
    void window.asahi.selectDesktopTab({ id: DESKTOP_HOME_TAB_ID });
  }, []);

  useEffect(() => {
    if (location.pathSegments.length === 0) return;
    const tab = parseDesktopViewerTab(location.href);
    if (tab == null) return;

    openViewerTab(tab);
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
      <div className="select-none flex min-w-0 items-end overflow-x-auto border-b border-[var(--color-border)] bg-[var(--diffshub-sidebar-bg)] text-[12px] leading-none">
        <HomeTabButton
          active={activeTabId === DESKTOP_HOME_TAB_ID}
          onClick={() => selectTab(DESKTOP_HOME_TAB_ID)}
        />
        {tabs.map((tab) => (
          <TabButton
            active={activeTabId === tab.id}
            key={tab.id}
            label={
              tab.type === 'pr'
                ? getPrTabLabel(tab)
                : tab.id
            }
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
          ? 'relative flex h-9 w-9 shrink-0 items-center justify-center border border-b-0 border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)] after:content-[""]'
          : 'flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-border)] border-b-[var(--color-border)] bg-[var(--diffshub-sidebar-bg)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
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
            ? 'relative flex h-9 w-56 shrink-0 items-center gap-1 overflow-hidden border border-b-0 border-[var(--color-border)] bg-[var(--color-card)] px-2 text-[var(--color-foreground)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--color-primary)] after:content-[""]'
            : 'hover:bg-[var(--color-accent)] flex h-9 w-56 shrink-0 items-center gap-1 overflow-hidden border border-[var(--color-border)] border-b-[var(--color-border)] px-2 text-[12px] text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-foreground)]'
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
            className="flex size-5 shrink-0 items-center justify-center text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
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
  const tabRequestId = useMemo(
    () => getDesktopViewerTabId(location.pathSegments),
    [location.pathSegments]
  );
  const [viewerTabRequest, setViewerTabRequest] =
    useState<DesktopViewerTabRequest | null>(null);

  useEffect(() => {
    if (route.kind === 'redirect') {
      navigateDesktop(route.target, { replace: true });
    }
  }, [route]);

  useEffect(() => {
    let cancelled = false;

    if (tabRequestId == null) {
      setViewerTabRequest(null);
      return;
    }

    void window.asahi
      .getViewerTabRequest(tabRequestId)
      .then((request) => {
        if (!cancelled) {
          setViewerTabRequest(request);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setViewerTabRequest(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tabRequestId]);

  if (route.kind === 'redirect') {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col gap-2">
      <ReviewUI
        key={location.routeKey}
        desktopPrOwnerAvatarUrl={location.prViewerAvatarUrl}
        desktopPrBody={viewerTabRequest?.body}
        desktopPrTitle={location.prTitle}
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
  const prViewerAvatarUrl =
    url.searchParams.get('asahi-pr-viewer-avatar') ?? undefined;
  const prTitle = url.searchParams.get('asahi-pr-title') ?? undefined;
  return {
    domain,
    prViewerAvatarUrl,
    prTitle,
    href: `${url.pathname}${url.search}`,
    pathSegments,
    routeKey: `${url.pathname}?${url.searchParams.toString()}`,
    tabContent: url.searchParams.get('asahi-tab-content') === '1',
  };
}

function parseDesktopViewerTab(
  href: string
): DesktopViewerTabRequest | null {
  const url = new URL(href, 'https://desktop.local');
  const pullTabMatch = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(
    url.pathname
  );
  if (pullTabMatch == null) return null;
  const prTitle = url.searchParams.get('asahi-pr-title') ?? undefined;
  const viewerAvatarUrl =
    url.searchParams.get('asahi-pr-viewer-avatar') ?? undefined;

  const request: DesktopViewerPrTabRequest = {
    type: 'pr',
    owner: pullTabMatch[1],
    repo: pullTabMatch[2],
    number: Number(pullTabMatch[3]),
    viewerAvatarUrl,
  };

  return {
    id: getViewerTabPath(request),
    ...request,
    ...(prTitle == null ? {} : { title: prTitle }),
  };
}

function getDesktopViewerTabId(
  pathSegments: string[]
): string | null {
  if (pathSegments.length < 4) return null;

  const [owner, repo, resourceType, numberText] = pathSegments;
  if (resourceType !== 'pull') return null;

  const number = Number(numberText);
  if (Number.isNaN(number)) return null;

  return `/${owner}/${repo}/pull/${number}`;
}
