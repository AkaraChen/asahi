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
} from '../shared/desktopTabs';
import type {
  DesktopViewerPrTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';
import type {
  DesktopGitHubInlineComment,
  DesktopGitHubInlineCommentAnchor,
  DesktopGitHubInlineThread,
  DesktopGitHubReactionContent,
  DesktopPullRequest,
} from '../shared/githubPullRequests';
import { DesktopHomePage } from './DesktopHomePage';
import {
  addInlineCommentReaction,
  createInlineComment,
  listInlineThreads,
  listRepositoryPullRequests,
  removeInlineCommentReaction,
  replyInlineComment,
  resolveInlineThread,
  unresolveInlineThread,
} from './desktopApi';
import { useDesktopTabStore } from './desktopTabStore';
import { navigateDesktop } from './navigation';

const queryClient = new QueryClient();

interface DesktopLocation {
  contentMode: 'host' | 'home' | 'viewer';
  domain?: string;
  prViewerAvatarUrl?: string;
  prTitle?: string;
  href: string;
  pathSegments: string[];
  routeKey: string;
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

  if (location.contentMode === 'home') {
    return <DesktopHomeContent location={location} />;
  }

  if (location.contentMode === 'viewer') {
    return <DesktopViewer location={location} />;
  }

  return <DesktopTabShell location={location} />;
}

function DesktopHomeContent({ location }: { location: DesktopLocation }) {
  useEffect(() => {
    if (location.pathSegments.length === 0) return;
    const tab = parseDesktopViewerTab(location.href);
    if (tab == null) return;

    void window.asahi.openViewerTab(tab);
    navigateDesktop('/?asahi-home-content=1', { replace: true });
  }, [location.href, location.pathSegments.length]);

  return (
    <DesktopHomePage
      onOpenViewerTab={(tab) => void window.asahi.openViewerTab(tab)}
    />
  );
}

function DesktopTabShell({ location }: { location: DesktopLocation }) {
  const activeTabId = useDesktopTabStore((state) => state.activeTabId);
  const tabs = useDesktopTabStore((state) => state.tabs);
  const closeStoredTab = useDesktopTabStore((state) => state.closeTab);
  const openStoredTab = useDesktopTabStore((state) => state.openTab);
  const selectStoredTab = useDesktopTabStore((state) => state.selectTab);
  const syncTabs = useDesktopTabStore((state) => state.syncTabs);
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
          const result = await listRepositoryPullRequests({
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
    const map = new Map<string, (typeof prQueries)[number]>();
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

      openStoredTab(nextTab);
      void window.asahi.openViewerTab(nextTab);
    },
    [getPrTabLabel, getPrTabViewerAvatarUrl, getPrTabViewerBody, openStoredTab]
  );

  useEffect(
    () =>
      window.asahi.onDesktopTabsChanged((snapshot) => {
        syncTabs(snapshot.activeTabId, snapshot.tabs);
      }),
    [syncTabs]
  );

  useEffect(() => {
    if (activeTabId === DESKTOP_HOME_TAB_ID) {
      void window.asahi.selectDesktopTab({ id: DESKTOP_HOME_TAB_ID });
      return;
    }

    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab == null) {
      selectStoredTab(DESKTOP_HOME_TAB_ID);
      void window.asahi.selectDesktopTab({ id: DESKTOP_HOME_TAB_ID });
      return;
    }

    void window.asahi.openViewerTab(activeTab);
  }, [activeTabId, selectStoredTab, tabs]);

  useEffect(() => {
    if (location.pathSegments.length === 0) return;
    const tab = parseDesktopViewerTab(location.href);
    if (tab == null) return;

    openViewerTab(tab);
    navigateDesktop('/', { replace: true });
  }, [location.href, location.routeKey, openViewerTab]);

  function selectTab(id: string) {
    selectStoredTab(id);
    if (id === DESKTOP_HOME_TAB_ID) {
      void window.asahi.selectDesktopTab({ id });
      return;
    }

    const tab = tabs.find((item) => item.id === id);
    if (tab != null) {
      void window.asahi.openViewerTab(tab);
    }
  }

  function closeTab(id: string) {
    const nextActiveTabId = closeStoredTab(id);
    void window.asahi.closeViewerTab(id);

    if (nextActiveTabId === DESKTOP_HOME_TAB_ID) {
      void window.asahi.selectDesktopTab({ id: DESKTOP_HOME_TAB_ID });
      return;
    }

    const nextActiveTab = useDesktopTabStore
      .getState()
      .tabs.find((tab) => tab.id === nextActiveTabId);
    if (nextActiveTab != null) {
      void window.asahi.openViewerTab(nextActiveTab);
    }
  }

  return (
    <main
      className="bg-[var(--diffshub-sidebar-bg)] text-foreground grid h-dvh min-h-0 overflow-hidden antialiased"
      style={{
        gridTemplateRows: `${DESKTOP_TAB_BAR_HEIGHT}px`,
      }}
    >
      <div className="flex min-w-0 select-none items-end overflow-x-auto border-b border-[var(--color-border)] bg-[var(--diffshub-sidebar-bg)] text-[12px] leading-none">
        <HomeTabButton
          active={activeTabId === DESKTOP_HOME_TAB_ID}
          onClick={() => selectTab(DESKTOP_HOME_TAB_ID)}
        />
        {tabs.map((tab) => (
          <TabButton
            active={activeTabId === tab.id}
            key={tab.id}
            label={tab.type === 'pr' ? getPrTabLabel(tab) : tab.id}
            onClick={() => selectTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
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
          ? 'relative flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-border)] border-b-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-foreground)]'
          : 'flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-border)] border-b-[var(--color-border)] bg-[var(--diffshub-sidebar-bg)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] active:scale-[0.96]'
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
          ? 'relative z-10 -ml-px flex h-9 w-56 shrink-0 items-center gap-1 overflow-hidden border border-[var(--color-border)] border-b-[var(--color-primary)] bg-[var(--color-card)] px-2 text-[var(--color-foreground)]'
          : 'relative -ml-px flex h-9 w-56 shrink-0 items-center gap-1 overflow-hidden border border-[var(--color-border)] border-b-[var(--color-border)] px-2 text-[12px] text-[var(--color-muted-foreground)] transition-colors hover:z-10 hover:border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
      }
    >
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left active:scale-[0.96]"
        onClick={onClick}
      >
        {label}
      </button>
      {onClose != null && (
        <button
          type="button"
          aria-label={`Close ${label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] active:scale-[0.96]"
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
        desktopPrOwnerAvatarUrl={
          viewerTabRequest?.viewerAvatarUrl ?? location.prViewerAvatarUrl
        }
        desktopPrBody={viewerTabRequest?.body}
        desktopPrTitle={viewerTabRequest?.title ?? location.prTitle}
        domain={route.domain}
        githubComments={
          viewerTabRequest?.type === 'pr'
            ? createDesktopGitHubCommentsClient(viewerTabRequest)
            : undefined
        }
        initialUrl={route.url}
        path={route.upstreamPath}
      />
    </div>
  );
}

function createDesktopGitHubCommentsClient(tab: DesktopViewerPrTabRequest) {
  const ref = { owner: tab.owner, repo: tab.repo, number: tab.number };
  return {
    addReaction: async (
      comment: DesktopGitHubInlineComment,
      content: DesktopGitHubReactionContent
    ) => {
      if (comment.databaseId == null) {
        return { ok: false as const, message: 'Comment is not published yet.' };
      }
      const result = await addInlineCommentReaction({
        ...ref,
        commentId: comment.databaseId,
        content,
      });
      return result.ok
        ? { ok: true as const, reactions: result.reactions }
        : { ok: false as const, message: result.message };
    },
    createComment: async (
      anchor: DesktopGitHubInlineCommentAnchor,
      body: string
    ) => {
      const result = await createInlineComment({ ...ref, anchor, body });
      return result.ok
        ? {
            ok: true as const,
            comment: result.comment,
            thread: result.thread,
          }
        : { ok: false as const, message: result.message };
    },
    listThreads: async () => {
      const result = await listInlineThreads(ref);
      return result.ok
        ? { ok: true as const, items: result.items, viewer: result.viewer }
        : { ok: false as const, message: result.message };
    },
    removeReaction: async (
      comment: DesktopGitHubInlineComment,
      content: DesktopGitHubReactionContent
    ) => {
      if (comment.databaseId == null) {
        return { ok: false as const, message: 'Comment is not published yet.' };
      }
      const result = await removeInlineCommentReaction({
        ...ref,
        commentId: comment.databaseId,
        content,
      });
      return result.ok
        ? { ok: true as const, reactions: result.reactions }
        : { ok: false as const, message: result.message };
    },
    reply: async (comment: DesktopGitHubInlineComment, body: string) => {
      if (comment.databaseId == null) {
        return { ok: false as const, message: 'Comment is not published yet.' };
      }
      const result = await replyInlineComment({
        ...ref,
        body,
        inReplyTo: comment.databaseId,
      });
      return result.ok
        ? { ok: true as const, comment: result.comment }
        : { ok: false as const, message: result.message };
    },
    resolveThread: async (thread: DesktopGitHubInlineThread) => {
      const result = await resolveInlineThread({ threadId: thread.id });
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, message: result.message };
    },
    unresolveThread: async (thread: DesktopGitHubInlineThread) => {
      const result = await unresolveInlineThread({ threadId: thread.id });
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, message: result.message };
    },
  };
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
  const contentMode = getDesktopContentMode(url.searchParams);
  return {
    contentMode,
    domain,
    prViewerAvatarUrl,
    prTitle,
    href: `${url.pathname}${url.search}`,
    pathSegments,
    routeKey: `${url.pathname}?${url.searchParams.toString()}`,
  };
}

function getDesktopContentMode(
  searchParams: URLSearchParams
): DesktopLocation['contentMode'] {
  const explicitMode =
    searchParams.get('asahi-home-content') === '1'
      ? 'home'
      : searchParams.get('asahi-tab-content') === '1'
        ? 'viewer'
        : searchParams.get('asahi-host') === '1'
          ? 'host'
          : null;

  if (explicitMode != null) {
    sessionStorage.setItem('asahi:desktop-content-mode', explicitMode);
    return explicitMode;
  }

  const storedMode = sessionStorage.getItem('asahi:desktop-content-mode');
  return storedMode === 'home' || storedMode === 'viewer' ? storedMode : 'host';
}

function parseDesktopViewerTab(href: string): DesktopViewerTabRequest | null {
  const url = new URL(href, 'https://desktop.local');
  const pullTabMatch = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(url.pathname);
  if (pullTabMatch == null) return null;
  const prTitle = url.searchParams.get('asahi-pr-title') ?? undefined;
  const viewerAvatarUrl =
    url.searchParams.get('asahi-pr-viewer-avatar') ?? undefined;

  const owner = pullTabMatch[1];
  const repo = pullTabMatch[2];
  const number = Number(pullTabMatch[3]);

  const request: DesktopViewerPrTabRequest = {
    id: `/${owner}/${repo}/pull/${number}`,
    type: 'pr',
    owner,
    repo,
    number,
    viewerAvatarUrl,
  };

  return {
    ...request,
    ...(prTitle == null ? {} : { title: prTitle }),
  };
}

function getDesktopViewerTabId(pathSegments: string[]): string | null {
  if (pathSegments.length < 4) return null;

  const [owner, repo, resourceType, numberText] = pathSegments;
  if (resourceType !== 'pull') return null;

  const number = Number(numberText);
  if (Number.isNaN(number)) return null;

  return `/${owner}/${repo}/pull/${number}`;
}
