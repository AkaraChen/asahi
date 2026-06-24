'use client';

import { type DiffIndicators } from '@pierre/diffs';
import { type CodeViewHandle, useWorkerPool } from '@pierre/diffs/react';
import { type ColorMode } from '@pierre/theming';
import { useThemeController } from '@pierre/theming/react';
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { DiffsHubHeader } from './DiffsHubHeader';
import { DiffsHubSidebar } from './DiffsHubSidebar';
import { DiffsHubStatusPanel } from './DiffsHubStatusPanel';
import { DiffsHubViewer } from './DiffsHubViewer';
import { ThemeSourceProvider } from './ThemeSourceProvider';
import { usePatchLoader } from './usePatchLoader';
import { useThemeCycle } from './useThemeCycle';
import {
  docsThemeCatalog,
  themeController,
} from './themeController';
import { preloadAvatars } from '../lib/annotation';
import { removeSavedCommentSidebarEntry } from '../lib/removeSavedCommentSidebarEntry';
import type { DarkThemeName, LightThemeName } from '../lib/themeNames';
import type {
  CommentMetadata,
  DiffsHubDeletedCommentEvent,
  DiffsHubSavedCommentEntry,
  DiffsHubSavedCommentEvent,
  DiffsHubThreadSidebarEntry,
  DiffsHubThreadSidebarItem,
  GitHubCommentAuthor,
  GitHubInlineCommentsClient,
  GitHubInlineThread,
} from '../lib/types';
import { rangeFromGitHubAnchor } from '../lib/githubInlineThreadAnchor';
import { upsertSavedCommentSidebarEntry } from '../lib/upsertSavedCommentSidebarEntry';

interface ReviewUIProps {
  domain?: string;
  initialUrl: string;
  desktopPrOwnerAvatarUrl?: string;
  desktopPrBody?: string;
  desktopPrTitle?: string;
  githubComments?: GitHubInlineCommentsClient;
  path: string;
}

const DEFAULT_SIDEBAR_WIDTH = 320;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 720;

export function ReviewUI({
  domain,
  initialUrl,
  desktopPrOwnerAvatarUrl,
  desktopPrBody,
  desktopPrTitle,
  githubComments,
  path,
}: ReviewUIProps) {
  // Provide the diffshub-scoped theme context, then render the body BELOW it so
  // the diffs hook + selection hook can read the controller context.
  return (
    <ThemeSourceProvider controller={themeController}>
      <ReviewUIInner
        domain={domain}
        desktopPrOwnerAvatarUrl={desktopPrOwnerAvatarUrl}
        desktopPrBody={desktopPrBody}
        desktopPrTitle={desktopPrTitle}
        githubComments={githubComments}
        initialUrl={initialUrl}
        path={path}
      />
    </ThemeSourceProvider>
  );
}

function ReviewUIInner({
  domain,
  initialUrl,
  desktopPrOwnerAvatarUrl,
  desktopPrBody,
  desktopPrTitle,
  githubComments,
  path,
}: ReviewUIProps) {
  useEffect(preloadAvatars, []);

  const isWorkerPoolReadyOrDisable = useIsWorkerPoolReadyOrDisabled();
  const [diffStyle, setDiffStyle] = useState<'split' | 'unified'>('split');
  const [collapseMode, setCollapseMode] = useState<'expanded' | 'collapsed'>(
    'expanded'
  );
  const [fileTreeOverlayOpen, setFileTreeOverlayOpen] = useState(false);
  const [overflow, setOverflow] = useState<'wrap' | 'scroll'>('scroll');
  const [showBackgrounds, setShowBackgrounds] = useState(true);
  const [diffIndicators, setDiffIndicators] = useState<DiffIndicators>('bars');
  const [lineNumbers, setLineNumbers] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [githubThreads, setGitHubThreads] = useState<GitHubInlineThread[]>([]);
  const [githubViewer, setGitHubViewer] = useState<GitHubCommentAuthor | null>(
    null
  );
  // All theming state — color mode and the light/dark theme-name picks — lives
  // in the single @pierre/theming controller (the same instance the app-wide
  // ThemeProvider is bound to). Reading it here means picking Auto/Light/Dark
  // flips both the CodeView's `themeType` and the app's <html> class, and the
  // theme-name picks persist with no separate local state.
  const themeState = useThemeController(themeController);

  // The controller reads persisted values synchronously when its module loads
  // on the client, so useSyncExternalStore would surface them on the very first
  // client render — but the server rendered the defaults. Gate every
  // theme-derived value (rendered into inline chrome styles + the CodeView
  // themeType) behind a client-mounted flag so the first client render matches
  // the SSR markup, then flips to the user's selection. This also keeps the
  // long-lived WorkerPool and the CodeView from mounting against the default
  // palette before the persisted values apply.
  const [themesHydrated, setThemesHydrated] = useState(false);
  useEffect(() => {
    setThemesHydrated(true);
  }, []);

  const colorMode: ColorMode = themesHydrated ? themeState.mode : 'system';
  const appResolvedTheme = themesHydrated
    ? themeState.resolvedColorScheme
    : undefined;
  const lightThemeName = themesHydrated
    ? themeState.lightThemeName
    : docsThemeCatalog.defaultLightThemeName;
  const darkThemeName = themesHydrated
    ? themeState.darkThemeName
    : docsThemeCatalog.defaultDarkThemeName;
  const setColorMode = useCallback((mode: ColorMode) => {
    themeController.setColorMode(mode);
  }, []);
  const setLightThemeName = useCallback((name: LightThemeName) => {
    themeController.setThemeNameForScheme('light', name);
  }, []);
  const setDarkThemeName = useCallback((name: DarkThemeName) => {
    themeController.setThemeNameForScheme('dark', name);
  }, []);
  // The cycle button in the System Monitor sweeps through every Shiki
  // theme so reviewers can preview the full set without manually picking
  // each one. The hook captures the user's current pick when cycling
  // starts so the visible theme anchors the rotation.
  const themeCycle = useThemeCycle({
    lightThemeName,
    darkThemeName,
    resolvedThemeMode: appResolvedTheme,
    setLightThemeName,
    setDarkThemeName,
    setColorMode,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CodeViewHandle<CommentMetadata> | null>(null);
  const handlePatchLoadStart = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const {
    applyCollapseModeToLoaded,
    commentFileByItemId,
    commentSections,
    diffStats,
    errorMessage,
    initialItems,
    loadState,
    onLineLinkChange,
    onViewerReady,
    retryLoad,
    setCommentSections,
    treeSource,
    viewerKey,
  } = usePatchLoader({
    collapseMode,
    domain,
    onLoadStart: handlePatchLoadStart,
    path,
    viewerRef,
  });

  const refreshFullPrView = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    viewerRef.current?.clearSelectedLines();
    setGitHubThreads([]);
    retryLoad();
  }, [retryLoad]);

  useEffect(() => {
    if (githubComments == null || loadState !== 'ready') {
      setGitHubThreads([]);
      return;
    }

    let cancelled = false;
    void githubComments.listThreads().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setGitHubThreads([]);
        return;
      }
      setGitHubThreads(result.items);
      setGitHubViewer(result.viewer);
    });

    return () => {
      cancelled = true;
    };
  }, [githubComments, loadState, viewerKey]);
  const threadSections = useMemo(
    () =>
      buildGitHubThreadSidebarSections(githubThreads, commentFileByItemId),
    [commentFileByItemId, githubThreads]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMobileState = (matches: boolean) => {
      setDiffStyle(matches ? 'unified' : 'split');
      if (!matches) setFileTreeOverlayOpen(false);
    };
    const handleChange = (event: MediaQueryListEvent) => {
      updateMobileState(event.matches);
    };

    updateMobileState(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  const handleSelectTreeItem = useCallback((itemId: string) => {
    setFileTreeOverlayOpen(false);
    const viewer = viewerRef.current;
    if (viewer == null) {
      return;
    }
    const item = viewer.getItem(itemId);
    if (item != null && item.collapsed === true) {
      item.collapsed = false;
      item.version = typeof item.version === 'number' ? item.version + 1 : 1;
      viewer.updateItem(item);
    }
    viewer.scrollTo({
      type: 'item',
      id: itemId,
      align: 'start',
      behavior: 'smooth',
    });
  }, []);
  const handleToggleCollapseMode = useCallback(() => {
    const next = collapseMode === 'expanded' ? 'collapsed' : 'expanded';
    setCollapseMode(next);
    applyCollapseModeToLoaded(next);
  }, [applyCollapseModeToLoaded, collapseMode]);
  const handleCommentSaved = useCallback(
    (comment: DiffsHubSavedCommentEvent) => {
      setCommentSections((prev) =>
        upsertSavedCommentSidebarEntry(prev, commentFileByItemId, comment)
      );
    },
    [commentFileByItemId, setCommentSections]
  );
  const handleCommentDeleted = useCallback(
    (comment: DiffsHubDeletedCommentEvent) => {
      setCommentSections((prev) =>
        removeSavedCommentSidebarEntry(prev, comment)
      );
    },
    [setCommentSections]
  );
  const handleToggleFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen((open) => !open);
  }, []);
  const handleCloseFileTreeOverlay = useCallback(() => {
    setFileTreeOverlayOpen(false);
  }, []);
  const handleSidebarResizeStart = useCallback(
    (startX: number, startWidth: number) => {
      const onPointerMove = (event: PointerEvent) => {
        const nextWidth = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, startWidth + (event.clientX - startX))
        );
        setSidebarWidth(nextWidth);
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
    },
    []
  );
  const handleSelectComment = useCallback(
    (comment: DiffsHubSavedCommentEntry) => {
      setFileTreeOverlayOpen(false);
      viewerRef.current?.setSelectedLines({
        id: comment.itemId,
        range: comment.range,
      });
      viewerRef.current?.scrollTo({
        type: 'line',
        id: comment.itemId,
        lineNumber: comment.range.end,
        side: comment.range.endSide ?? comment.range.side,
        align: 'center',
        behavior: 'smooth-auto',
      });
    },
    []
  );
  const handleSelectThread = useCallback(
    (thread: DiffsHubThreadSidebarEntry) => {
      setFileTreeOverlayOpen(false);
      const viewer = viewerRef.current;
      if (viewer == null) {
        return;
      }
      const item = viewer.getItem(thread.itemId);
      if (item == null) {
        return;
      }
      if (item.collapsed === true) {
        item.collapsed = false;
        item.version = typeof item.version === 'number' ? item.version + 1 : 1;
        viewer.updateItem(item);
      }

      if (thread.anchor.kind === 'file') {
        viewer.clearSelectedLines();
        viewer.scrollTo({
          type: 'item',
          id: thread.itemId,
          align: 'start',
          behavior: 'smooth',
        });
        return;
      }

      viewer.setSelectedLines({
        id: thread.itemId,
        range: thread.range,
      });
      viewer.scrollTo({
        type: 'range',
        id: thread.itemId,
        range: thread.range,
        align: 'center',
        behavior: 'smooth-auto',
      });
    },
    []
  );
  // Withhold the viewer until the persisted themes have been read from
  // localStorage. Otherwise on client-side navigation back into a diff the
  // CodeView would mount during the brief render where lightThemeName/darkThemeName
  // are still at their `DEFAULT_*_THEME` initial values and tokenize the
  // first batch of files against the wrong palette.
  const viewerAvailable =
    isWorkerPoolReadyOrDisable &&
    themesHydrated &&
    (loadState === 'ready' ||
      (loadState === 'streaming' && initialItems.length > 0));

  return (
    <ReviewGrid sidebarWidth={sidebarWidth}>
      <DiffsHubHeader
        className="[grid-area:header]"
        collapseMode={collapseMode}
        desktopPrTitle={desktopPrTitle}
        colorMode={colorMode}
        darkThemeName={darkThemeName}
        debugMode={debugMode}
        diffIndicators={diffIndicators}
        diffStyle={diffStyle}
        initialUrl={initialUrl}
        lightThemeName={lightThemeName}
        lineNumbers={lineNumbers}
        overflow={overflow}
        fileTreeOverlayOpen={fileTreeOverlayOpen}
        fileTreeAvailable={treeSource != null}
        onToggleCollapseMode={handleToggleCollapseMode}
        onToggleFileTreeOverlay={handleToggleFileTreeOverlay}
        onRefresh={refreshFullPrView}
        setColorMode={setColorMode}
        setDarkThemeName={setDarkThemeName}
        setDebugMode={setDebugMode}
        setDiffIndicators={setDiffIndicators}
        setDiffStyle={setDiffStyle}
        setLightThemeName={setLightThemeName}
        setLineNumbers={setLineNumbers}
        setOverflow={setOverflow}
        setShowBackgrounds={setShowBackgrounds}
        showBackgrounds={showBackgrounds}
      />
      {viewerAvailable && treeSource != null ? (
        <>
          <DiffsHubSidebar
            className="[grid-area:viewer] md:[grid-area:tree]"
            commentSections={commentSections}
            defaultCommentAuthorAvatarUrl={desktopPrOwnerAvatarUrl}
            desktopPrBody={desktopPrBody}
            debugMode={debugMode}
            diffStats={diffStats}
            threadSections={githubComments == null ? undefined : threadSections}
            sidebarWidth={sidebarWidth}
            onSidebarResizeStart={handleSidebarResizeStart}
            mobileOverlayOpen={fileTreeOverlayOpen}
            onMobileClose={handleCloseFileTreeOverlay}
            onSelectComment={handleSelectComment}
            onSelectThread={handleSelectThread}
            scrollRef={scrollRef}
            source={treeSource}
            streaming={loadState === 'streaming'}
            themeCycle={themeCycle}
            onSelectItem={handleSelectTreeItem}
          />
          <DiffsHubViewer
            key={viewerKey}
            className="[grid-area:viewer]"
            diffStyle={diffStyle}
            defaultCommentAuthorAvatarUrl={desktopPrOwnerAvatarUrl}
            commentFileByItemId={commentFileByItemId}
            githubComments={githubComments}
            githubThreads={githubThreads}
            githubViewer={githubViewer}
            overflow={overflow}
            showBackgrounds={showBackgrounds}
            diffIndicators={diffIndicators}
            lineNumbers={lineNumbers}
            scrollRef={scrollRef}
            themeType={colorMode}
            viewerRef={viewerRef}
            initialItems={initialItems}
            onCommentDeleted={handleCommentDeleted}
            onCommentSaved={handleCommentSaved}
            onLineLinkChange={onLineLinkChange}
            onViewerReady={onViewerReady}
          />
        </>
      ) : (
        <DiffsHubStatusPanel
          errorMessage={errorMessage}
          onRetry={retryLoad}
          state={loadState}
        />
      )}
    </ReviewGrid>
  );
}

function buildGitHubThreadSidebarSections(
  threads: readonly GitHubInlineThread[],
  itemIdToFile: ReadonlyMap<string, { fileOrder: number; path: string }> | null
): DiffsHubThreadSidebarItem[] {
  if (itemIdToFile == null || threads.length === 0) {
    return [];
  }

  const pathToFile = new Map<
    string,
    { fileOrder: number; itemId: string; path: string }
  >();
  for (const [itemId, file] of itemIdToFile) {
    pathToFile.set(file.path, { ...file, itemId });
  }

  const sections = new Map<string, DiffsHubThreadSidebarItem>();
  for (const thread of threads) {
    const file = pathToFile.get(thread.anchor.path);
    const range = rangeFromGitHubAnchor(thread.anchor);
    const firstComment = thread.comments[0];
    if (file == null || range == null || firstComment == null) {
      continue;
    }

    const side = range.endSide ?? range.side;
    const entry: DiffsHubThreadSidebarEntry = {
      anchor:
        thread.anchor.kind === 'file' || side == null
          ? { kind: 'file' }
          : {
              kind: 'line',
              lineNumber: range.end,
              side,
            },
      author: firstComment.author.login,
      avatarUrl: firstComment.author.avatarUrl,
      body: firstComment.body,
      commentCount: thread.comments.length,
      fileOrder: file.fileOrder,
      isResolved: thread.isResolved,
      itemId: file.itemId,
      key: thread.id,
      path: file.path,
      range,
      thread,
    };

    const section = sections.get(file.itemId);
    if (section == null) {
      sections.set(file.itemId, {
        fileOrder: file.fileOrder,
        itemId: file.itemId,
        path: file.path,
        threads: [entry],
      });
    } else {
      section.threads.push(entry);
    }
  }

  return [...sections.values()]
    .map((section) => ({
      ...section,
      threads: [...section.threads].sort(compareThreadSidebarEntries),
    }))
    .sort((a, b) => a.fileOrder - b.fileOrder || a.path.localeCompare(b.path));
}

function compareThreadSidebarEntries(
  a: DiffsHubThreadSidebarEntry,
  b: DiffsHubThreadSidebarEntry
): number {
  const aLine = a.anchor.kind === 'line' ? a.anchor.lineNumber : 0;
  const bLine = b.anchor.kind === 'line' ? b.anchor.lineNumber : 0;
  return aLine - bLine || a.key.localeCompare(b.key);
}

function useIsWorkerPoolReadyOrDisabled() {
  const workerPool = useWorkerPool();
  const [isReady, setIsReady] = useState(
    () => workerPool?.isInitialized() ?? true
  );
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    // The callback will always be fired immediately with the new state, so we
    // don't need to check for it in the effect
    return workerPool?.subscribeToStatChanges((stats) => {
      const isReady = stats.managerState === 'initialized';
      if (isReady !== isReadyRef.current) {
        setIsReady(isReady);
        isReadyRef.current = isReady;
      }
    });
  }, [workerPool]);
  return isReady;
}

interface ReviewGridProps {
  children: ReactNode;
  sidebarWidth?: number;
}

function ReviewGrid({ children, sidebarWidth = DEFAULT_SIDEBAR_WIDTH }: ReviewGridProps) {
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden overscroll-contain contain-strict [grid-template-areas:'header''viewer'] md:grid-cols-[var(--asahi-sidebar-width)_minmax(0,1fr)] md:[grid-template-areas:'header_header''tree_viewer']"
      style={{ '--asahi-sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
