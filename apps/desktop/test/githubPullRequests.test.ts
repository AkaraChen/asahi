import { describe, expect, test } from 'bun:test';

import {
  toDesktopPullRequest,
  toDesktopRepository,
} from '../src/main/githubPullRequests';

describe('githubPullRequests', () => {
  test('converts a repository node', () => {
    expect(
      toDesktopRepository({
        id: 'repo-id',
        isPrivate: true,
        name: 'repo',
        nameWithOwner: 'owner/repo',
        viewerPermission: 'WRITE',
        activePullRequests: { totalCount: 3 },
        closedPullRequests: { totalCount: 9 },
      })
    ).toEqual({
      id: 'repo-id',
      isPrivate: true,
      name: 'repo',
      nameWithOwner: 'owner/repo',
      owner: 'owner',
      activePullRequestCount: 3,
      closedPullRequestCount: 9,
      viewerPermission: 'WRITE',
    });
  });

  test('converts a pull request node', () => {
    expect(
      toDesktopPullRequest(
        {
          id: 'pr-id',
          isDraft: false,
          mergeStateStatus: 'CLEAN',
          number: 42,
          reviewDecision: 'APPROVED',
          title: 'Ship it',
          updatedAt: '2026-06-23T10:00:00Z',
          url: 'https://github.com/owner/repo/pull/42',
        },
        'owner/repo',
        'ADMIN'
      )
    ).toMatchObject({
      id: 'pr-id',
      owner: 'owner',
      repo: 'repo',
      repository: 'owner/repo',
      viewerPath: '/owner/repo/pull/42',
      viewerPermission: 'ADMIN',
    });
  });
});
