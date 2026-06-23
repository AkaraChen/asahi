import { describe, expect, test } from 'bun:test';

import { parseSelectedRepositories } from '../src/shared/selectedRepositories';

describe('parseSelectedRepositories', () => {
  test('returns an empty list for corrupt or non-array storage', () => {
    expect(parseSelectedRepositories('{')).toEqual([]);
    expect(parseSelectedRepositories('{"owner":"asahi"}')).toEqual([]);
  });

  test('keeps only well-formed selected repositories', () => {
    expect(
      parseSelectedRepositories(
        JSON.stringify([
          { owner: 'akrc', name: 'asahi', nameWithOwner: 'akrc/asahi' },
          { owner: 'akrc', name: '', nameWithOwner: 'akrc/' },
          { owner: 'akrc', name: 'wrong', nameWithOwner: 'other/wrong' },
        ])
      )
    ).toEqual([{ owner: 'akrc', name: 'asahi', nameWithOwner: 'akrc/asahi' }]);
  });
});
