import { describe, expect, test } from 'bun:test';

import {
  getStreamedPatchMetadata,
  streamGitPatchFiles,
} from '../streamGitPatchFiles';

const encoder = new TextEncoder();

describe('streamGitPatchFiles', () => {
  test('streams complete file diffs across arbitrary chunk boundaries', async () => {
    const patch = [
      'From abcdef1234567890 Mon Sep 17 00:00:00 2001\n\n',
      'diff --git a/a.txt b/a.txt\n',
      'index 1111111..2222222 100644\n',
      '--- a/a.txt\n',
      '+++ b/a.txt\n',
      '@@ -1 +1 @@\n',
      '-old\n',
      '+new\n',
      'diff --git a/b.txt b/b.txt\n',
      'new file mode 100644\n',
      'index 0000000..3333333\n',
      '--- /dev/null\n',
      '+++ b/b.txt\n',
      '@@ -0,0 +1 @@\n',
      '+new\n',
    ].join('');
    const files: string[] = [];

    const fallback = await streamGitPatchFiles(
      streamFromChunks([
        patch.slice(0, 17),
        patch.slice(17, 121),
        patch.slice(121),
      ]),
      async (fileText) => {
        files.push(fileText);
      }
    );

    expect(fallback).toBeUndefined();
    expect(files).toHaveLength(2);
    expect(files[0]).toContain('diff --git a/a.txt b/a.txt');
    expect(getStreamedPatchMetadata(files[0] ?? '')).toContain(
      'From abcdef1234567890'
    );
    expect(files[1]?.startsWith('diff --git a/b.txt b/b.txt')).toBe(true);
  });

  test('falls back to full-text parsing when no file boundary appears', async () => {
    const files: string[] = [];

    const fallback = await streamGitPatchFiles(
      streamFromChunks(['plain ', 'patch text']),
      async (fileText) => {
        files.push(fileText);
      }
    );

    expect(files).toEqual([]);
    expect(fallback).toBe('plain patch text');
  });
});

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}
