import { afterEach, describe, expect, test } from 'bun:test';

import { diffApi } from '../src/diff';

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
});
