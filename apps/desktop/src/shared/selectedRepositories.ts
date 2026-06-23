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

  return Array.isArray(parsed) ? parsed.filter(isSelectedRepository) : [];
}

function isSelectedRepository(value: unknown): value is DesktopSelectedRepository {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const repository = value as Partial<DesktopSelectedRepository>;
  return (
    typeof repository.owner === 'string' &&
    repository.owner.length > 0 &&
    typeof repository.name === 'string' &&
    repository.name.length > 0 &&
    repository.nameWithOwner === `${repository.owner}/${repository.name}`
  );
}
