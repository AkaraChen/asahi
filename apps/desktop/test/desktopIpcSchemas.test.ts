import { describe, expect, test } from 'bun:test';

import {
  DesktopListOwnerRepositoriesRequestSchema,
  DesktopListPullRequestsRequestSchema,
  DesktopSelectedRepositorySchema,
} from '../src/shared/githubPullRequests';
import {
  DesktopSelectTabRequestSchema,
  DesktopTabIdSchema,
  DesktopViewerTabRequestSchema,
} from '../src/shared/desktopTabs';

describe('desktop IPC schemas', () => {
  test('validates owner repository requests', () => {
    expect(
      DesktopListOwnerRepositoriesRequestSchema.safeParse({
        owner: 'akrc',
        ownerType: 'personal',
      }).success
    ).toBe(true);

    expect(
      DesktopListOwnerRepositoriesRequestSchema.safeParse({
        owner: '',
        ownerType: 'personal',
      }).success
    ).toBe(false);
  });

  test('validates selected repositories', () => {
    expect(
      DesktopSelectedRepositorySchema.safeParse({
        owner: 'akrc',
        name: 'asahi',
        nameWithOwner: 'akrc/asahi',
      }).success
    ).toBe(true);

    expect(
      DesktopSelectedRepositorySchema.safeParse({
        owner: 'akrc',
        name: 'asahi',
        nameWithOwner: 'other/asahi',
      }).success
    ).toBe(false);
  });

  test('validates pull request list requests', () => {
    expect(
      DesktopListPullRequestsRequestSchema.safeParse({
        repositories: [
          {
            owner: 'akrc',
            name: 'asahi',
            nameWithOwner: 'akrc/asahi',
          },
        ],
      }).success
    ).toBe(true);
  });

  test('validates viewer tab requests', () => {
    expect(
      DesktopViewerTabRequestSchema.safeParse({
        id: '/akrc/asahi/pull/1',
        type: 'pr',
        owner: 'akrc',
        repo: 'asahi',
        number: 1,
        viewerAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      }).success
    ).toBe(true);

    expect(
      DesktopViewerTabRequestSchema.safeParse({
        id: '/akrc/asahi/pull/0',
        type: 'pr',
        owner: 'akrc',
        repo: 'asahi',
        number: 0,
        viewerAvatarUrl: 'not-a-url',
      }).success
    ).toBe(false);
  });

  test('validates tab ids', () => {
    expect(DesktopTabIdSchema.safeParse('/akrc/asahi/pull/1').success).toBe(
      true
    );
    expect(DesktopSelectTabRequestSchema.safeParse({ id: '' }).success).toBe(
      false
    );
  });
});
