import { describe, expect, test } from 'bun:test';

import { createDesktopCliPath } from '../src/main/cliPath';

describe('createDesktopCliPath', () => {
  test('preserves existing entries and adds common macOS CLI paths', () => {
    const path = createDesktopCliPath('/usr/bin:/bin', '/Users/tester');
    const entries = path.split(':');

    expect(entries.slice(0, 2)).toEqual(['/usr/bin', '/bin']);
    expect(entries).toContain('/opt/homebrew/bin');
    expect(entries).toContain('/usr/local/bin');
    expect(entries).toContain('/Users/tester/.local/bin');
    expect(entries).toContain('/Users/tester/.cargo/bin');
  });

  test('deduplicates entries without reordering existing path entries', () => {
    const path = createDesktopCliPath(
      '/opt/homebrew/bin:/usr/bin:/opt/homebrew/bin',
      '/Users/tester'
    );

    expect(
      path.split(':').filter((entry) => entry === '/opt/homebrew/bin')
    ).toHaveLength(1);
    expect(path.split(':').slice(0, 2)).toEqual([
      '/opt/homebrew/bin',
      '/usr/bin',
    ]);
  });
});
