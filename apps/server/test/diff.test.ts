import { afterEach, describe, expect, test } from 'bun:test';

import { createDiffApi, diffApi } from '../src/diff';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('diffApi', () => {
  test('proxies a GitHub path through the Hono route', async () => {
    let upstreamURL = '';
    globalThis.fetch = (async (input) => {
      upstreamURL = String(input);
      return new Response('diff --git a/file b/file\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }) as typeof fetch;

    const response = await diffApi.request('/api/diff?path=/owner/repo/pull/1');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Patch-Source')).toBe(
      'https://github.com/owner/repo/pull/1.diff'
    );
    expect(upstreamURL).toBe('https://github.com/owner/repo/pull/1.diff');
    expect(await response.text()).toContain('diff --git');
  });

  test('uses GitHub API diff media endpoint with an auth token provider', async () => {
    const authenticatedDiffApi = createDiffApi({
      getGitHubAuthToken: () => 'test-token',
    });
    let upstreamURL = '';
    let authorizationHeader = '';
    let acceptHeader = '';
    globalThis.fetch = (async (input, init) => {
      upstreamURL = String(input);
      const headers = new Headers(init?.headers);
      authorizationHeader = headers.get('Authorization') ?? '';
      acceptHeader = headers.get('Accept') ?? '';
      return new Response('diff --git a/private b/private\n', {
        headers: { 'Content-Type': 'application/vnd.github.v3.diff' },
      });
    }) as typeof fetch;

    const response = await authenticatedDiffApi.request(
      '/api/diff?path=/owner/private/pull/1'
    );

    expect(response.status).toBe(200);
    expect(upstreamURL).toBe(
      'https://api.github.com/repos/owner/private/pulls/1'
    );
    expect(authorizationHeader).toBe('Bearer test-token');
    expect(acceptHeader).toBe('application/vnd.github.v3.diff');
    expect(response.headers.get('X-Patch-Source')).toBe(
      'https://github.com/owner/private/pull/1.diff'
    );
    expect(await response.text()).toContain('diff --git');
  });
});
