import { describe, expect, test } from 'bun:test';

import {
  parseReactionContent,
  toDesktopInlineThread,
} from '../src/githubPullRequests';

describe('GitHub inline threads', () => {
  test('converts GraphQL review thread state and anchors', () => {
    const thread = toDesktopInlineThread({
      id: 'thread-id',
      isCollapsed: false,
      isResolved: true,
      path: 'src/app.ts',
      startLine: 10,
      startDiffSide: 'RIGHT',
      line: 12,
      diffSide: 'RIGHT',
      comments: {
        nodes: [
          {
            id: 'comment-node',
            databaseId: 123,
            body: 'Looks good',
            bodyHTML: '<p>Looks good</p>',
            createdAt: '2026-06-24T00:00:00Z',
            updatedAt: '2026-06-24T00:00:01Z',
            url: 'https://github.com/owner/repo/pull/1#discussion_r123',
            author: { login: 'octocat', avatarUrl: 'https://example.test/a.png' },
            reactionGroups: [
              {
                content: 'THUMBS_UP',
                viewerHasReacted: true,
                users: { totalCount: 2 },
              },
            ],
          },
        ],
      },
    });

    expect(thread).toEqual({
      id: 'thread-id',
      isCollapsed: false,
      isResolved: true,
      anchor: {
        kind: 'line',
        path: 'src/app.ts',
        startLine: 10,
        startSide: 'RIGHT',
        line: 12,
        side: 'RIGHT',
      },
      comments: [
        {
          id: 'comment-node',
          databaseId: 123,
          body: 'Looks good',
          bodyHTML: '<p>Looks good</p>',
          createdAt: '2026-06-24T00:00:00Z',
          updatedAt: '2026-06-24T00:00:01Z',
          url: 'https://github.com/owner/repo/pull/1#discussion_r123',
          author: { login: 'octocat', avatarUrl: 'https://example.test/a.png' },
          reactions: [{ content: '+1', count: 2, viewerHasReacted: true }],
        },
      ],
    });
  });

  test('maps GraphQL and REST reaction names to app reaction content', () => {
    expect(parseReactionContent('THUMBS_UP')).toBe('+1');
    expect(parseReactionContent('THUMBS_DOWN')).toBe('-1');
    expect(parseReactionContent('LAUGH')).toBe('laugh');
    expect(parseReactionContent('rocket')).toBe('rocket');
    expect(parseReactionContent('unknown')).toBeUndefined();
  });
});
