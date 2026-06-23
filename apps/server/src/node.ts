import { serve, type ServerType } from '@hono/node-server';

import { diffApi } from './diff';

const HOSTNAME = '127.0.0.1';
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;

export interface DiffApiServer {
  origin: string;
  port: number;
  close(): Promise<void>;
}

export function startDiffApiServer(): Promise<DiffApiServer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = serve(
      {
        fetch: fetchWithDesktopCors,
        hostname: HOSTNAME,
        overrideGlobalObjects: false,
        port: 0,
      },
      (info) => {
        settled = true;
        resolve({
          origin: `http://${HOSTNAME}:${info.port}`,
          port: info.port,
          close: () => closeServer(server),
        });
      }
    );

    server.once('error', (error) => {
      if (!settled) {
        reject(error);
      }
    });
  });
}

async function fetchWithDesktopCors(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  const response = await diffApi.fetch(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error != null) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
