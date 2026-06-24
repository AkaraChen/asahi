import type { SelectedLineRange } from '@pierre/diffs';

import type { GitHubInlineCommentAnchor } from './types';

export function rangeFromGitHubAnchor(
  anchor: GitHubInlineCommentAnchor
): SelectedLineRange | undefined {
  if (anchor.kind === 'file') {
    return { start: 0, end: 0, side: 'additions' };
  }
  return {
    start: anchor.startLine ?? anchor.line,
    side: sideFromGitHub(anchor.startSide ?? anchor.side),
    end: anchor.line,
    ...(anchor.startSide != null && anchor.startSide !== anchor.side
      ? { endSide: sideFromGitHub(anchor.side) }
      : {}),
  };
}

export function sideToGitHub(
  side: 'additions' | 'deletions'
): 'LEFT' | 'RIGHT' {
  return side === 'deletions' ? 'LEFT' : 'RIGHT';
}

export function sideFromGitHub(
  side: 'LEFT' | 'RIGHT'
): 'additions' | 'deletions' {
  return side === 'LEFT' ? 'deletions' : 'additions';
}
