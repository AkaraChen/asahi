import escapeHtml from 'escape-html';
import { marked } from 'marked';

export function renderMarkdownToHtml(markdown: string): string {
  return marked.parse(escapeHtml(markdown), {
    async: false,
    breaks: true,
    gfm: true,
  });
}
