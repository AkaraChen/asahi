'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { cn } from '../lib/cn';

interface MarkdownRenderProps {
  className?: string;
  markdown: string;
}

const markdownComponents: Components = {
  a({ className, ...props }) {
    return (
      <a
        className={cn('underline underline-offset-2', className)}
        {...props}
      />
    );
  },
  blockquote({ className, ...props }) {
    return (
      <blockquote
        className={cn(
          'my-2 border-l-2 border-[color-mix(in_srgb,currentColor_28%,transparent)] pl-3 text-[color-mix(in_srgb,currentColor_70%,transparent)]',
          className
        )}
        {...props}
      />
    );
  },
  del({ className, ...props }) {
    return <del className={cn('line-through', className)} {...props} />;
  },
  code({ className, ...props }) {
    return (
      <code
        className={cn(
          'rounded-sm bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-1 py-0.5 font-mono',
          className
        )}
        {...props}
      />
    );
  },
  h1({ className, ...props }) {
    return (
      <h1
        className={cn('mb-2 text-base font-semibold', className)}
        {...props}
      />
    );
  },
  h2({ className, ...props }) {
    return (
      <h2 className={cn('mb-2 text-sm font-semibold', className)} {...props} />
    );
  },
  h3({ className, ...props }) {
    return <h3 className={cn('mb-1 font-semibold', className)} {...props} />;
  },
  img({ className, ...props }) {
    return <img className={cn('max-w-full', className)} {...props} />;
  },
  li({ className, ...props }) {
    return <li className={cn('my-1', className)} {...props} />;
  },
  ol({ className, ...props }) {
    return (
      <ol className={cn('my-2 list-decimal pl-5', className)} {...props} />
    );
  },
  p({ className, ...props }) {
    return <p className={cn('my-1', className)} {...props} />;
  },
  pre({ className, ...props }) {
    return (
      <pre
        className={cn(
          'my-2 rounded bg-[color-mix(in_srgb,currentColor_10%,transparent)] p-2 text-xs',
          className
        )}
        {...props}
      />
    );
  },
  table({ className, ...props }) {
    return <table className={cn('my-2', className)} {...props} />;
  },
  sub({ className, ...props }) {
    return <sub className={cn('text-[0.75em]', className)} {...props} />;
  },
  sup({ className, ...props }) {
    return <sup className={cn('text-[0.75em]', className)} {...props} />;
  },
  td({ className, ...props }) {
    return (
      <td
        className={cn(
          'border border-[color-mix(in_srgb,currentColor_18%,transparent)] px-2 py-1',
          className
        )}
        {...props}
      />
    );
  },
  th({ className, ...props }) {
    return (
      <th
        className={cn(
          'border border-[color-mix(in_srgb,currentColor_18%,transparent)] px-2 py-1',
          className
        )}
        {...props}
      />
    );
  },
  ul({ className, ...props }) {
    return <ul className={cn('my-2 list-disc pl-5', className)} {...props} />;
  },
};

export function MarkdownRender({ className, markdown }: MarkdownRenderProps) {
  return (
    <div className={cn('text-sm leading-6', className)}>
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
