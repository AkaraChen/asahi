let apiBaseURLPromise: Promise<string> | undefined;

export function installDesktopApiFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const requestURL = getRequestURL(input);
    if (requestURL?.startsWith('/api/') === true) {
      const apiBaseURL = await getApiBaseURL();
      return originalFetch(`${apiBaseURL}${requestURL}`, init);
    }

    return originalFetch(input, init);
  };
}

function getApiBaseURL(): Promise<string> {
  apiBaseURLPromise ??= window.asahi.getApiBaseURL();
  return apiBaseURLPromise;
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
