// Settings and scenario progress, saved as one small versioned JSON blob (ARCHITECTURE §8). Parsing
// is defensive: anything unreadable falls back to defaults rather than breaking the app.

/** localStorage key; the version is in the blob too, so a future v2 can migrate v1. */
export const SAVE_KEY = 'pumpops:v1';
const VERSION = 1;

/** Which pump panel to show: the grouped simplified panel, or the truck's real arrangement. */
export type PanelView = 'simplified' | 'realistic';

const PANEL_VIEWS: readonly PanelView[] = ['simplified', 'realistic'];

export interface Settings {
  /** Play the engine, primer, cavitation and spray sounds. */
  sound: boolean;
  /** The pump panel view; an appliance without a realistic layout shows the simplified one. */
  panelView: PanelView;
  /** The appliance the player trains on, by spec id; absent: the default. The store checks it. */
  applianceId?: string;
}

/** Best result on one scenario with one appliance. */
export interface ScenarioResult {
  passed: boolean;
  bestPoints: number;
  bestStars: number;
}

export interface Saved {
  version: typeof VERSION;
  settings: Settings;
  /** By scenario id, then appliance id. */
  results: Record<string, Record<string, ScenarioResult>>;
}

export function defaultSaved(): Saved {
  return { version: VERSION, settings: { sound: true, panelView: 'simplified' }, results: {} };
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function parseResult(x: unknown): ScenarioResult | undefined {
  if (!isRecord(x)) return undefined;
  const { passed, bestPoints, bestStars } = x;
  if (
    typeof passed !== 'boolean' ||
    typeof bestPoints !== 'number' ||
    typeof bestStars !== 'number'
  )
    return undefined;
  if (!Number.isFinite(bestPoints) || !Number.isFinite(bestStars)) return undefined;
  return { passed, bestPoints, bestStars };
}

/** A saved blob from its JSON text; defaults for anything missing, malformed or another version. */
export function parseSaved(text: string | null): Saved {
  const saved = defaultSaved();
  if (text === null) return saved;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return saved;
  }
  if (!isRecord(raw) || raw.version !== VERSION) return saved;
  if (isRecord(raw.settings)) {
    const { sound, panelView, applianceId } = raw.settings;
    if (typeof sound === 'boolean') saved.settings.sound = sound;
    if (typeof applianceId === 'string') saved.settings.applianceId = applianceId;
    const view = PANEL_VIEWS.find((v) => v === panelView);
    if (view !== undefined) saved.settings.panelView = view;
  }
  if (isRecord(raw.results)) {
    for (const [scenario, byAppliance] of Object.entries(raw.results)) {
      if (!isRecord(byAppliance)) continue;
      for (const [appliance, r] of Object.entries(byAppliance)) {
        const result = parseResult(r);
        if (result !== undefined) (saved.results[scenario] ??= {})[appliance] = result;
      }
    }
  }
  return saved;
}

/** `saved` with a finished attempt folded in: passed stays passed, bests only improve. */
export function recordResult(
  saved: Saved,
  scenarioId: string,
  applianceId: string,
  attempt: { passed: boolean; points: number; stars: number },
): Saved {
  const before = saved.results[scenarioId]?.[applianceId];
  const result: ScenarioResult = {
    passed: attempt.passed || before?.passed === true,
    bestPoints: Math.max(before?.bestPoints ?? 0, attempt.passed ? attempt.points : 0),
    bestStars: Math.max(before?.bestStars ?? 0, attempt.stars),
  };
  return {
    ...saved,
    results: {
      ...saved.results,
      [scenarioId]: { ...saved.results[scenarioId], [applianceId]: result },
    },
  };
}

/** The browser's localStorage, or null where it's missing or blocked (private mode, previews). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSaved(storage: Pick<Storage, 'getItem'> | null): Saved {
  try {
    return parseSaved(storage?.getItem(SAVE_KEY) ?? null);
  } catch {
    return defaultSaved();
  }
}

/** Write `saved`; a full or blocked storage just means it isn't kept. */
export function writeSaved(storage: Pick<Storage, 'setItem'> | null, saved: Saved): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Not saved: the game still plays.
  }
}
