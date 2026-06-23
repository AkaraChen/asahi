import { describe, expect, test } from 'bun:test';

import { mapGraphQLResponse } from '../src/main/githubPullRequests';

describe('mapGraphQLResponse', () => {
  test('maps open PRs from repositories with merge permissions', () => {
    const items = mapGraphQLResponse({
      data: {
        viewer: {
          repositories: {
            nodes: [
              repository({
                nameWithOwner: 'owner/write-repo',
                permission: 'WRITE',
                pullRequests: [
                  pullRequest({
                    id: '1',
                    number: 10,
                    repository: 'owner/write-repo',
                    reviewDecision: 'REVIEW_REQUIRED',
                    title: 'Needs review',
                    updatedAt: '2026-06-22T10:00:00Z',
                  }),
                ],
              }),
              repository({
                nameWithOwner: 'owner/read-repo',
                permission: 'READ',
                pullRequests: [
                  pullRequest({
                    id: '2',
                    number: 20,
                    repository: 'owner/read-repo',
                    title: 'No merge permission',
                    updatedAt: '2026-06-23T10:00:00Z',
                  }),
                ],
              }),
            ],
          },
        },
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: '1',
      repository: 'owner/write-repo',
      reviewDecision: 'REVIEW_REQUIRED',
      viewerPath: '/owner/write-repo/pull/10',
      viewerPermission: 'WRITE',
    });
  });

  test('skips malformed PRs', () => {
    const items = mapGraphQLResponse({
      data: {
        viewer: {
          repositories: {
            nodes: [
              repository({
                nameWithOwner: 'owner/repo',
                permission: 'ADMIN',
                pullRequests: [
                  { id: 'missing-fields' },
                  pullRequest({
                    id: 'good',
                    number: 123,
                    repository: 'owner/repo',
                    title: 'Good PR',
                    updatedAt: '2026-06-23T10:00:00Z',
                  }),
                ],
              }),
            ],
          },
        },
      },
    });

    expect(items.map((item) => item.id)).toEqual(['good']);
  });
});

function repository({
  nameWithOwner,
  permission,
  pullRequests,
}: {
  nameWithOwner: string;
  permission: string;
  pullRequests: unknown[];
}) {
  return {
    nameWithOwner,
    viewerPermission: permission,
    pullRequests: { nodes: pullRequests },
  };
}

function pullRequest({
  id,
  number,
  repository,
  reviewDecision = null,
  title,
  updatedAt,
}: {
  id: string;
  number: number;
  repository: string;
  reviewDecision?: string | null;
  title: string;
  updatedAt: string;
}) {
  return {
    id,
    isDraft: false,
    mergeStateStatus: 'CLEAN',
    number,
    reviewDecision,
    repository: { nameWithOwner: repository },
    title,
    updatedAt,
    url: `https://github.com/${repository}/pull/${number}`,
  };
}
