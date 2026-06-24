import type { DesktopSelectedRepository } from './githubPullRequests';

export const SELECTED_REPOSITORIES_KEY = 'asahi:selected-repositories';

export function parseSelectedRepositories(
  value: string | null
): DesktopSelectedRepository[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value ?? '[]');
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((value): DesktopSelectedRepository[] =>
    isSelectedRepository(value) ? [value] : []
  );
}

function isSelectedRepository(
  value: unknown
): value is DesktopSelectedRepository {
  if (value == null || typeof value !== 'object') return false;

  const repository = value as Record<string, unknown>;
  return (
    typeof repository.owner === 'string' &&
    repository.owner !== '' &&
    typeof repository.name === 'string' &&
    repository.name !== '' &&
    repository.nameWithOwner === `${repository.owner}/${repository.name}`
  );
}
