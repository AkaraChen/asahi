import type { DiffLineAnnotation } from '@pierre/diffs';

import type { CommentMetadata, GitHubInlineThreadMetadata } from './types';

export function isGitHubThreadAnnotation(
  annotation: DiffLineAnnotation<CommentMetadata>
): annotation is DiffLineAnnotation<GitHubInlineThreadMetadata> {
  return annotation.metadata.kind === 'github-thread';
}
