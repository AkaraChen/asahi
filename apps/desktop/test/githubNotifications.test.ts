import { describe, expect, test } from 'bun:test';

import { mapGitHubNotificationPages } from '../src/main/githubNotifications';

describe('mapGitHubNotificationPages', () => {
  test('maps pull request notification pages', () => {
    const items = mapGitHubNotificationPages([
      [
        notificationThread({
          id: '1',
          owner: 'older',
          repo: 'repo',
          number: 10,
          title: 'Older PR',
          updatedAt: '2026-06-22T10:00:00Z',
        }),
        {
          id: 'issue',
          subject: { type: 'Issue', title: 'Issue' },
        },
      ],
      [
        notificationThread({
          id: '2',
          owner: 'newer',
          repo: 'repo',
          number: 20,
          title: 'Newer PR',
          updatedAt: '2026-06-23T10:00:00Z',
        }),
      ],
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: '2',
      repository: 'newer/repo',
      viewerPath: '/newer/repo/pull/20',
      url: 'https://github.com/newer/repo/pull/20',
    });
    expect(items[1]?.viewerPath).toBe('/older/repo/pull/10');
  });

  test('skips malformed pull request notifications', () => {
    const items = mapGitHubNotificationPages([
      [
        notificationThread({
          id: 'good',
          owner: 'owner',
          repo: 'repo',
          number: 123,
          title: 'Good PR',
          updatedAt: '2026-06-23T10:00:00Z',
        }),
        {
          id: 'bad',
          repository: { full_name: 'owner/repo' },
          subject: {
            title: 'Bad PR',
            type: 'PullRequest',
            url: 'https://api.github.com/repos/owner/repo/issues/123',
          },
          updated_at: '2026-06-23T09:00:00Z',
        },
      ],
    ]);

    expect(items.map((item) => item.id)).toEqual(['good']);
  });
});

function notificationThread({
  id,
  number,
  owner,
  repo,
  title,
  updatedAt,
}: {
  id: string;
  number: number;
  owner: string;
  repo: string;
  title: string;
  updatedAt: string;
}) {
  return {
    id,
    repository: { full_name: `${owner}/${repo}` },
    reason: 'subscribed',
    subject: {
      title,
      type: 'PullRequest',
      url: `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
    },
    unread: true,
    updated_at: updatedAt,
  };
}
