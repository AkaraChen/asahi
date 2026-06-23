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
});
