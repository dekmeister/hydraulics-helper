import { describe, expect, it } from 'vitest';
import { defaultSaved, loadSaved, parseSaved, recordResult, SAVE_KEY, writeSaved } from './persist';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    data,
  };
}

describe('saved settings and progress', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const saved = recordResult(
      {
        ...defaultSaved(),
        settings: { sound: false, panelView: 'realistic', applianceId: 'cat7-generic' },
      },
      'first-line',
      'cat1-generic',
      { passed: true, points: 92, stars: 3 },
    );
    writeSaved(storage, saved);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
    expect(loadSaved(storage)).toEqual(saved);
  });

  it('ignores an appliance id that isn’t a string', () => {
    const text = JSON.stringify({ version: 1, settings: { applianceId: 7 }, results: {} });
    expect(parseSaved(text).settings.applianceId).toBeUndefined();
  });

  it('falls back to defaults on junk, other versions and missing storage', () => {
    expect(parseSaved('not json')).toEqual(defaultSaved());
    expect(parseSaved('{"version":2,"settings":{"sound":false}}')).toEqual(defaultSaved());
    expect(parseSaved(null)).toEqual(defaultSaved());
    expect(loadSaved(null)).toEqual(defaultSaved());
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadSaved(throwing)).toEqual(defaultSaved());
    expect(() => {
      writeSaved(throwing, defaultSaved());
    }).not.toThrow();
  });

  it('keeps the good parts of a partly malformed blob', () => {
    const saved = parseSaved(
      JSON.stringify({
        version: 1,
        settings: { sound: 'loud' },
        results: {
          a: { x: { passed: true, bestPoints: 80, bestStars: 2 }, y: { passed: 'yes' } },
          b: 'nope',
        },
      }),
    );
    expect(saved.settings.sound).toBe(true);
    expect(saved.results).toEqual({ a: { x: { passed: true, bestPoints: 80, bestStars: 2 } } });
  });

  it('defaults the panel view to realistic, and keeps only a view it knows', () => {
    expect(defaultSaved().settings.panelView).toBe('realistic');
    const blob = (panelView: unknown) =>
      parseSaved(JSON.stringify({ version: 1, settings: { sound: true, panelView } }));
    expect(blob('simplified').settings.panelView).toBe('simplified');
    expect(blob('photo').settings.panelView).toBe('realistic');
    // A v1 blob saved before the setting existed still loads.
    expect(parseSaved('{"version":1,"settings":{"sound":false}}').settings).toEqual({
      sound: false,
      panelView: 'realistic',
    });
  });

  it('keeps the best result: a pass stays a pass, bests only improve', () => {
    let s = recordResult(defaultSaved(), 's', 'a', { passed: true, points: 80, stars: 2 });
    s = recordResult(s, 's', 'a', { passed: false, points: 95, stars: 0 });
    expect(s.results.s?.a).toEqual({ passed: true, bestPoints: 80, bestStars: 2 });
    s = recordResult(s, 's', 'a', { passed: true, points: 96, stars: 3 });
    expect(s.results.s?.a).toEqual({ passed: true, bestPoints: 96, bestStars: 3 });
  });
});
