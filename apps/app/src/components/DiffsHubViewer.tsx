import {
  areSelectionsEqual,
  type CodeViewDiffItem,
  type CodeViewItem,
  type CodeViewLineSelection,
  type CodeViewOptions,
  type DiffIndicators,
  type DiffLineAnnotation,
  type LineAnnotation,
  type SelectedLineRange,
  type ThemeTypes,
} from '@pierre/diffs';
import { type CodeViewHandle, useStableCallback } from '@pierre/diffs/react';
import { IconChevronSm, IconPlus } from '@pierre/icons';
import {
  memo,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { DraftAnnotation } from './DraftAnnotation';
import { ExampleAnnotation } from './ExampleAnnotation';
import { GitHubThreadAnnotation } from './GitHubThreadAnnotation';
import { ThemedCodeView } from './ThemedCodeView';
import { useChromeThemeProps } from './useChromeThemeProps';
import type { AvatarName } from '../lib/annotation';
import { buildAnnotationThemeStyle } from '../lib/annotationThemeStyle';
import { classifyCommentLineType } from '../lib/classifyCommentLineType';
import { cn } from '../lib/cn';
import { CODE_VIEW_CUSTOM_CSS, CODE_VIEW_LAYOUT } from '../lib/constants';
import { isDiffItem } from '../lib/isDiffItem';
import { isDraftAnnotation } from '../lib/isDraftAnnotation';
import { isDraftMetadata } from '../lib/isDraftMetadata';
import { isGitHubThreadAnnotation } from '../lib/isGitHubThreadAnnotation';
import { isSavedAnnotation } from '../lib/isSavedAnnotation';
import {
  rangeFromGitHubAnchor,
  sideToGitHub,
} from '../lib/githubInlineThreadAnchor';
import { diffshubChromeMapping } from '../lib/theme/diffshubChromeMapping';
import type {
  CommentMetadata,
  DiffsHubCommentFileByItemId,
  DiffsHubDeletedCommentEvent,
  DiffsHubSavedCommentEvent,
  GitHubInlineComment,
  GitHubInlineCommentsClient,
  GitHubInlineCommentAnchor,
  GitHubInlineThread,
  GitHubInlineThreadMetadata,
  GitHubReactionContent,
} from '../lib/types';

function getNextItemVersion(item: CodeViewItem<CommentMetadata>): number {
  return typeof item.version === 'number' ? item.version + 1 : 1;
}

function updateViewerDiffItem(
  viewer: CodeViewHandle<CommentMetadata>,
  itemId: string,
  updateItem: (item: CodeViewDiffItem<CommentMetadata>) => boolean
): CodeViewDiffItem<CommentMetadata> | undefined {
  const item = viewer.getItem(itemId);
  if (item == null || !isDiffItem(item)) {
    return undefined;
  }

  if (!updateItem(item)) {
    return undefined;
  }

  item.version = getNextItemVersion(item);
  return viewer.updateItem(item) ? item : undefined;
}

interface ActiveDraftComment {
  itemId: string;
  key: string;
}

interface DiffsHubViewerProps {
  className?: string;
  diffStyle: 'split' | 'unified';
  onCommentDeleted(comment: DiffsHubDeletedCommentEvent): void;
  onCommentSaved(comment: DiffsHubSavedCommentEvent): void;
  commentFileByItemId: DiffsHubCommentFileByItemId | null;
  defaultCommentAuthorAvatarUrl?: string;
  githubComments?: GitHubInlineCommentsClient;
  githubThreads: readonly GitHubInlineThread[];
  githubViewer?: { avatarUrl?: string; login: string } | null;
  overflow: 'wrap' | 'scroll';
  showBackgrounds: boolean;
  diffIndicators: DiffIndicators;
  lineNumbers: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  themeType: ThemeTypes;
  viewerRef: RefObject<CodeViewHandle<CommentMetadata> | null>;
  initialItems: CodeViewItem<CommentMetadata>[];
  onLineLinkChange(selection: CodeViewLineSelection | null): void;
  onViewerReady(): void;
}

export const DiffsHubViewer = memo(function DiffsHubViewer({
  className,
  diffStyle,
  onCommentDeleted,
  onCommentSaved,
  commentFileByItemId,
  defaultCommentAuthorAvatarUrl,
  githubComments,
  githubThreads,
  githubViewer,
  overflow,
  showBackgrounds,
  diffIndicators,
  lineNumbers,
  scrollRef,
  themeType,
  viewerRef,
  initialItems,
  onLineLinkChange,
  onViewerReady,
}: DiffsHubViewerProps) {
  const nextCommentKeyRef = useRef(0);
  const activeDraftRef = useRef<ActiveDraftComment | null>(null);
  const [selectedLines, setSelectedLines] =
    useState<CodeViewLineSelection | null>(null);
  const { style: chromeStyle } = useChromeThemeProps(diffshubChromeMapping);
  // Preserve the previous `undefined`-means-not-resolved contract that
  // buildAnnotationThemeStyle and the className fallbacks depend on.
  const themeChromeStyle =
    Object.keys(chromeStyle).length > 0 ? chromeStyle : undefined;
  const annotationThemeStyle = useMemo(
    () => buildAnnotationThemeStyle(themeChromeStyle),
    [themeChromeStyle]
  );

  useEffect(() => {
    const { current: viewer } = viewerRef;
    if (viewer == null || commentFileByItemId == null) {
      return;
    }

    const threadsByItemId = groupGitHubThreadsByItemId(
      githubThreads,
      commentFileByItemId
    );
    for (const itemId of commentFileByItemId.keys()) {
      const item = viewer.getItem(itemId);
      if (item == null || !isDiffItem(item)) continue;
      const threadAnnotations = (threadsByItemId.get(itemId) ?? [])
        .map((thread) => toGitHubThreadAnnotation(thread))
        .filter((annotation) => annotation != null);
      const nonGitHubAnnotations = (item.annotations ?? []).filter(
        (annotation) => !isGitHubThreadAnnotation(annotation)
      );
      item.annotations = [...nonGitHubAnnotations, ...threadAnnotations];
      item.version = getNextItemVersion(item);
      viewer.updateItem(item);
    }
  }, [commentFileByItemId, githubThreads, viewerRef]);

  const handleSetSelection = useStableCallback(
    (selection: CodeViewLineSelection | null) => {
      setSelectedLines(selection);
    }
  );

  const handleToggleCommentSelection = useStableCallback(
    (selection: CodeViewLineSelection) => {
      setSelectedLines((prev) =>
        prev?.id === selection.id &&
        areSelectionsEqual(prev.range, selection.range)
          ? null
          : selection
      );
    }
  );

  const handleLineSelectionEnd = useStableCallback(
    (range: SelectedLineRange | null, item: CodeViewItem<CommentMetadata>) => {
      if (range == null || item.type !== 'diff') {
        onLineLinkChange(null);
      } else {
        onLineLinkChange({ id: item.id, range });
      }
    }
  );

  const handleViewerRef = useStableCallback(
    (viewer: CodeViewHandle<CommentMetadata> | null) => {
      viewerRef.current = viewer;
      if (viewer != null) {
        onViewerReady();
      }
    }
  );

  const handleCreateDraftComment = useStableCallback(
    (range: SelectedLineRange, itemId: string) => {
      const side = range.endSide ?? range.side;
      if (side == null) {
        return;
      }

      const lineNumber = range.end;
      const commentKey = `draft-${nextCommentKeyRef.current++}`;
      const { current: viewer } = viewerRef;
      if (viewer == null) {
        return;
      }

      const draftAnnotation: DiffLineAnnotation<CommentMetadata> = {
        side,
        lineNumber,
        metadata: {
          kind: 'draft',
          key: commentKey,
          message: '',
          range,
        },
      };

      const { current: activeDraft } = activeDraftRef;
      if (activeDraft != null && activeDraft.itemId !== itemId) {
        updateViewerDiffItem(viewer, activeDraft.itemId, (item) => {
          if (item.annotations == null) {
            return false;
          }

          const nextAnnotations = item.annotations.filter(
            (annotation) => annotation.metadata.key !== activeDraft.key
          );
          if (nextAnnotations.length === item.annotations.length) {
            return false;
          }

          item.annotations = nextAnnotations;
          return true;
        });
      }

      const updatedItem = updateViewerDiffItem(viewer, itemId, (item) => {
        const nonDraftAnnotations = (item.annotations ?? []).filter(
          (annotation) => !isDraftMetadata(annotation.metadata)
        );
        item.annotations = [...nonDraftAnnotations, draftAnnotation];
        return true;
      });

      if (updatedItem != null) {
        activeDraftRef.current = { itemId, key: commentKey };
      }
    }
  );

  const handleCreateFileDraftComment = useStableCallback((itemId: string) => {
    const { current: viewer } = viewerRef;
    if (viewer == null) {
      return;
    }

    const commentKey = `draft-${nextCommentKeyRef.current++}`;
    const draftAnnotation: DiffLineAnnotation<CommentMetadata> = {
      side: 'additions',
      lineNumber: 0,
      metadata: {
        kind: 'draft',
        key: commentKey,
        message: '',
        range: { start: 0, end: 0, side: 'additions' },
      },
    };

    const updatedItem = updateViewerDiffItem(viewer, itemId, (item) => {
      const nonDraftAnnotations = (item.annotations ?? []).filter(
        (annotation) => !isDraftMetadata(annotation.metadata)
      );
      item.annotations = [...nonDraftAnnotations, draftAnnotation];
      return true;
    });

    if (updatedItem != null) {
      activeDraftRef.current = { itemId, key: commentKey };
    }
  });

  const handleRemoveComment = useStableCallback(
    (itemId: string, key: string) => {
      const { current: viewer } = viewerRef;
      if (viewer == null) {
        return;
      }
      const item = viewer.getItem(itemId);
      const removedAnnotation =
        item != null && isDiffItem(item)
          ? item.annotations?.find(
              (annotation) => annotation.metadata.key === key
            )
          : undefined;

      updateViewerDiffItem(viewer, itemId, (item) => {
        if (item.annotations == null) {
          return false;
        }

        const nextAnnotations = item.annotations.filter(
          (annotation) => annotation.metadata.key !== key
        );

        if (nextAnnotations.length === item.annotations.length) {
          return false;
        }

        item.annotations = nextAnnotations;
        return true;
      });

      const { current: activeDraft } = activeDraftRef;
      if (activeDraft?.itemId === itemId && activeDraft.key === key) {
        activeDraftRef.current = null;
      }

      setSelectedLines(null);
      onLineLinkChange(null);
      if (removedAnnotation != null && isSavedAnnotation(removedAnnotation)) {
        onCommentDeleted({ itemId, key });
      }
    }
  );

  const handleSaveDraftComment = useStableCallback(
    (
      itemId: string,
      key: string,
      message: string,
      author: AvatarName,
      authorAvatarUrl?: string
    ) => {
      const trimmedMessage = message.trim();
      const { current: viewer } = viewerRef;
      if (trimmedMessage.length === 0 || viewer == null) {
        return;
      }

      const item = viewer.getItem(itemId);
      if (item == null || !isDiffItem(item)) {
        return;
      }

      const draftAnnotation = item?.annotations?.find(
        (annotation) => annotation.metadata.key === key
      );
      if (draftAnnotation == null || !isDraftAnnotation(draftAnnotation)) {
        return;
      }

      if (githubComments != null) {
        const anchor = createGitHubAnchor(
          commentFileByItemId,
          itemId,
          draftAnnotation.metadata.range
        );
        if (anchor == null) {
          return;
        }
        updateViewerDiffItem(viewer, itemId, (item) => {
          item.annotations = (item.annotations ?? []).filter(
            (annotation) => annotation.metadata.key !== key
          );
          return true;
        });
        const { current: activeDraft } = activeDraftRef;
        if (activeDraft?.itemId === itemId && activeDraft.key === key) {
          activeDraftRef.current = null;
        }
        setSelectedLines(null);
        onLineLinkChange(null);
        const thread = createOptimisticThread({
          anchor,
          author: githubViewer ?? {
            login: author,
            ...(authorAvatarUrl == null ? {} : { avatarUrl: authorAvatarUrl }),
          },
          body: trimmedMessage,
        });
        updateGitHubThreadAnnotation(viewer, itemId, thread);
        void publishGitHubComment({
          anchor,
          body: trimmedMessage,
          commentKey: thread.comments[0]?.id ?? thread.id,
          githubComments,
          itemId,
          thread,
          viewer,
        });
        return;
      }

      const updatedItem = updateViewerDiffItem(viewer, itemId, (item) => {
        if (item.annotations == null) {
          return false;
        }

        const nextAnnotations: DiffLineAnnotation<CommentMetadata>[] =
          item.annotations.map((annotation) => {
            if (
              annotation.metadata.key !== key ||
              !isDraftAnnotation(annotation)
            ) {
              return annotation;
            }

            return {
              ...annotation,
              metadata: {
                kind: 'saved',
                key,
                author,
                avatarUrl: authorAvatarUrl,
                message: trimmedMessage,
                range: annotation.metadata.range,
              },
            };
          });

        let didChange = false;
        for (let index = 0; index < nextAnnotations.length; index++) {
          if (nextAnnotations[index] !== item.annotations[index]) {
            didChange = true;
            break;
          }
        }

        if (!didChange) {
          return false;
        }

        item.annotations = nextAnnotations;
        return true;
      });

      if (updatedItem == null) {
        return;
      }

      const { current: activeDraft } = activeDraftRef;
      if (activeDraft?.itemId === itemId && activeDraft.key === key) {
        activeDraftRef.current = null;
      }

      setSelectedLines(null);
      onLineLinkChange(null);
      onCommentSaved({
        author,
        avatarUrl: authorAvatarUrl,
        itemId,
        key,
        lineNumber: draftAnnotation.lineNumber,
        lineType: classifyCommentLineType(
          item.fileDiff,
          draftAnnotation.side,
          draftAnnotation.lineNumber
        ),
        message: trimmedMessage,
        range: draftAnnotation.metadata.range,
        side: draftAnnotation.side,
      });
    }
  );

  const handleGitHubReply = useStableCallback(
    (
      itemId: string,
      annotation: DiffLineAnnotation<CommentMetadata>,
      body: string
    ) => {
      if (!isGitHubThreadAnnotation(annotation) || githubComments == null) {
        return;
      }
      const rootComment = annotation.metadata.thread.comments[0];
      if (rootComment == null) return;
      const optimisticComment = createOptimisticComment({
        author: githubViewer ?? rootComment.author,
        body,
      });
      const optimisticThread = {
        ...annotation.metadata.thread,
        comments: [...annotation.metadata.thread.comments, optimisticComment],
      };
      const { current: viewer } = viewerRef;
      if (viewer == null) return;
      updateGitHubThreadAnnotation(viewer, itemId, optimisticThread);
      if (rootComment.databaseId == null) {
        markGitHubCommentFailed(
          viewer,
          itemId,
          optimisticThread,
          optimisticComment.id
        );
        return;
      }
      void githubComments.reply(rootComment, body).then((result) => {
        if (!result.ok) {
          markGitHubCommentFailed(
            viewer,
            itemId,
            optimisticThread,
            optimisticComment.id
          );
          toast.error(result.message);
          return;
        }
        replaceGitHubComment(
          viewer,
          itemId,
          optimisticThread,
          optimisticComment.id,
          result.comment
        );
      });
    }
  );

  const handleGitHubToggleResolved = useStableCallback(
    (itemId: string, annotation: DiffLineAnnotation<CommentMetadata>) => {
      if (!isGitHubThreadAnnotation(annotation) || githubComments == null) {
        return;
      }
      const { current: viewer } = viewerRef;
      if (viewer == null) return;
      const previousThread = annotation.metadata.thread;
      const nextThread = {
        ...previousThread,
        isResolved: !previousThread.isResolved,
      };
      updateGitHubThreadAnnotation(viewer, itemId, nextThread);
      const request = previousThread.isResolved
        ? githubComments.unresolveThread(previousThread)
        : githubComments.resolveThread(previousThread);
      void request.then((result) => {
        if (!result.ok) {
          updateGitHubThreadAnnotation(viewer, itemId, previousThread);
          toast.error(result.message);
        }
      });
    }
  );

  const handleGitHubReaction = useStableCallback(
    (
      itemId: string,
      annotation: DiffLineAnnotation<CommentMetadata>,
      comment: GitHubInlineComment,
      content: GitHubReactionContent,
      active: boolean
    ) => {
      if (!isGitHubThreadAnnotation(annotation) || githubComments == null) {
        return;
      }
      const { current: viewer } = viewerRef;
      if (viewer == null || comment.databaseId == null) return;
      const previousThread = annotation.metadata.thread;
      const optimisticThread = updateCommentReactions(
        previousThread,
        comment.id,
        content,
        active
      );
      updateGitHubThreadAnnotation(viewer, itemId, optimisticThread);
      const request = active
        ? githubComments.addReaction(comment, content)
        : githubComments.removeReaction(comment, content);
      void request.then((result) => {
        if (!result.ok) {
          updateGitHubThreadAnnotation(viewer, itemId, previousThread);
          toast.error(result.message);
          return;
        }
        replaceGitHubCommentReactions(
          viewer,
          itemId,
          optimisticThread,
          comment.id,
          result.reactions
        );
      });
    }
  );

  const handleToggleItemCollapsed = useStableCallback((itemId: string) => {
    const { current: viewerHandle } = viewerRef;
    const viewer = viewerHandle?.getInstance();
    const item = viewerHandle?.getItem(itemId);
    if (viewerHandle == null || viewer == null || item == null) {
      return;
    }

    // NOTE(amadeus): If the top of the item is before the scrollTop, then
    // we'll want to apply a scroll fix on the next render to ensure we
    // keep the collapsed file in view and anchored.
    const itemTop = viewer.getTopForItem(itemId);
    item.collapsed = item.collapsed !== true;
    item.version = getNextItemVersion(item);
    if (!viewerHandle.updateItem(item)) {
      return;
    }

    if (itemTop != null && itemTop < viewer.getScrollTop()) {
      viewer.scrollTo({
        type: 'item',
        id: item.id,
        align: 'start',
      });
    }
  });

  const renderCommentAnnotation = useStableCallback(
    (
      annotation:
        | DiffLineAnnotation<CommentMetadata>
        | LineAnnotation<CommentMetadata>,
      item: CodeViewItem<CommentMetadata>
    ) => {
      if (!('side' in annotation) || item.type !== 'diff') {
        return null;
      }

      if (isDraftAnnotation(annotation)) {
        return (
          <DraftAnnotation
            annotation={annotation}
            itemId={item.id}
            onCancel={handleRemoveComment}
            onSave={handleSaveDraftComment}
            authorAvatarUrl={defaultCommentAuthorAvatarUrl}
          />
        );
      }

      if (!isSavedAnnotation(annotation)) {
        if (isGitHubThreadAnnotation(annotation)) {
          return (
            <GitHubThreadAnnotation
              annotation={annotation}
              onAddReaction={(comment, content) =>
                handleGitHubReaction(
                  item.id,
                  annotation,
                  comment,
                  content,
                  true
                )
              }
              onRemoveReaction={(comment, content) =>
                handleGitHubReaction(
                  item.id,
                  annotation,
                  comment,
                  content,
                  false
                )
              }
              onReply={(body) => handleGitHubReply(item.id, annotation, body)}
              onRetry={(comment) => {
                if (
                  comment.body.trim().length === 0 ||
                  githubComments == null
                ) {
                  return;
                }
                const anchor = annotation.metadata.thread.anchor;
                void publishGitHubComment({
                  anchor,
                  body: comment.body,
                  commentKey: comment.id,
                  githubComments,
                  itemId: item.id,
                  thread: annotation.metadata.thread,
                  viewer: viewerRef.current,
                });
              }}
              onToggleResolved={() =>
                handleGitHubToggleResolved(item.id, annotation)
              }
            />
          );
        }
        return null;
      }

      return (
        <ExampleAnnotation
          annotation={annotation}
          itemId={item.id}
          onDelete={handleRemoveComment}
          onToggleSelection={handleToggleCommentSelection}
          authorAvatarUrl={defaultCommentAuthorAvatarUrl}
        />
      );
    }
  );

  const renderHeaderPrefix = useStableCallback(
    (item: CodeViewItem<CommentMetadata>) => {
      if (item.type !== 'diff') {
        return null;
      }

      return (
        <div className="flex items-center gap-1">
          <CollapseDiffButton
            disabled={
              item.fileDiff.splitLineCount === 0 &&
              item.fileDiff.unifiedLineCount === 0
            }
            collapsed={item.collapsed}
            onToggle={() => handleToggleItemCollapsed(item.id)}
          />
          {githubComments != null && (
            <FileCommentButton
              onCreate={() => handleCreateFileDraftComment(item.id)}
            />
          )}
        </div>
      );
    }
  );

  // NOTE(amadeus): For some insane reason, the react compiler did not know how
  // to properly memoize this, so we pulled it into a `useMemo` for safety...
  const options: CodeViewOptions<CommentMetadata> = useMemo(
    () =>
      ({
        // Use this to validate itemMetrics when changing layout with unsafeCSS.
        // __devOnlyValidateItemHeights: true,
        layout: CODE_VIEW_LAYOUT,
        themeType,
        diffStyle,
        diffIndicators,
        overflow,
        disableBackground: !showBackgrounds,
        disableLineNumbers: !lineNumbers,
        lineHoverHighlight: 'number',
        // hunkSeparators: 'line-info-basic',
        enableLineSelection: true,
        enableGutterUtility: true,
        stickyHeaders: true,
        unsafeCSS: CODE_VIEW_CUSTOM_CSS,
        // FIXME(amadeus): Move all `onX` methods onto the react component maybe?
        onGutterUtilityClick(range, context) {
          if (context.item.type !== 'diff') {
            return;
          }
          handleCreateDraftComment(range, context.item.id);
        },
        onLineSelectionEnd(range, context) {
          handleLineSelectionEnd(range, context.item);
        },
      }) satisfies CodeViewOptions<CommentMetadata>,
    [
      diffIndicators,
      diffStyle,
      handleCreateDraftComment,
      handleLineSelectionEnd,
      lineNumbers,
      overflow,
      showBackgrounds,
      themeType,
    ]
  );
  return (
    <ThemedCodeView<CommentMetadata>
      ref={handleViewerRef}
      containerRef={scrollRef}
      initialItems={initialItems}
      className={cn(
        className,
        'cv-scrollbar relative h-full min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-clip overscroll-contain border-b border-border w-full [contain:strict] [overflow-anchor:none] [will-change:scroll-position] md:border-b-0 [&_diffs-container]:overflow-clip [&_diffs-container]:[contain:layout_paint_style] [&_diffs-container]:shadow-[0_-1px_0_var(--diffshub-diff-separator,var(--color-border-opaque)),0_1px_0_var(--diffshub-diff-separator,var(--color-border-opaque))]'
      )}
      options={options}
      style={annotationThemeStyle}
      selectedLines={selectedLines}
      onSelectedLinesChange={handleSetSelection}
      renderAnnotation={renderCommentAnnotation}
      renderHeaderPrefix={renderHeaderPrefix}
    />
  );
});

function groupGitHubThreadsByItemId(
  threads: readonly GitHubInlineThread[],
  itemIdToFile: DiffsHubCommentFileByItemId
): Map<string, GitHubInlineThread[]> {
  const pathToItemId = new Map<string, string>();
  for (const [itemId, file] of itemIdToFile) {
    pathToItemId.set(file.path, itemId);
  }
  const groups = new Map<string, GitHubInlineThread[]>();
  for (const thread of threads) {
    const itemId = pathToItemId.get(thread.anchor.path);
    if (itemId == null) continue;
    const group = groups.get(itemId);
    if (group == null) {
      groups.set(itemId, [thread]);
    } else {
      group.push(thread);
    }
  }
  return groups;
}

function toGitHubThreadAnnotation(
  thread: GitHubInlineThread
): DiffLineAnnotation<CommentMetadata> | undefined {
  const range = rangeFromGitHubAnchor(thread.anchor);
  if (range == null) return undefined;
  const side = range.endSide ?? range.side;
  if (side == null) return undefined;
  const metadata: GitHubInlineThreadMetadata = {
    kind: 'github-thread',
    key: `github-${thread.id}`,
    range,
    thread,
  };
  return {
    lineNumber: range.end,
    side,
    metadata,
  };
}

function createGitHubAnchor(
  itemIdToFile: DiffsHubCommentFileByItemId | null,
  itemId: string,
  range: SelectedLineRange
): GitHubInlineCommentAnchor | undefined {
  const file = itemIdToFile?.get(itemId);
  if (file != null && range.start === 0 && range.end === 0) {
    return { kind: 'file', path: file.path };
  }
  const side = range.endSide ?? range.side;
  const startSide = range.side;
  if (file == null || side == null || startSide == null) return undefined;
  return {
    kind: 'line',
    path: file.path,
    line: range.end,
    side: sideToGitHub(side),
    ...(range.start !== range.end || range.endSide != null
      ? {
          startLine: range.start,
          startSide: sideToGitHub(startSide),
        }
      : {}),
  };
}

function createOptimisticThread({
  anchor,
  author,
  body,
}: {
  anchor: GitHubInlineCommentAnchor;
  author: { avatarUrl?: string; login: string };
  body: string;
}): GitHubInlineThread {
  const id = `optimistic-thread-${Date.now()}`;
  return {
    anchor,
    comments: [createOptimisticComment({ author, body })],
    id,
    isCollapsed: false,
    isResolved: false,
    optimistic: true,
  };
}

function createOptimisticComment({
  author,
  body,
}: {
  author: { avatarUrl?: string; login: string };
  body: string;
}): GitHubInlineComment {
  return {
    author,
    body,
    bodyHTML: '',
    createdAt: new Date().toISOString(),
    id: `optimistic-comment-${Date.now()}-${Math.random()}`,
    optimistic: true,
    reactions: [],
    updatedAt: new Date().toISOString(),
  };
}

function updateGitHubThreadAnnotation(
  viewer: CodeViewHandle<CommentMetadata> | null,
  itemId: string,
  thread: GitHubInlineThread
): void {
  if (viewer == null) return;
  updateViewerDiffItem(viewer, itemId, (item) => {
    const annotation = toGitHubThreadAnnotation(thread);
    if (annotation == null) return false;
    const next = (item.annotations ?? []).filter(
      (current) =>
        !isGitHubThreadAnnotation(current) ||
        current.metadata.thread.id !== thread.id
    );
    item.annotations = [...next, annotation];
    return true;
  });
}

async function publishGitHubComment({
  anchor,
  body,
  commentKey,
  githubComments,
  itemId,
  thread,
  viewer,
}: {
  anchor: GitHubInlineCommentAnchor;
  body: string;
  commentKey: string;
  githubComments: GitHubInlineCommentsClient;
  itemId: string;
  thread: GitHubInlineThread;
  viewer: CodeViewHandle<CommentMetadata> | null;
}) {
  const result = await githubComments.createComment(anchor, body);
  if (!result.ok) {
    markGitHubCommentFailed(viewer, itemId, thread, commentKey);
    toast.error(result.message);
    return;
  }
  if (result.thread != null) {
    replaceGitHubThread(viewer, itemId, thread.id, result.thread);
    return;
  }
  replaceGitHubComment(viewer, itemId, thread, commentKey, result.comment);
}

function markGitHubCommentFailed(
  viewer: CodeViewHandle<CommentMetadata> | null,
  itemId: string,
  thread: GitHubInlineThread,
  commentId: string
): void {
  updateGitHubThreadAnnotation(viewer, itemId, {
    ...thread,
    comments: thread.comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, failed: true, optimistic: false }
        : comment
    ),
  });
}

function replaceGitHubComment(
  viewer: CodeViewHandle<CommentMetadata> | null,
  itemId: string,
  thread: GitHubInlineThread,
  commentId: string,
  replacement: GitHubInlineComment
): void {
  updateGitHubThreadAnnotation(viewer, itemId, {
    ...thread,
    optimistic: false,
    comments: thread.comments.map((comment) =>
      comment.id === commentId ? replacement : comment
    ),
  });
}

function replaceGitHubThread(
  viewer: CodeViewHandle<CommentMetadata> | null,
  itemId: string,
  oldThreadId: string,
  replacement: GitHubInlineThread
): void {
  if (viewer == null) return;
  updateViewerDiffItem(viewer, itemId, (item) => {
    item.annotations = (item.annotations ?? []).filter(
      (annotation) =>
        !isGitHubThreadAnnotation(annotation) ||
        annotation.metadata.thread.id !== oldThreadId
    );
    const annotation = toGitHubThreadAnnotation(replacement);
    if (annotation == null) return true;
    item.annotations = [...item.annotations, annotation];
    return true;
  });
}

function updateCommentReactions(
  thread: GitHubInlineThread,
  commentId: string,
  content: GitHubReactionContent,
  add: boolean
): GitHubInlineThread {
  return {
    ...thread,
    comments: thread.comments.map((comment) => {
      if (comment.id !== commentId) return comment;
      const groups = [...comment.reactions];
      const index = groups.findIndex((group) => group.content === content);
      const current = groups[index] ?? {
        content,
        count: 0,
        viewerHasReacted: false,
      };
      const next = {
        ...current,
        count: Math.max(0, current.count + (add ? 1 : -1)),
        viewerHasReacted: add,
      };
      if (index === -1) groups.push(next);
      else groups[index] = next;
      return {
        ...comment,
        reactions: groups.filter((group) => group.count > 0),
      };
    }),
  };
}

function replaceGitHubCommentReactions(
  viewer: CodeViewHandle<CommentMetadata> | null,
  itemId: string,
  thread: GitHubInlineThread,
  commentId: string,
  reactions: GitHubInlineComment['reactions']
): void {
  updateGitHubThreadAnnotation(viewer, itemId, {
    ...thread,
    comments: thread.comments.map((comment) =>
      comment.id === commentId ? { ...comment, reactions } : comment
    ),
  });
}

interface CollapseDiffButtonProps {
  disabled?: boolean;
  collapsed?: boolean;
  onToggle(): void;
}

function CollapseDiffButton({
  disabled = false,
  collapsed = false,
  onToggle,
}: CollapseDiffButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={!disabled && !collapsed}
      aria-hidden={disabled}
      aria-label={
        disabled ? undefined : collapsed ? 'Expand diff' : 'Collapse diff'
      }
      className="text-muted-foreground hover:bg-muted hover:text-foreground ml-[-8px] inline-flex size-6 cursor-pointer items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-50"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <IconChevronSm
        aria-hidden="true"
        className={cn(
          'size-4 transition-transform',
          (disabled || collapsed) && '-rotate-90'
        )}
      />
    </button>
  );
}

function FileCommentButton({ onCreate }: { onCreate(): void }) {
  return (
    <button
      type="button"
      aria-label="Add file comment"
      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-6 cursor-pointer items-center justify-center rounded-md transition"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCreate();
      }}
    >
      <IconPlus aria-hidden="true" className="size-4" />
    </button>
  );
}
