'use client';

import type { DiffLineAnnotation } from '@pierre/diffs';
import { IconChevronSm } from '@pierre/icons';
import { useState } from 'react';

import { Button } from './Button';
import { CommentAuthorAvatar } from './CommentAuthorAvatar';
import { MarkdownRender } from './MarkdownRender';
import { annotationCardBase } from '../lib/annotation';
import { cn } from '../lib/cn';
import type {
  GitHubInlineComment,
  GitHubInlineThreadMetadata,
  GitHubReactionContent,
} from '../lib/types';

const REACTIONS: { content: GitHubReactionContent; label: string }[] = [
  { content: '+1', label: '👍' },
  { content: '-1', label: '👎' },
  { content: 'laugh', label: '😄' },
  { content: 'confused', label: '😕' },
  { content: 'heart', label: '❤️' },
  { content: 'hooray', label: '🎉' },
  { content: 'rocket', label: '🚀' },
  { content: 'eyes', label: '👀' },
];

interface GitHubThreadAnnotationProps {
  annotation: DiffLineAnnotation<GitHubInlineThreadMetadata>;
  onAddReaction(comment: GitHubInlineComment, content: GitHubReactionContent): void;
  onRemoveReaction(
    comment: GitHubInlineComment,
    content: GitHubReactionContent
  ): void;
  onReply(body: string): void;
  onRetry(comment: GitHubInlineComment): void;
  onToggleResolved(): void;
}

export function GitHubThreadAnnotation({
  annotation,
  onAddReaction,
  onRemoveReaction,
  onReply,
  onRetry,
  onToggleResolved,
}: GitHubThreadAnnotationProps) {
  const { thread } = annotation.metadata;
  const [collapsed, setCollapsed] = useState(thread.isResolved);
  const [replyBody, setReplyBody] = useState('');
  const trimmedReply = replyBody.trim();

  return (
    <div className={cn(annotationCardBase, 'flex-col items-stretch gap-2')}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <IconChevronSm
            className={cn('size-3 transition-transform', collapsed && '-rotate-90')}
          />
        </Button>
        <span className="text-xs font-medium">
          {thread.isResolved ? 'Resolved thread' : 'GitHub thread'}
        </span>
        <Button
          type="button"
          variant="muted"
          size="xs"
          className="ml-auto"
          onClick={onToggleResolved}
        >
          {thread.isResolved ? 'Unresolve' : 'Resolve'}
        </Button>
      </div>
      {!collapsed && (
        <>
          <div className="flex flex-col gap-2">
            {thread.comments.map((comment) => (
              <GitHubInlineCommentView
                comment={comment}
                key={comment.id}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                onRetry={onRetry}
              />
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-[var(--diffshub-annotation-border,var(--color-border))] pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmedReply.length === 0) return;
              onReply(trimmedReply);
              setReplyBody('');
            }}
          >
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.currentTarget.value)}
              placeholder="Reply..."
              rows={1}
              className="field-sizing-content min-h-8 flex-1 resize-none rounded-sm bg-transparent py-1.5 text-[13px] text-inherit placeholder:text-[var(--diffshub-popover-muted-fg,var(--color-muted-foreground))] focus:outline-none"
            />
            <Button
              type="submit"
              variant="default"
              size="xs"
              disabled={trimmedReply.length === 0}
            >
              Reply
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

function GitHubInlineCommentView({
  comment,
  onAddReaction,
  onRemoveReaction,
  onRetry,
}: {
  comment: GitHubInlineComment;
  onAddReaction(comment: GitHubInlineComment, content: GitHubReactionContent): void;
  onRemoveReaction(
    comment: GitHubInlineComment,
    content: GitHubReactionContent
  ): void;
  onRetry(comment: GitHubInlineComment): void;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <CommentAuthorAvatar
        seed={comment.author.login}
        avatarSrc={comment.author.avatarUrl}
        className="mt-0.5 size-5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-[var(--diffshub-popover-muted-fg,var(--color-muted-foreground))]">
          <span className="font-medium text-[var(--diffshub-annotation-fg,var(--color-foreground))]">
            {comment.author.login}
          </span>
          {comment.optimistic && <span>Publishing...</span>}
          {comment.failed && <span>Failed</span>}
        </div>
        <MarkdownRender className="mt-1 max-w-none" markdown={comment.body} />
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {REACTIONS.map(({ content, label }) => {
            const group = comment.reactions.find(
              (reaction) => reaction.content === content
            );
            const active = group?.viewerHasReacted === true;
            if (group == null || group.count === 0) {
              return (
                <button
                  key={content}
                  type="button"
                  title={content}
                  className="rounded px-1 text-xs opacity-45 hover:bg-[var(--diffshub-popover-hover-bg,var(--color-muted))] hover:opacity-100"
                  onClick={() => onAddReaction(comment, content)}
                >
                  {label}
                </button>
              );
            }
            return (
              <button
                key={content}
                type="button"
                title={content}
                className={cn(
                  'rounded border px-1.5 text-xs',
                  active
                    ? 'border-blue-400 bg-blue-500/15'
                    : 'border-[var(--diffshub-annotation-border,var(--color-border))]'
                )}
                onClick={() =>
                  active
                    ? onRemoveReaction(comment, content)
                    : onAddReaction(comment, content)
                }
              >
                {label} {group.count}
              </button>
            );
          })}
          {comment.failed && (
            <Button
              type="button"
              variant="muted"
              size="xs"
              className="ml-auto"
              onClick={() => onRetry(comment)}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
