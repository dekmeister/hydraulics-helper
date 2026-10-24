// Fixture metadata as plain data, so Playwright specs can enumerate fixtures without importing React.
// Renderers live in renderers.tsx, keyed by the same ids (docs/TESTING.md §3.2).

export type ViewportName = 'phone' | 'tablet' | 'desktop';

export interface FixtureMeta {
  /** Path-like id, e.g. 'gauge/compound-vacuum'. Served at /?fixture=<id>. */
  id: string;
  /** What a reviewer should see; copied into review/report.md. */
  expect: string;
  /** Sim ticks to run before capture. */
  steps?: number;
  /** Default: all three. */
  viewports?: ViewportName[];
}

export const FIXTURES: readonly FixtureMeta[] = [
  {
    id: 'shell/empty',
    expect:
      'Two empty placeholder panels titled SCENE and PUMP PANEL on a dark background. ' +
      'At 375 and 768 px they are stacked, Scene above. At 1280 px they sit side by side, ' +
      'Scene left. No horizontal scroll.',
  },
];

/** File-safe name for screenshots and contact sheets: 'shell/empty' → 'shell-empty'. */
export function fixtureFileName(id: string): string {
  return id.replaceAll('/', '-');
}
