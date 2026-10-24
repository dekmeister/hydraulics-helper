import { describe, expect, it } from 'vitest';
import { FIXTURES } from './catalog';
import { FIXTURE_RENDERERS } from './renderers';

describe('fixture registry', () => {
  it('has unique ids', () => {
    const ids = FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FIXTURES)('$id has a path-like id and a review caption', (f) => {
    expect(f.id).toMatch(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/);
    expect(f.expect.trim()).not.toBe('');
  });

  it('has exactly one renderer per catalogued fixture', () => {
    expect(Object.keys(FIXTURE_RENDERERS).sort()).toEqual(FIXTURES.map((f) => f.id).sort());
  });
});
