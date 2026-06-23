import { describe, expect, test } from 'bun:test';

import { startDiffApiServer } from '../src/node';

describe('startDiffApiServer', () => {
  test('serves the Hono diff API on an assigned localhost port', async () => {
    const server = await startDiffApiServer();
    try {
      expect(server.port).toBeGreaterThan(0);

      const response = await fetch(`${server.origin}/api/diff`);

      expect(response.status).toBe(400);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(await response.text()).toBe('Path or URL parameter is required');
    } finally {
      await server.close();
    }
  });

  test('requires the desktop access token when configured', async () => {
    const accessToken = 'test-desktop-token';
    const server = await startDiffApiServer({ accessToken });
    try {
      const rejected = await fetch(`${server.origin}/api/diff`);
      expect(rejected.status).toBe(403);

      const accepted = await fetch(`${server.origin}/api/diff`, {
        headers: { 'x-asahi-desktop-token': accessToken },
      });
      expect(accepted.status).toBe(400);
      expect(await accepted.text()).toBe('Path or URL parameter is required');
    } finally {
      await server.close();
    }
  });
});
