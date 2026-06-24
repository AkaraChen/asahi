'use client';

import { useMemo } from 'react';

import { cn } from '../lib/cn';
import { renderMarkdownToHtml } from '../lib/renderMarkdownToHtml';

interface MarkdownRenderProps {
  className?: string;
  markdown: string;
}

export function MarkdownRender({ className, markdown }: MarkdownRenderProps) {
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown]);

  return (
    <div
      className={cn(
        'text-sm leading-6',
        '[&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[color-mix(in_srgb,currentColor_28%,transparent)] [&_blockquote]:pl-3 [&_blockquote]:text-[color-mix(in_srgb,currentColor_70%,transparent)]',
        '[&_code]:rounded-sm [&_code]:bg-[color-mix(in_srgb,currentColor_10%,transparent)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono',
        '[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:font-semibold',
        '[&_img]:max-w-full',
        '[&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1',
        '[&_pre]:my-2 [&_pre]:rounded [&_pre]:bg-[color-mix(in_srgb,currentColor_10%,transparent)] [&_pre]:p-2 [&_pre]:text-xs',
        '[&_table]:my-2',
        '[&_td]:border [&_td]:border-[color-mix(in_srgb,currentColor_18%,transparent)] [&_td]:px-2 [&_td]:py-1',
        '[&_th]:border [&_th]:border-[color-mix(in_srgb,currentColor_18%,transparent)] [&_th]:px-2 [&_th]:py-1',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
