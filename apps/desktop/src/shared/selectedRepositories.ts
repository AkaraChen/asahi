import {
  DesktopSelectedRepositorySchema,
  type DesktopSelectedRepository,
} from './githubPullRequests';

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

  return parsed.flatMap((value): DesktopSelectedRepository[] => {
    const result = DesktopSelectedRepositorySchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}
