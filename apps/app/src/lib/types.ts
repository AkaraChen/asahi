import type { AnnotationSide, SelectedLineRange } from '@pierre/diffs';
import type { GitStatusEntry } from '@pierre/trees';

export interface FileTreeGitStatusPatch {
  remove?: readonly string[];
  set?: readonly GitStatusEntry[];
}

export type ViewerLoadState =
  | 'fetching'
  | 'streaming'
  | 'parsing'
  | 'ready'
  | 'error';

export interface SavedCommentMetadata {
  kind: 'saved';
  key: string;
  author: string;
  avatarUrl?: string;
  message: string;
  range: SelectedLineRange;
}

export type GitHubInlineCommentSide = 'LEFT' | 'RIGHT';
export type GitHubReactionContent =
  | '+1'
  | '-1'
  | 'laugh'
  | 'confused'
  | 'heart'
  | 'hooray'
  | 'rocket'
  | 'eyes';

export type GitHubInlineCommentAnchor =
  | {
      kind: 'line';
      path: string;
      line: number;
      side: GitHubInlineCommentSide;
      startLine?: number;
      startSide?: GitHubInlineCommentSide;
    }
  | {
      kind: 'file';
      path: string;
    };

export interface GitHubCommentAuthor {
  avatarUrl?: string;
  login: string;
}

export interface GitHubReactionGroup {
  content: GitHubReactionContent;
  count: number;
  viewerHasReacted: boolean;
}

export interface GitHubInlineComment {
  author: GitHubCommentAuthor;
  body: string;
  bodyHTML: string;
  createdAt: string;
  databaseId?: number;
  id: string;
  optimistic?: boolean;
  failed?: boolean;
  reactions: GitHubReactionGroup[];
  updatedAt: string;
  url?: string;
}

export interface GitHubInlineThread {
  anchor: GitHubInlineCommentAnchor;
  comments: GitHubInlineComment[];
  id: string;
  isCollapsed: boolean;
  isResolved: boolean;
  optimistic?: boolean;
}

export interface GitHubInlineThreadMetadata {
  kind: 'github-thread';
  key: string;
  range: SelectedLineRange;
  thread: GitHubInlineThread;
}

export interface DraftCommentMetadata {
  kind: 'draft';
  key: string;
  message: string;
  range: SelectedLineRange;
}

export type CommentMetadata =
  | SavedCommentMetadata
  | DraftCommentMetadata
  | GitHubInlineThreadMetadata;

export interface GitHubInlineCommentsClient {
  addReaction(
    comment: GitHubInlineComment,
    content: GitHubReactionContent
  ): Promise<{ ok: true; reactions: GitHubReactionGroup[] } | { ok: false; message: string }>;
  createComment(
    anchor: GitHubInlineCommentAnchor,
    body: string
  ): Promise<
    | { ok: true; comment: GitHubInlineComment; thread?: GitHubInlineThread }
    | { ok: false; message: string }
  >;
  listThreads(): Promise<
    | {
        ok: true;
        items: GitHubInlineThread[];
        viewer: GitHubCommentAuthor | null;
      }
    | { ok: false; message: string }
  >;
  removeReaction(
    comment: GitHubInlineComment,
    content: GitHubReactionContent
  ): Promise<{ ok: true; reactions: GitHubReactionGroup[] } | { ok: false; message: string }>;
  reply(
    comment: GitHubInlineComment,
    body: string
  ): Promise<{ ok: true; comment: GitHubInlineComment } | { ok: false; message: string }>;
  resolveThread(
    thread: GitHubInlineThread
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  unresolveThread(
    thread: GitHubInlineThread
  ): Promise<{ ok: true } | { ok: false; message: string }>;
}

export interface DiffsHubCommentSidebarFile {
  fileOrder: number;
  path: string;
}

export type DiffsHubCommentFileByItemId = ReadonlyMap<
  string,
  DiffsHubCommentSidebarFile
>;

// Whether the line the comment is anchored to is a real addition/deletion or
// an unchanged context line shown in the diff. Tracked so the sidebar can
// render "Line N" without a misleading + / - sigil for context lines.
export type CommentLineType = 'change' | 'context';

export interface DiffsHubSavedCommentEvent {
  author: string;
  avatarUrl?: string;
  itemId: string;
  key: string;
  lineNumber: number;
  lineType: CommentLineType;
  message: string;
  range: SelectedLineRange;
  side: AnnotationSide;
}

export interface DiffsHubDeletedCommentEvent {
  itemId: string;
  key: string;
}

export interface DiffsHubSavedCommentEntry {
  author: string;
  avatarUrl?: string;
  itemId: string;
  key: string;
  lineNumber: number;
  lineType: CommentLineType;
  message: string;
  range: SelectedLineRange;
  side: AnnotationSide;
}

export interface DiffsHubSavedCommentItem {
  comments: DiffsHubSavedCommentEntry[];
  fileOrder: number;
  itemId: string;
  path: string;
}

export type DiffsHubThreadSidebarAnchor =
  | {
      kind: 'file';
    }
  | {
      kind: 'line';
      lineNumber: number;
      side: AnnotationSide;
    };

export interface DiffsHubThreadSidebarEntry {
  anchor: DiffsHubThreadSidebarAnchor;
  author: string;
  avatarUrl?: string;
  body: string;
  bodyHTML: string;
  commentCount: number;
  fileOrder: number;
  isResolved: boolean;
  itemId: string;
  key: string;
  path: string;
  range: SelectedLineRange;
  thread: GitHubInlineThread;
}

export interface DiffsHubThreadSidebarItem {
  fileOrder: number;
  itemId: string;
  path: string;
  threads: DiffsHubThreadSidebarEntry[];
}

// The fully pre-computed input this tree needs for a given fetch. It is built
// once at fetch time by snapshotDiffsHubTreeSource and stored alongside the
// viewer items, so later per-item annotation updates do not feed into the
// tree and do not cause it to rebuild.
//
// Streamed publishes link successive snapshots through `previousSource` so the
// tree consumer can recognize append-only growth and apply the delta as
// `model.batch` adds instead of rebuilding the entire path store. The link is
// present only on snapshots that share the same underlying accumulator; the
// initial publish and any non-streamed source leave it undefined and force a
// full reset.
//
// `paths` and `pathToItemId` may alias the live accumulator state for
// streamed sources, so consumers must treat them as read-only and must use
// `pathCount` (captured at snapshot time) as the exclusive upper bound when
// iterating `paths`. The `readonly` markers and ReadonlyMap type enforce the
// read-only side; pathCount is what keeps later in-place growth invisible to
// this snapshot.
export interface DiffsHubFileTreeSource {
  gitStatus: readonly GitStatusEntry[];
  gitStatusPatch?: FileTreeGitStatusPatch;
  pathCount: number;
  paths: readonly string[];
  pathToItemId: ReadonlyMap<string, string>;
  previousSource?: DiffsHubFileTreeSource;
}

export interface DiffsHubDiffStats {
  addedLines: number;
  deletedLines: number;
  fileCount: number;
  totalLinesOfCode: number;
}
