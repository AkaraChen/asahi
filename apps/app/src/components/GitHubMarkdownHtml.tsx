'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { githubPrimerMarkdownCss } from './githubPrimerMarkdownCss';

const embeddedMarkdownCss = `
  :host {
    display: block;
    min-width: 0;
    max-width: 100%;
    color: inherit;
    font: inherit;
    line-height: inherit;
    white-space: normal;
    --base-size-4: 4px;
    --base-size-8: 8px;
    --base-size-16: 16px;
    --base-size-24: 24px;
    --base-text-weight-semibold: 600;
    --fgColor-default: currentColor;
    --fgColor-muted: color-mix(in srgb, currentColor 70%, transparent);
    --fgColor-danger: #d1242f;
    --borderColor-default: color-mix(in srgb, currentColor 18%, transparent);
    --borderColor-muted: color-mix(in srgb, currentColor 12%, transparent);
    --borderColor-accent-emphasis: #0969da;
    --bgColor-default: transparent;
    --bgColor-muted: color-mix(in srgb, currentColor 8%, transparent);
    --bgColor-neutral-muted: color-mix(in srgb, currentColor 10%, transparent);
  }

  .markdown-body {
    min-width: 0;
    max-width: 100%;
    color: inherit;
    font-size: inherit;
    white-space: normal;
  }

  .markdown-body,
  .markdown-body * {
    box-sizing: border-box;
  }

  .markdown-body pre,
  .markdown-body code,
  .markdown-body tt,
  .markdown-body table,
  .markdown-body th,
  .markdown-body td,
  .markdown-body a {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .markdown-body pre {
    max-width: 100%;
    overflow: visible;
    white-space: pre-wrap;
  }

  .markdown-body pre > code,
  .markdown-body .highlight pre,
  .markdown-body .highlight pre code {
    white-space: pre-wrap;
  }

  .markdown-body table {
    display: table;
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    overflow: visible;
  }

  .markdown-body img,
  .markdown-body video {
    max-width: 100%;
    height: auto;
  }
`;

interface GitHubMarkdownHtmlProps {
  className?: string;
  html: string;
}

export function GitHubMarkdownHtml({
  className,
  html,
}: GitHubMarkdownHtmlProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host == null) return;
    setShadowRoot(host.shadowRoot ?? host.attachShadow({ mode: 'open' }));
  }, []);

  return (
    <div ref={hostRef} className={className}>
      {shadowRoot != null &&
        createPortal(
          <>
            <style>{githubPrimerMarkdownCss}</style>
            <style>{embeddedMarkdownCss}</style>
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </>,
          shadowRoot
        )}
    </div>
  );
}
