import { homedir } from 'node:os';

const DEFAULT_CLI_PATHS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/opt/local/bin',
  '/opt/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

export function installDesktopCliPath(): void {
  process.env.PATH = createDesktopCliPath(process.env.PATH);
}

export function createDesktopCliPath(
  currentPath = '',
  homeDirectory = homedir()
): string {
  return dedupePathEntries([
    ...currentPath.split(':'),
    ...getUserCliPaths(homeDirectory),
    ...DEFAULT_CLI_PATHS,
  ]).join(':');
}

function getUserCliPaths(homeDirectory: string): string[] {
  if (homeDirectory === '') return [];

  return [
    `${homeDirectory}/.local/bin`,
    `${homeDirectory}/bin`,
    `${homeDirectory}/.cargo/bin`,
  ];
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    const normalized = entry.trim();
    if (normalized === '' || seen.has(normalized)) continue;

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
