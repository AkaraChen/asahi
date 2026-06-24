import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import escapeHtml from 'escape-html';
import pLimit from 'p-limit';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const MERGE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN']);
const PULL_REQUEST_FETCH_CONCURRENCY = 4;
const GITHUB_REACTION_CONTENTS = [
  '+1',
  '-1',
  'laugh',
  'confused',
  'heart',
  'hooray',
  'rocket',
  'eyes',
] as const;

const PULL_REQUESTS_QUERY = `
  query($owner: String!, $name: String!, $after: String) {
    viewer {
      avatarUrl
    }
    repository(owner: $owner, name: $name) {
      nameWithOwner
      viewerPermission
      pullRequests(
        first: 100
        after: $after
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { endCursor hasNextPage }
        nodes {
          id
          isDraft
          mergeStateStatus
          number
          reviewDecision
          bodyHTML
          title
          updatedAt
          url
        }
      }
    }
  }
`;

const PULL_REQUEST_THREADS_QUERY = `
  query($owner: String!, $name: String!, $number: Int!, $after: String) {
    viewer {
      login
      avatarUrl
    }
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          pageInfo { endCursor hasNextPage }
          nodes {
            id
            isCollapsed
            isResolved
            path
            startLine
            startDiffSide
            line
            diffSide
            comments(first: 100) {
              nodes {
                id
                databaseId
                body
                bodyHTML
                createdAt
                updatedAt
                url
                author {
                  login
                  avatarUrl
                }
                reactionGroups {
                  content
                  viewerHasReacted
                  users { totalCount }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export type DesktopRepositoryPermission = 'WRITE' | 'MAINTAIN' | 'ADMIN';

export type DesktopPullRequestReviewDecision =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REVIEW_REQUIRED'
  | null;

export type DesktopGitHubReactionContent =
  (typeof GITHUB_REACTION_CONTENTS)[number];

export type DesktopGitHubInlineCommentSide = 'LEFT' | 'RIGHT';

export type DesktopGitHubInlineCommentAnchor =
  | {
      kind: 'line';
      path: string;
      line: number;
      side: DesktopGitHubInlineCommentSide;
      startLine?: number;
      startSide?: DesktopGitHubInlineCommentSide;
    }
  | {
      kind: 'file';
      path: string;
    };

export interface DesktopGitHubCommentAuthor {
  avatarUrl?: string;
  login: string;
}

export interface DesktopGitHubReactionGroup {
  content: DesktopGitHubReactionContent;
  count: number;
  viewerHasReacted: boolean;
}

export interface DesktopGitHubInlineComment {
  author: DesktopGitHubCommentAuthor;
  body: string;
  bodyHTML: string;
  createdAt: string;
  databaseId?: number;
  id: string;
  reactions: DesktopGitHubReactionGroup[];
  updatedAt: string;
  url: string;
}

export interface DesktopGitHubInlineThread {
  anchor: DesktopGitHubInlineCommentAnchor;
  comments: DesktopGitHubInlineComment[];
  id: string;
  isCollapsed: boolean;
  isResolved: boolean;
}

export interface DesktopRepositoryOwner {
  avatarUrl: string;
  login: string;
  name: string | null;
  type: 'personal' | 'organization';
}

export interface DesktopRepository {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  isPrivate: boolean;
  viewerPermission: DesktopRepositoryPermission;
}

const repositoryName = z.string().min(1);

export const DesktopSelectedRepositorySchema = z
  .object({
    owner: repositoryName,
    name: repositoryName,
    nameWithOwner: repositoryName,
  })
  .refine(
    (repository) =>
      repository.nameWithOwner === `${repository.owner}/${repository.name}`,
    { message: 'nameWithOwner must match owner/name' }
  );

export type DesktopSelectedRepository = z.infer<
  typeof DesktopSelectedRepositorySchema
>;

export interface DesktopPullRequest {
  id: string;
  title: string;
  repository: string;
  owner: string;
  repo: string;
  bodyHTML?: string;
  viewerAvatarUrl?: string;
  number: number;
  url: string;
  viewerPath: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: DesktopPullRequestReviewDecision;
  mergeStateStatus: string | null;
  viewerPermission: DesktopRepositoryPermission;
}

export const DesktopListOwnerRepositoriesRequestSchema = z.object({
  owner: repositoryName,
  ownerType: z.enum(['personal', 'organization']),
});

export type DesktopListOwnerRepositoriesRequest = z.infer<
  typeof DesktopListOwnerRepositoriesRequestSchema
>;

export const DesktopListPullRequestsRequestSchema = z.object({
  repositories: z.array(DesktopSelectedRepositorySchema),
});

export type DesktopListPullRequestsRequest = z.infer<
  typeof DesktopListPullRequestsRequestSchema
>;

const pullRequestNumber = z.number().int().positive();
const githubNodeId = z.string().min(1);
const githubCommentDatabaseId = z.number().int().positive();
const githubReactionContent = z.enum(GITHUB_REACTION_CONTENTS);
const githubCommentSide = z.enum(['LEFT', 'RIGHT']);
const githubInlineCommentAnchor = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('line'),
    path: repositoryName,
    line: pullRequestNumber,
    side: githubCommentSide,
    startLine: pullRequestNumber.optional(),
    startSide: githubCommentSide.optional(),
  }),
  z.object({
    kind: z.literal('file'),
    path: repositoryName,
  }),
]);

export const DesktopPullRequestReferenceSchema = z.object({
  owner: repositoryName,
  repo: repositoryName,
  number: pullRequestNumber,
});

export type DesktopPullRequestReference = z.infer<
  typeof DesktopPullRequestReferenceSchema
>;

export const DesktopListInlineThreadsRequestSchema =
  DesktopPullRequestReferenceSchema;

export type DesktopListInlineThreadsRequest = z.infer<
  typeof DesktopListInlineThreadsRequestSchema
>;

export const DesktopCreateInlineCommentRequestSchema =
  DesktopPullRequestReferenceSchema.extend({
    anchor: githubInlineCommentAnchor,
    body: z.string().trim().min(1),
  });

export type DesktopCreateInlineCommentRequest = z.infer<
  typeof DesktopCreateInlineCommentRequestSchema
>;

export const DesktopReplyInlineCommentRequestSchema =
  DesktopPullRequestReferenceSchema.extend({
    body: z.string().trim().min(1),
    inReplyTo: githubCommentDatabaseId,
  });

export type DesktopReplyInlineCommentRequest = z.infer<
  typeof DesktopReplyInlineCommentRequestSchema
>;

export const DesktopResolveInlineThreadRequestSchema = z.object({
  threadId: githubNodeId,
});

export type DesktopResolveInlineThreadRequest = z.infer<
  typeof DesktopResolveInlineThreadRequestSchema
>;

export const DesktopInlineCommentReactionRequestSchema =
  DesktopPullRequestReferenceSchema.extend({
    commentId: githubCommentDatabaseId,
    content: githubReactionContent,
  });

export type DesktopInlineCommentReactionRequest = z.infer<
  typeof DesktopInlineCommentReactionRequestSchema
>;

export type DesktopGitHubFailure = {
  ok: false;
  error: 'gh-not-found' | 'gh-auth-required' | 'gh-api-failed' | 'parse-failed';
  message: string;
};

export type DesktopRepositoryOwnersResult =
  | {
      ok: true;
      owners: DesktopRepositoryOwner[];
    }
  | DesktopGitHubFailure;

export type DesktopRepositoriesResult =
  | {
      ok: true;
      items: DesktopRepository[];
    }
  | DesktopGitHubFailure;

export type DesktopPullRequestResult =
  | {
      ok: true;
      items: DesktopPullRequest[];
      fetchedAt: string;
    }
  | DesktopGitHubFailure;

export type DesktopInlineThreadsResult =
  | {
      ok: true;
      items: DesktopGitHubInlineThread[];
      viewer: DesktopGitHubCommentAuthor | null;
      fetchedAt: string;
    }
  | DesktopGitHubFailure;

export type DesktopInlineCommentResult =
  | {
      ok: true;
      comment: DesktopGitHubInlineComment;
      thread?: DesktopGitHubInlineThread;
    }
  | DesktopGitHubFailure;

export type DesktopInlineThreadMutationResult =
  | {
      ok: true;
      threadId: string;
    }
  | DesktopGitHubFailure;

export type DesktopInlineCommentReactionResult =
  | {
      ok: true;
      reactions: DesktopGitHubReactionGroup[];
    }
  | DesktopGitHubFailure;

type PageInfo = { endCursor: string | null; hasNextPage: boolean };
type GitHubPermission = DesktopRepositoryPermission | 'READ' | 'TRIAGE';

type GitHubRestRepository = {
  id: string;
  name: string;
  full_name: string;
  private: boolean;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
  };
};

type PullRequestNode = Omit<
  DesktopPullRequest,
  'owner' | 'repo' | 'repository' | 'viewerPath' | 'viewerPermission'
>;

type PullRequestConnection = {
  pageInfo: PageInfo;
  nodes: PullRequestNode[];
};

type GitHubInlineCommentNode = {
  author: { login: string; avatarUrl?: string | null } | null;
  body: string;
  bodyHTML: string;
  createdAt: string;
  databaseId: number | null;
  id: string;
  reactionGroups: {
    content: string;
    users: { totalCount: number };
    viewerHasReacted: boolean;
  }[];
  updatedAt: string;
  url: string;
};

type GitHubInlineThreadNode = {
  comments: {
    nodes: GitHubInlineCommentNode[];
  };
  diffSide: 'LEFT' | 'RIGHT' | null;
  id: string;
  isCollapsed: boolean;
  isResolved: boolean;
  line: number | null;
  path: string;
  startDiffSide: 'LEFT' | 'RIGHT' | null;
  startLine: number | null;
};

type GitHubRestReviewComment = {
  author_association?: string;
  body: string;
  body_html?: string;
  created_at: string;
  html_url: string;
  id: number;
  node_id: string;
  reactions?: GitHubRestReactionSummary;
  updated_at: string;
  user: { avatar_url?: string | null; login: string } | null;
};

type GitHubRestReaction = {
  content: DesktopGitHubReactionContent;
  id: number;
  user?: { login: string } | null;
};

type GitHubRestReactionSummary = Partial<
  Record<DesktopGitHubReactionContent, number>
> & {
  '+1'?: number;
  '-1'?: number;
};

type RestOptions = {
  accept?: string;
  body?: unknown;
  method?: 'GET' | 'POST' | 'DELETE';
};

export async function listGitHubRepositoryOwners(): Promise<DesktopRepositoryOwnersResult> {
  try {
    const [viewer, organizations] = await Promise.all([
      rest<{ avatar_url: string; login: string; name: string | null }>('user'),
      rest<{ avatar_url: string; login: string; description: string | null }[]>(
        'user/orgs?per_page=100'
      ),
    ]);

    return {
      ok: true,
      owners: [
        {
          avatarUrl: viewer.avatar_url,
          login: viewer.login,
          name: viewer.name,
          type: 'personal',
        },
        ...organizations.map((organization) => ({
          avatarUrl: organization.avatar_url,
          login: organization.login,
          name: organization.description,
          type: 'organization' as const,
        })),
      ],
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function listGitHubOwnerRepositories(
  request: DesktopListOwnerRepositoriesRequest
): Promise<DesktopRepositoriesResult> {
  try {
    const repositories = await loadOwnerRepositories(request);
    const items = repositories
      .map(toDesktopRepository)
      .filter((repository) => repository != null);

    return {
      ok: true,
      items,
    };
  } catch (error) {
    return mapGhError(error);
  }
}

async function loadOwnerRepositories(
  request: DesktopListOwnerRepositoriesRequest
): Promise<GitHubRestRepository[]> {
  const endpoint =
    request.ownerType === 'personal'
      ? 'user/repos?affiliation=owner&visibility=all&sort=pushed'
      : `orgs/${encodeURIComponent(request.owner)}/repos?type=all&sort=pushed`;
  return rest<GitHubRestRepository[]>(endpoint);
}

export async function listGitHubPullRequestsForRepositories(
  request: DesktopListPullRequestsRequest
): Promise<DesktopPullRequestResult> {
  try {
    const limit = pLimit(PULL_REQUEST_FETCH_CONCURRENCY);
    const results = await Promise.all(
      request.repositories.map((repository) =>
        limit(() => loadPullRequestsForRepository(repository))
      )
    );

    return {
      ok: true,
      items: results
        .flat()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function listGitHubInlineThreads(
  request: DesktopListInlineThreadsRequest
): Promise<DesktopInlineThreadsResult> {
  try {
    const items: DesktopGitHubInlineThread[] = [];
    let after: string | undefined;
    let viewer: DesktopGitHubCommentAuthor | null = null;

    for (;;) {
      const response = await graphql<{
        data: {
          viewer: { avatarUrl?: string | null; login: string } | null;
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: PageInfo;
                nodes: GitHubInlineThreadNode[];
              };
            } | null;
          } | null;
        };
      }>(PULL_REQUEST_THREADS_QUERY, {
        owner: request.owner,
        name: request.repo,
        number: String(request.number),
        after,
      });

      if (viewer == null && response.data.viewer != null) {
        viewer = {
          login: response.data.viewer.login,
          ...(response.data.viewer.avatarUrl == null
            ? {}
            : { avatarUrl: response.data.viewer.avatarUrl }),
        };
      }

      const connection = response.data.repository?.pullRequest?.reviewThreads;
      if (connection == null) {
        return { ok: true, items, viewer, fetchedAt: new Date().toISOString() };
      }

      items.push(...connection.nodes.map(toDesktopInlineThread));

      if (!connection.pageInfo.hasNextPage) break;
      after = connection.pageInfo.endCursor ?? undefined;
      if (after == null) break;
    }

    return {
      ok: true,
      items,
      viewer,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function createGitHubInlineComment(
  request: DesktopCreateInlineCommentRequest
): Promise<DesktopInlineCommentResult> {
  try {
    const pullRequest = await rest<{ head: { sha: string } }>(
      `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
        request.repo
      )}/pulls/${request.number}`
    );
    const payload = {
      body: request.body,
      commit_id: pullRequest.head.sha,
      path: request.anchor.path,
      ...toRestCommentAnchor(request.anchor),
    };
    const comment = await rest<GitHubRestReviewComment>(
      `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
        request.repo
      )}/pulls/${request.number}/comments`,
      {
        method: 'POST',
        body: payload,
        accept: 'application/vnd.github-commitcomment.full+json',
      }
    );

    return {
      ok: true,
      comment: toDesktopInlineComment(comment),
      thread: await findGitHubInlineThreadByCommentNodeId(
        request,
        comment.node_id
      ),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function replyToGitHubInlineComment(
  request: DesktopReplyInlineCommentRequest
): Promise<DesktopInlineCommentResult> {
  try {
    const comment = await rest<GitHubRestReviewComment>(
      `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
        request.repo
      )}/pulls/${request.number}/comments/${request.inReplyTo}/replies`,
      {
        method: 'POST',
        body: { body: request.body },
        accept: 'application/vnd.github-commitcomment.full+json',
      }
    );

    return {
      ok: true,
      comment: toDesktopInlineComment(comment),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function resolveGitHubInlineThread(
  request: DesktopResolveInlineThreadRequest
): Promise<DesktopInlineThreadMutationResult> {
  return mutateGitHubInlineThread(
    'mutation($threadId: ID!) { resolveReviewThread(input: { threadId: $threadId }) { thread { id } } }',
    request.threadId
  );
}

export async function unresolveGitHubInlineThread(
  request: DesktopResolveInlineThreadRequest
): Promise<DesktopInlineThreadMutationResult> {
  return mutateGitHubInlineThread(
    'mutation($threadId: ID!) { unresolveReviewThread(input: { threadId: $threadId }) { thread { id } } }',
    request.threadId
  );
}

export async function addGitHubInlineCommentReaction(
  request: DesktopInlineCommentReactionRequest
): Promise<DesktopInlineCommentReactionResult> {
  try {
    const viewer = await rest<{ login: string }>('user');
    await rest<unknown>(
      `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
        request.repo
      )}/pulls/comments/${request.commentId}/reactions`,
      { method: 'POST', body: { content: request.content } }
    );
    return {
      ok: true,
      reactions: await listGitHubInlineCommentReactionGroups(
        request,
        viewer.login
      ),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function removeGitHubInlineCommentReaction(
  request: DesktopInlineCommentReactionRequest
): Promise<DesktopInlineCommentReactionResult> {
  try {
    const viewer = await rest<{ login: string }>('user');
    const reactions = await rest<GitHubRestReaction[]>(
      `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
        request.repo
      )}/pulls/comments/${request.commentId}/reactions?per_page=100`
    );
    const reaction = reactions.find(
      (item) =>
        item.content === request.content && item.user?.login === viewer.login
    );
    if (reaction != null) {
      await rest<unknown>(
        `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
          request.repo
        )}/pulls/comments/${request.commentId}/reactions/${reaction.id}`,
        { method: 'DELETE' }
      );
    }
    return {
      ok: true,
      reactions: await listGitHubInlineCommentReactionGroups(
        request,
        viewer.login
      ),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

async function loadPullRequestsForRepository(
  repository: DesktopSelectedRepository
): Promise<DesktopPullRequest[]> {
  const items: DesktopPullRequest[] = [];
  let after: string | undefined;

  for (;;) {
    const response = await graphql<{
      data: {
        viewer: { avatarUrl: string } | null;
        repository: {
          nameWithOwner: string;
          viewerPermission: GitHubPermission;
          pullRequests: PullRequestConnection;
        } | null;
      };
    }>(PULL_REQUESTS_QUERY, {
      owner: repository.owner,
      name: repository.name,
      after,
    });
    const remoteRepository = response.data.repository;
    if (
      remoteRepository == null ||
      !MERGE_PERMISSIONS.has(remoteRepository.viewerPermission)
    ) {
      return [];
    }

    items.push(
      ...remoteRepository.pullRequests.nodes.map((pullRequest) =>
        toDesktopPullRequest(
          pullRequest,
          remoteRepository.nameWithOwner,
          response.data.viewer?.avatarUrl,
          remoteRepository.viewerPermission as DesktopRepositoryPermission
        )
      )
    );

    if (!remoteRepository.pullRequests.pageInfo.hasNextPage) break;
    after = remoteRepository.pullRequests.pageInfo.endCursor ?? undefined;
    if (after == null) break;
  }

  return items;
}

async function findGitHubInlineThreadByCommentNodeId(
  request: DesktopPullRequestReference,
  commentNodeId: string
): Promise<DesktopGitHubInlineThread | undefined> {
  const result = await listGitHubInlineThreads(request);
  if (!result.ok) {
    return undefined;
  }
  return result.items.find((thread) =>
    thread.comments.some((comment) => comment.id === commentNodeId)
  );
}

export function toDesktopInlineThread(
  thread: GitHubInlineThreadNode
): DesktopGitHubInlineThread {
  return {
    anchor: toDesktopInlineThreadAnchor(thread),
    comments: thread.comments.nodes.map(toDesktopInlineComment),
    id: thread.id,
    isCollapsed: thread.isCollapsed,
    isResolved: thread.isResolved,
  };
}

function toDesktopInlineThreadAnchor(
  thread: GitHubInlineThreadNode
): DesktopGitHubInlineCommentAnchor {
  if (thread.line != null && thread.diffSide != null) {
    return {
      kind: 'line',
      path: thread.path,
      line: thread.line,
      side: thread.diffSide,
      ...(thread.startLine == null ? {} : { startLine: thread.startLine }),
      ...(thread.startDiffSide == null
        ? {}
        : { startSide: thread.startDiffSide }),
    };
  }
  return { kind: 'file', path: thread.path };
}

function toDesktopInlineComment(
  comment: GitHubInlineCommentNode | GitHubRestReviewComment
): DesktopGitHubInlineComment {
  if ('createdAt' in comment) {
    return {
      author: toDesktopCommentAuthor(comment.author),
      body: comment.body,
      bodyHTML: comment.bodyHTML,
      createdAt: comment.createdAt,
      ...(comment.databaseId == null ? {} : { databaseId: comment.databaseId }),
      id: comment.id,
      reactions: toDesktopReactionGroups(comment.reactionGroups),
      updatedAt: comment.updatedAt,
      url: comment.url,
    };
  }

  return {
    author: toDesktopCommentAuthor(comment.user),
    body: comment.body,
    bodyHTML: comment.body_html ?? escapeHtml(comment.body),
    createdAt: comment.created_at,
    databaseId: comment.id,
    id: comment.node_id,
    reactions: restReactionSummaryToGroups(comment.reactions),
    updatedAt: comment.updated_at,
    url: comment.html_url,
  };
}

function toDesktopCommentAuthor(
  author:
    | { avatarUrl?: string | null; login: string }
    | { avatar_url?: string | null; login: string }
    | null
): DesktopGitHubCommentAuthor {
  if (author == null) {
    return { login: 'ghost' };
  }
  const avatarUrl = hasCamelAvatar(author)
    ? author.avatarUrl
    : author.avatar_url;
  return {
    login: author.login,
    ...(avatarUrl == null ? {} : { avatarUrl }),
  };
}

function toDesktopReactionGroups(
  groups: GitHubInlineCommentNode['reactionGroups']
): DesktopGitHubReactionGroup[] {
  return groups
    .map((group) => {
      const content = parseReactionContent(group.content);
      if (content == null) return undefined;
      return {
        content,
        count: group.users.totalCount,
        viewerHasReacted: group.viewerHasReacted,
      };
    })
    .filter((group) => group != null);
}

function restReactionSummaryToGroups(
  summary: GitHubRestReactionSummary | undefined
): DesktopGitHubReactionGroup[] {
  return GITHUB_REACTION_CONTENTS.map((content) => ({
    content,
    count: summary?.[content] ?? 0,
    viewerHasReacted: false,
  })).filter((group) => group.count > 0);
}

export function parseReactionContent(
  value: string
): DesktopGitHubReactionContent | undefined {
  switch (value) {
    case '+1':
    case 'THUMBS_UP':
      return '+1';
    case '-1':
    case 'THUMBS_DOWN':
      return '-1';
    case 'laugh':
    case 'LAUGH':
      return 'laugh';
    case 'confused':
    case 'CONFUSED':
      return 'confused';
    case 'heart':
    case 'HEART':
      return 'heart';
    case 'hooray':
    case 'HOORAY':
      return 'hooray';
    case 'rocket':
    case 'ROCKET':
      return 'rocket';
    case 'eyes':
    case 'EYES':
      return 'eyes';
    default:
      return undefined;
  }
}

function toRestCommentAnchor(
  anchor: DesktopGitHubInlineCommentAnchor
): Record<string, unknown> {
  if (anchor.kind === 'file') {
    return { subject_type: 'file' };
  }
  return {
    line: anchor.line,
    side: anchor.side,
    ...(anchor.startLine == null ? {} : { start_line: anchor.startLine }),
    ...(anchor.startSide == null ? {} : { start_side: anchor.startSide }),
  };
}

async function mutateGitHubInlineThread(
  mutation: string,
  threadId: string
): Promise<DesktopInlineThreadMutationResult> {
  try {
    await graphql<unknown>(mutation, { threadId });
    return { ok: true, threadId };
  } catch (error) {
    return mapGhError(error);
  }
}

async function listGitHubInlineCommentReactionGroups(
  request: DesktopInlineCommentReactionRequest,
  viewerLogin: string
): Promise<DesktopGitHubReactionGroup[]> {
  const reactions = await rest<GitHubRestReaction[]>(
    `repos/${encodeURIComponent(request.owner)}/${encodeURIComponent(
      request.repo
    )}/pulls/comments/${request.commentId}/reactions?per_page=100`
  );
  return GITHUB_REACTION_CONTENTS.map((content) => {
    const matching = reactions.filter(
      (reaction) => reaction.content === content
    );
    return {
      content,
      count: matching.length,
      viewerHasReacted: matching.some(
        (reaction) => reaction.user?.login === viewerLogin
      ),
    };
  }).filter((group) => group.count > 0);
}

export function toDesktopRepository(
  repository: GitHubRestRepository
): DesktopRepository | undefined {
  const viewerPermission = toDesktopRepositoryPermission(
    repository.permissions
  );
  if (viewerPermission == null) {
    return undefined;
  }
  const [owner] = repository.full_name.split('/');

  return {
    id: repository.id,
    owner,
    name: repository.name,
    nameWithOwner: repository.full_name,
    isPrivate: repository.private,
    viewerPermission,
  };
}

function toDesktopRepositoryPermission(
  permissions: GitHubRestRepository['permissions']
): DesktopRepositoryPermission | undefined {
  if (permissions?.admin) return 'ADMIN';
  if (permissions?.maintain) return 'MAINTAIN';
  if (permissions?.push) return 'WRITE';
  return undefined;
}

export function toDesktopPullRequest(
  pullRequest: PullRequestNode,
  repository: string,
  viewerAvatarUrl: string | undefined,
  viewerPermission: DesktopRepositoryPermission
): DesktopPullRequest {
  const [owner, repo] = repository.split('/');

  return {
    ...pullRequest,
    owner,
    repo,
    repository,
    viewerAvatarUrl,
    viewerPath: `/${owner}/${repo}/pull/${pullRequest.number}`,
    viewerPermission,
  };
}

async function graphql<T>(
  query: string,
  variables: Record<string, string | undefined> = {}
): Promise<T> {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value != null) args.push('-F', `${name}=${value}`);
  }

  const { stdout } = await execFileAsync('gh', args, {
    maxBuffer: 1024 * 1024 * 16,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as T;
}

async function rest<T>(
  endpoint: string,
  options: RestOptions = {}
): Promise<T> {
  const args = ['api', endpoint];
  if (options.method != null && options.method !== 'GET') {
    args.push('--method', options.method);
  }
  if (options.accept != null) {
    args.push('-H', `Accept: ${options.accept}`);
  }
  if (options.body != null) {
    args.push('--input', '-');
  }

  const stdout =
    options.body == null
      ? (
          await execFileAsync('gh', args, {
            maxBuffer: 1024 * 1024 * 16,
            timeout: 30_000,
          })
        ).stdout
      : await execGhWithInput(args, JSON.stringify(options.body));
  return stdout.trim().length === 0
    ? (undefined as T)
    : (JSON.parse(stdout) as T);
}

function hasCamelAvatar(
  author:
    | { avatarUrl?: string | null; login: string }
    | { avatar_url?: string | null; login: string }
): author is { avatarUrl?: string | null; login: string } {
  return 'avatarUrl' in author;
}

function execGhWithInput(args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('GitHub CLI request timed out.'));
    }, 30_000);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }
      const error = new Error('GitHub CLI failed.') as Error & {
        code?: number | string | null;
        stderr?: string;
      };
      error.code = code;
      error.stderr = Buffer.concat(stderr).toString('utf8');
      reject(error);
    });

    child.stdin.end(input);
  });
}

function mapGhError(error: unknown): DesktopGitHubFailure {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return {
      ok: false,
      error: 'gh-not-found',
      message: 'GitHub CLI is not installed or not available on PATH.',
    };
  }

  const maybeStderr =
    error instanceof Error
      ? (error as Error & { stderr?: unknown }).stderr
      : undefined;
  const stderr = typeof maybeStderr === 'string' ? maybeStderr : '';
  if (/auth login|not logged|authentication|HTTP 401/i.test(stderr)) {
    return {
      ok: false,
      error: 'gh-auth-required',
      message:
        'GitHub CLI is not authenticated. Run gh auth login and refresh.',
    };
  }

  if (error instanceof SyntaxError) {
    return {
      ok: false,
      error: 'parse-failed',
      message: 'GitHub CLI returned unreadable GitHub data.',
    };
  }

  return {
    ok: false,
    error: 'gh-api-failed',
    message: stderr.trim() || 'GitHub CLI failed to load GitHub data.',
  };
}
