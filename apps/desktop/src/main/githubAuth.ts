import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let cachedGitHubAuthToken: string | undefined;
let gitHubAuthTokenPromise: Promise<string | undefined> | undefined;

export function getGitHubAuthToken(): Promise<string | undefined> {
  if (cachedGitHubAuthToken != null) {
    return Promise.resolve(cachedGitHubAuthToken);
  }

  gitHubAuthTokenPromise ??= loadGitHubAuthToken().finally(() => {
    gitHubAuthTokenPromise = undefined;
  });
  return gitHubAuthTokenPromise;
}

async function loadGitHubAuthToken(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], {
      maxBuffer: 1024 * 64,
      timeout: 5_000,
    });
    const token = stdout.trim();
    if (token === '') {
      return undefined;
    }

    cachedGitHubAuthToken = token;
    return token;
  } catch {
    return undefined;
  }
}
