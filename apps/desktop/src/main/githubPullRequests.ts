import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  DesktopPullRequest,
  DesktopPullRequestResult,
  DesktopPullRequestReviewDecision,
} from '../shared/githubPullRequests';

const execFileAsync = promisify(execFile);
const REPOSITORIES_PER_PAGE = 50;
const PULL_REQUESTS_PER_REPOSITORY = 100;
const MERGE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN']);

const LIST_MERGEABLE_PULL_REQUESTS_QUERY = `
  query ListMergeablePullRequests($after: String) {
    viewer {
      repositories(
        first: ${REPOSITORIES_PER_PAGE}
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        isArchived: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo {
          endCursor
          hasNextPage
        }
        nodes {
          nameWithOwner
          viewerPermission
          pullRequests(
            first: ${PULL_REQUESTS_PER_REPOSITORY}
            states: OPEN
            orderBy: { field: UPDATED_AT, direction: DESC }
          ) {
            nodes {
              id
              isDraft
              mergeStateStatus
              number
              reviewDecision
              title
              updatedAt
              url
              repository {
                nameWithOwner
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLResponse {
  data?: {
    viewer?: {
      repositories?: {
        pageInfo?: {
          endCursor?: unknown;
          hasNextPage?: unknown;
        };
        nodes?: unknown;
      };
    };
  };
}

interface GraphQLRepository {
  nameWithOwner?: unknown;
  viewerPermission?: unknown;
  pullRequests?: {
    nodes?: unknown;
  };
}

interface GraphQLPullRequest {
  id?: unknown;
  isDraft?: unknown;
  mergeStateStatus?: unknown;
  number?: unknown;
  reviewDecision?: unknown;
  repository?: {
    nameWithOwner?: unknown;
  };
  title?: unknown;
  updatedAt?: unknown;
  url?: unknown;
}

export async function listGitHubMergeablePullRequests(): Promise<DesktopPullRequestResult> {
  const items: DesktopPullRequest[] = [];
  let after: string | undefined;

  try {
    for (;;) {
      const result = await fetchPullRequestPage(after);
      items.push(...mapGraphQLResponse(result));

      const pageInfo = result.data?.viewer?.repositories?.pageInfo;
      if (pageInfo?.hasNextPage !== true) break;
      after = stringValue(pageInfo.endCursor);
      if (after == null) break;
    }
  } catch (error) {
    return mapGhError(error);
  }

  return {
    ok: true,
    items: items
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPullRequestPage(after: string | undefined) {
  const args = ['api', 'graphql', '-f', `query=${LIST_MERGEABLE_PULL_REQUESTS_QUERY}`];
  if (after != null) {
    args.push('-F', `after=${after}`);
  }

  const { stdout } = await execFileAsync('gh', args, {
    maxBuffer: 1024 * 1024 * 16,
    timeout: 30_000,
  });

  return JSON.parse(stdout) as GraphQLResponse;
}

export function mapGraphQLResponse(response: GraphQLResponse): DesktopPullRequest[] {
  const repositories = response.data?.viewer?.repositories?.nodes;
  if (!Array.isArray(repositories)) return [];

  return repositories.flatMap((repository) => mapRepository(repository));
}

function mapRepository(value: unknown): DesktopPullRequest[] {
  if (!isObject(value)) return [];

  const repository = value as GraphQLRepository;
  const permission = stringValue(repository.viewerPermission);
  if (permission == null || !MERGE_PERMISSIONS.has(permission)) return [];

  const pullRequests = repository.pullRequests?.nodes;
  if (!Array.isArray(pullRequests)) return [];

  return pullRequests
    .map((pullRequest) =>
      mapPullRequest(
        pullRequest,
        permission as DesktopPullRequest['viewerPermission']
      )
    )
    .filter((item): item is DesktopPullRequest => item != null);
}

function mapPullRequest(
  value: unknown,
  viewerPermission: DesktopPullRequest['viewerPermission']
): DesktopPullRequest | undefined {
  if (!isObject(value)) return undefined;

  const pullRequest = value as GraphQLPullRequest;
  const id = stringValue(pullRequest.id);
  const title = stringValue(pullRequest.title);
  const repository = stringValue(pullRequest.repository?.nameWithOwner);
  const number = numberValue(pullRequest.number);
  const url = stringValue(pullRequest.url);
  const updatedAt = stringValue(pullRequest.updatedAt);
  if (
    id == null ||
    title == null ||
    repository == null ||
    number == null ||
    url == null ||
    updatedAt == null
  ) {
    return undefined;
  }

  const [owner, repo] = repository.split('/');
  if (owner == null || repo == null || owner === '' || repo === '') {
    return undefined;
  }

  return {
    id,
    title,
    repository,
    owner,
    repo,
    number,
    url,
    viewerPath: `/${owner}/${repo}/pull/${number}`,
    updatedAt,
    isDraft: pullRequest.isDraft === true,
    reviewDecision: reviewDecisionValue(pullRequest.reviewDecision),
    mergeStateStatus: stringValue(pullRequest.mergeStateStatus) ?? null,
    viewerPermission,
  };
}

function reviewDecisionValue(
  value: unknown
): DesktopPullRequestReviewDecision {
  return value === 'APPROVED' ||
    value === 'CHANGES_REQUESTED' ||
    value === 'REVIEW_REQUIRED'
    ? value
    : null;
}

function mapGhError(error: unknown): DesktopPullRequestResult {
  if (isNodeError(error) && error.code === 'ENOENT') {
    return {
      ok: false,
      error: 'gh-not-found',
      message: 'GitHub CLI is not installed or not available on PATH.',
    };
  }

  const stderr = isExecError(error) ? error.stderr : '';
  if (/auth login|not logged|authentication|HTTP 401/i.test(stderr)) {
    return {
      ok: false,
      error: 'gh-auth-required',
      message: 'GitHub CLI is not authenticated. Run gh auth login and refresh.',
    };
  }

  if (error instanceof SyntaxError) {
    return {
      ok: false,
      error: 'parse-failed',
      message: 'GitHub CLI returned unreadable pull request data.',
    };
  }

  return {
    ok: false,
    error: 'gh-api-failed',
    message: stderr.trim() || 'GitHub CLI failed to load pull requests.',
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : undefined;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isExecError(error: unknown): error is Error & { stderr: string } {
  return (
    error instanceof Error &&
    typeof (error as { stderr?: unknown }).stderr === 'string'
  );
}
