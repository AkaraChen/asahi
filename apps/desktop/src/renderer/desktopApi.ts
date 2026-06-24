import type {
  DesktopListOwnerRepositoriesRequest,
  DesktopListPullRequestsRequest,
  DesktopPullRequestResult,
  DesktopRepositoriesResult,
  DesktopRepositoryOwnersResult,
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
