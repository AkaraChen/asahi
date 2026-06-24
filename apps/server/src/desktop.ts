import { zValidator } from '@hono/zod-validator';

import { createDiffApi, type DiffApiOptions } from './diff';
import {
  addGitHubInlineCommentReaction,
  createGitHubInlineComment,
  DesktopCreateInlineCommentRequestSchema,
  DesktopInlineCommentReactionRequestSchema,
  DesktopListInlineThreadsRequestSchema,
  DesktopListOwnerRepositoriesRequestSchema,
  DesktopListPullRequestsRequestSchema,
  DesktopReplyInlineCommentRequestSchema,
  DesktopResolveInlineThreadRequestSchema,
  listGitHubOwnerRepositories,
  listGitHubInlineThreads,
  listGitHubPullRequestsForRepositories,
  listGitHubRepositoryOwners,
  removeGitHubInlineCommentReaction,
  replyToGitHubInlineComment,
  resolveGitHubInlineThread,
  unresolveGitHubInlineThread,
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

  api.post(
    '/github/inline-threads',
    zValidator('json', DesktopListInlineThreadsRequestSchema),
    async (context) =>
      context.json(await listGitHubInlineThreads(context.req.valid('json')))
  );

  api.post(
    '/github/inline-comments',
    zValidator('json', DesktopCreateInlineCommentRequestSchema),
    async (context) =>
      context.json(await createGitHubInlineComment(context.req.valid('json')))
  );

  api.post(
    '/github/inline-comments/replies',
    zValidator('json', DesktopReplyInlineCommentRequestSchema),
    async (context) =>
      context.json(await replyToGitHubInlineComment(context.req.valid('json')))
  );

  api.post(
    '/github/inline-threads/resolve',
    zValidator('json', DesktopResolveInlineThreadRequestSchema),
    async (context) =>
      context.json(await resolveGitHubInlineThread(context.req.valid('json')))
  );

  api.post(
    '/github/inline-threads/unresolve',
    zValidator('json', DesktopResolveInlineThreadRequestSchema),
    async (context) =>
      context.json(await unresolveGitHubInlineThread(context.req.valid('json')))
  );

  api.post(
    '/github/inline-comment-reactions/add',
    zValidator('json', DesktopInlineCommentReactionRequestSchema),
    async (context) =>
      context.json(
        await addGitHubInlineCommentReaction(context.req.valid('json'))
      )
  );

  api.post(
    '/github/inline-comment-reactions/remove',
    zValidator('json', DesktopInlineCommentReactionRequestSchema),
    async (context) =>
      context.json(
        await removeGitHubInlineCommentReaction(context.req.valid('json'))
      )
  );

  return api;
}
