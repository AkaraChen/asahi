import { zValidator } from '@hono/zod-validator';

import { createDiffApi, type DiffApiOptions } from './diff';
import {
  DesktopListOwnerRepositoriesRequestSchema,
  DesktopListPullRequestsRequestSchema,
  listGitHubOwnerRepositories,
  listGitHubPullRequestsForRepositories,
  listGitHubRepositoryOwners,
} from './githubPullRequests';

export type DesktopApiOptions = DiffApiOptions;

export function createDesktopApi(options: DesktopApiOptions = {}) {
  const api = createDiffApi(options);

  api.get('/github/repository-owners', async (context) =>
    context.json(await listGitHubRepositoryOwners())
  );

  api.post(
    '/github/owner-repositories',
    zValidator('json', DesktopListOwnerRepositoriesRequestSchema),
    async (context) =>
      context.json(
        await listGitHubOwnerRepositories(context.req.valid('json'))
      )
  );

  api.post(
    '/github/repository-pull-requests',
    zValidator('json', DesktopListPullRequestsRequestSchema),
    async (context) =>
      context.json(
        await listGitHubPullRequestsForRepositories(context.req.valid('json'))
      )
  );

  return api;
}
