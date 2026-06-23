import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  DesktopPullRequestNotification,
  DesktopPullRequestNotificationResult,
} from '../shared/githubNotifications';

const execFileAsync = promisify(execFile);
const MAX_NOTIFICATIONS = 50;
const PULL_API_PATH_PATTERN = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/;

interface GitHubNotificationThread {
  id?: unknown;
  repository?: {
    full_name?: unknown;
  };
  subject?: {
    title?: unknown;
    type?: unknown;
    url?: unknown;
  };
  reason?: unknown;
  unread?: unknown;
  updated_at?: unknown;
}

export async function listGitHubPullRequestNotifications(): Promise<DesktopPullRequestNotificationResult> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      'gh',
      [
        'api',
        '-X',
        'GET',
        'notifications',
        '-F',
        'all=false',
        '-F',
        'per_page=50',
        '--paginate',
        '--slurp',
      ],
      {
        maxBuffer: 1024 * 1024 * 8,
        timeout: 15_000,
      }
    ));
  } catch (error) {
    return mapGhError(error);
  }

  try {
    return {
      ok: true,
      items: mapGitHubNotificationPages(JSON.parse(stdout)),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ok: false,
      error: 'parse-failed',
      message: 'GitHub CLI returned unreadable notification data.',
    };
  }
}

export function mapGitHubNotificationPages(
  rawPages: unknown
): DesktopPullRequestNotification[] {
  const threads = flattenNotificationPages(rawPages);
  return threads
    .map(mapGitHubNotification)
    .filter((item): item is DesktopPullRequestNotification => item != null)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_NOTIFICATIONS);
}

function flattenNotificationPages(rawPages: unknown): GitHubNotificationThread[] {
  if (!Array.isArray(rawPages)) {
    return [];
  }

  const pages = rawPages.every(Array.isArray) ? rawPages.flat() : rawPages;
  return pages.filter(isNotificationThread);
}

function mapGitHubNotification(
  thread: GitHubNotificationThread
): DesktopPullRequestNotification | undefined {
  if (thread.subject?.type !== 'PullRequest') {
    return undefined;
  }

  const id = stringValue(thread.id);
  const title = stringValue(thread.subject.title);
  const reason = stringValue(thread.reason);
  const updatedAt = stringValue(thread.updated_at);
  const pull = parsePullSubjectURL(stringValue(thread.subject.url));
  if (id == null || title == null || updatedAt == null || pull == null) {
    return undefined;
  }

  return {
    id,
    title,
    repository:
      stringValue(thread.repository?.full_name) ?? `${pull.owner}/${pull.repo}`,
    owner: pull.owner,
    repo: pull.repo,
    number: pull.number,
    url: `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.number}`,
    viewerPath: `/${pull.owner}/${pull.repo}/pull/${pull.number}`,
    reason: reason ?? '',
    unread: thread.unread === true,
    updatedAt,
  };
}

function parsePullSubjectURL(
  value: string | undefined
): { owner: string; repo: string; number: number } | undefined {
  if (value == null) {
    return undefined;
  }

  let parsedURL: URL;
  try {
    parsedURL = new URL(value);
  } catch {
    return undefined;
  }

  const match = PULL_API_PATH_PATTERN.exec(parsedURL.pathname);
  if (match == null) {
    return undefined;
  }

  const owner = match[1];
  const repo = match[2];
  const number = Number(match[3]);
  if (owner == null || repo == null || !Number.isSafeInteger(number)) {
    return undefined;
  }

  return { owner, repo, number };
}

function mapGhError(error: unknown): DesktopPullRequestNotificationResult {
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

  return {
    ok: false,
    error: 'gh-api-failed',
    message: stderr.trim() || 'GitHub CLI failed to load notifications.',
  };
}

function isNotificationThread(value: unknown): value is GitHubNotificationThread {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
