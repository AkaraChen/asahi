import { serve, type ServerType } from '@hono/node-server';

import { createDiffApi, type DiffApiOptions } from './diff';

const HOSTNAME = '127.0.0.1';
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;

type DiffApi = ReturnType<typeof createDiffApi>;

export interface DiffApiServer {
  origin: string;
  port: number;
  close(): Promise<void>;
}

export interface StartDiffApiServerOptions {
  getGitHubAuthToken?: DiffApiOptions['getGitHubAuthToken'];
}

export function startDiffApiServer(
  options: StartDiffApiServerOptions = {}
): Promise<DiffApiServer> {
  const diffApi = createDiffApi({
    getGitHubAuthToken: options.getGitHubAuthToken,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const server = serve(
      {
        fetch: (request) => fetchWithDesktopCors(request, diffApi),
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

async function fetchWithDesktopCors(
  request: Request,
  diffApi: DiffApi
): Promise<Response> {
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
