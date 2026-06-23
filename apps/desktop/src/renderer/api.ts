let apiBaseURLPromise: Promise<string> | undefined;
let apiAccessTokenPromise:
  | Promise<{ header: string; token: string }>
  | undefined;

export function installDesktopApiFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const requestURL = getRequestURL(input);
    if (requestURL?.startsWith('/api/') === true) {
      const [apiBaseURL, accessToken] = await Promise.all([
        getApiBaseURL(),
        getApiAccessToken(),
      ]);
      const headers = new Headers(init?.headers);
      headers.set(accessToken.header, accessToken.token);
      return originalFetch(`${apiBaseURL}${requestURL}`, { ...init, headers });
    }

    return originalFetch(input, init);
  };
}

function getApiBaseURL(): Promise<string> {
  apiBaseURLPromise ??= window.asahi.getApiBaseURL();
  return apiBaseURLPromise;
}

function getApiAccessToken(): Promise<{ header: string; token: string }> {
  apiAccessTokenPromise ??= window.asahi.getApiAccessToken();
  return apiAccessTokenPromise;
}

function getRequestURL(input: RequestInfo | URL): string | undefined {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}
