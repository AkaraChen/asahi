import { describe, expect, test } from 'bun:test';

import { createDesktopApi } from '../src/desktop';

describe('desktop API', () => {
  test('rejects invalid GitHub request bodies with zod validator', async () => {
    const api = createDesktopApi();
    const response = await api.request('/api/github/owner-repositories', {
      body: JSON.stringify({ owner: '', ownerType: 'personal' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });

  test('rejects invalid GitHub inline thread list requests', async () => {
    const api = createDesktopApi();
    const response = await api.request('/api/github/inline-threads', {
      body: JSON.stringify({ owner: '', repo: 'asahi', number: 1 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });

  test('rejects invalid GitHub inline comment bodies', async () => {
    const api = createDesktopApi();
    const response = await api.request('/api/github/inline-comments', {
      body: JSON.stringify({
        owner: 'akrc',
        repo: 'asahi',
        number: 1,
        anchor: { kind: 'line', path: 'README.md', line: 1, side: 'RIGHT' },
        body: '   ',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });

  test('rejects unsupported GitHub inline reaction content', async () => {
    const api = createDesktopApi();
    const response = await api.request(
      '/api/github/inline-comment-reactions/add',
      {
        body: JSON.stringify({
          owner: 'akrc',
          repo: 'asahi',
          number: 1,
          commentId: 1,
          content: 'party',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }
    );

    expect(response.status).toBe(400);
  });
});
