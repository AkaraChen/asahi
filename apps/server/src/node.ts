import { serve, type ServerType } from '@hono/node-server';

import { createDesktopApi, type DesktopApiOptions } from './desktop';

const HOSTNAME = '127.0.0.1';
export const DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER = 'x-asahi-desktop-token';
const ACCESS_CONTROL_ALLOW_HEADERS = [
  'content-type',
  DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER,
].join(', ');
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': ACCESS_CONTROL_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
} as const;

type DesktopApi = ReturnType<typeof createDesktopApi>;

export interface DiffApiServer {
  origin: string;
  port: number;
  close(): Promise<void>;
}

export interface StartDiffApiServerOptions {
  accessToken?: string;
  getGitHubAuthToken?: DesktopApiOptions['getGitHubAuthToken'];
}

export function startDiffApiServer(
  options: StartDiffApiServerOptions = {}
): Promise<DiffApiServer> {
  const desktopApi = createDesktopApi({
    getGitHubAuthToken: options.getGitHubAuthToken,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const server = serve(
      {
        fetch: (request) =>
          fetchWithDesktopCors(request, desktopApi, options.accessToken),
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
  desktopApi: DesktopApi,
  accessToken: string | undefined
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  if (
    accessToken != null &&
    request.headers.get(DESKTOP_DIFF_API_ACCESS_TOKEN_HEADER) !== accessToken
  ) {
    return new Response('Forbidden', { headers: CORS_HEADERS, status: 403 });
  }

  const response = await desktopApi.fetch(request);
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
