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
});
