import type {
  DesktopListOwnerRepositoriesRequest,
  DesktopListInlineThreadsRequest,
  DesktopListPullRequestsRequest,
  DesktopCreateInlineCommentRequest,
  DesktopInlineCommentReactionRequest,
  DesktopInlineCommentReactionResult,
  DesktopInlineCommentResult,
  DesktopInlineThreadsResult,
  DesktopInlineThreadMutationResult,
  DesktopPullRequestResult,
  DesktopReplyInlineCommentRequest,
  DesktopRepositoriesResult,
  DesktopRepositoryOwnersResult,
  DesktopResolveInlineThreadRequest,
} from '../shared/githubPullRequests';

export function listRepositoryOwners(): Promise<DesktopRepositoryOwnersResult> {
  return desktopApi('/api/github/repository-owners');
}

export function listOwnerRepositories(
  request: DesktopListOwnerRepositoriesRequest
): Promise<DesktopRepositoriesResult> {
  return desktopApi('/api/github/owner-repositories', request);
}

export function listRepositoryPullRequests(
  request: DesktopListPullRequestsRequest
): Promise<DesktopPullRequestResult> {
  return desktopApi('/api/github/repository-pull-requests', request);
}

export function listInlineThreads(
  request: DesktopListInlineThreadsRequest
): Promise<DesktopInlineThreadsResult> {
  return desktopApi('/api/github/inline-threads', request);
}

export function createInlineComment(
  request: DesktopCreateInlineCommentRequest
): Promise<DesktopInlineCommentResult> {
  return desktopApi('/api/github/inline-comments', request);
}

export function replyInlineComment(
  request: DesktopReplyInlineCommentRequest
): Promise<DesktopInlineCommentResult> {
  return desktopApi('/api/github/inline-comments/replies', request);
}

export function resolveInlineThread(
  request: DesktopResolveInlineThreadRequest
): Promise<DesktopInlineThreadMutationResult> {
  return desktopApi('/api/github/inline-threads/resolve', request);
}

export function unresolveInlineThread(
  request: DesktopResolveInlineThreadRequest
): Promise<DesktopInlineThreadMutationResult> {
  return desktopApi('/api/github/inline-threads/unresolve', request);
}

export function addInlineCommentReaction(
  request: DesktopInlineCommentReactionRequest
): Promise<DesktopInlineCommentReactionResult> {
  return desktopApi('/api/github/inline-comment-reactions/add', request);
}

export function removeInlineCommentReaction(
  request: DesktopInlineCommentReactionRequest
): Promise<DesktopInlineCommentReactionResult> {
  return desktopApi('/api/github/inline-comment-reactions/remove', request);
}

async function desktopApi<T>(path: string, body?: unknown): Promise<T> {
  const [baseURL, accessToken] = await Promise.all([
    window.asahi.getApiBaseURL(),
    window.asahi.getApiAccessToken(),
  ]);
  const response = await fetch(new URL(path, baseURL), {
    body: body == null ? undefined : JSON.stringify(body),
    headers: {
      [accessToken.header]: accessToken.token,
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    method: body == null ? 'GET' : 'POST',
  });
  if (!response.ok) {
    throw new Error(`Desktop API failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
