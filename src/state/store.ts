import { create } from 'zustand';
import { APPLIANCES, getAppliance } from '../sim/appliances/catalogue';
import { switchControlIds, valveControlIds } from '../sim/appliances/controls';
import { TICK_S } from '../sim/constants';
import { advance, switchTruck } from '../sim/engine';
import { getScenario } from '../sim/scenarios';
import { supports } from '../sim/scenarios/types';
import { TANK_ATTACK } from '../sim/scenarios/tankAttack';
import type {
  ApplianceSpec,
  ControlId,
  InstrumentKind,
  PlayerInputs,
  SimState,
} from '../sim/types';
import { acknowledge, advanceCoach } from '../sim/lesson/progress';
import type { SupportSpecs } from '../sim/scenarios/types';
import { rampedThrottle, type ThrottleRamp } from './throttleRamp';
import { beginLesson, recordIfEnded, stepActive, type ActiveLesson } from './lesson';
import { browserStorage, loadSaved, writeSaved, type PanelView, type Saved } from './persist';
import { activeTruck, instrumentValue } from './selectors';

/** Appliance a new player trains on until they pick another on the menu. */
export const DEFAULT_APPLIANCE_ID = 'cat1-generic';

/** The catalogue appliance with `id`, or the default for an unknown or missing id. */
export function playerAppliance(id: string | undefined): ApplianceSpec {
  return APPLIANCES.find((a) => a.id === id) ?? getAppliance(DEFAULT_APPLIANCE_ID);
}

/** Start-up state: the tank-attack lines laid on `spec` (default appliance), every control shut. */
export function defaultSim(spec: ApplianceSpec = getAppliance(DEFAULT_APPLIANCE_ID)): SimState {
  return TANK_ATTACK.build(spec).state;
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

/** Sim seconds of readings kept for the gauges' Wake (Design §6: the last 3 s, plus a tick). */
export const WAKE_HISTORY_S = 3.1;

const WAKE_KINDS: readonly InstrumentKind[] = ['compound', 'discharge', 'tacho'];

/** One tick's displayed readings, for the Wake. */
export interface WakeSample {
  tS: number;
  values: Readonly<Partial<Record<InstrumentKind, number>>>;
}

function wakeSample(sim: SimState): WakeSample {
  const truck = activeTruck(sim);
  return {
    tS: sim.timeS,
    values: Object.fromEntries(WAKE_KINDS.map((k) => [k, instrumentValue(truck, k)])),
  };
}

/** Which side of the scene↔panel correspondence asked for a highlight. */
export type HighlightSource = 'scene' | 'panel';

/** A delivery picked out on both panels (UI state only, never sim state). */
export interface Highlight {
  /** The truck the delivery is on: always the active one (a switch clears the highlight). */
  truckId: string;
  deliveryId: ControlId;
  from: HighlightSource;
}

/** What fills the screen: the scenario menu, the panels, a lesson's debrief, or About. */
export type Screen = 'menu' | 'play' | 'debrief' | 'about';

interface PumpOpsStore {
  screen: Screen;
  /** Show the scenario menu; the sim stays as it is, to resume. */
  openMenu: () => void;
  /** Back to the panels. */
  openPlay: () => void;
  /** Show the debrief for the lesson in play. */
  openDebrief: () => void;
  /** The screen About goes back to. */
  aboutReturn: Screen;
  /** Show About; the sim pauses as on the menu. */
  openAbout: () => void;
  /** Back to the screen About was opened from. */
  closeAbout: () => void;
  /** The lesson being played; null in free play (the sandbox). */
  lesson: ActiveLesson | null;
  /**
   * Start a scenario's lesson on the player's appliance (or `spec`, with support roles on
   * `support`) and show the panels. Throws if it can't be played there.
   */
  startLesson: (id: string, opts?: { spec?: ApplianceSpec; support?: SupportSpecs }) => void;
  /** The player has read the current coach step ('Got it'). */
  acknowledgeCoach: () => void;
  /** The lesson dock's full objective list is open (UI state). */
  lessonListOpen: boolean;
  setLessonListOpen: (open: boolean) => void;
  /** Settings and progress, as saved. */
  saved: Saved;
  setSound: (on: boolean) => void;
  setPanelView: (view: PanelView) => void;
  sim: SimState;
  /**
   * What the player has set on the panel; applied to the active truck on every tick. Every other
   * truck's controls live in the sim (`TruckState.inputs`), where they're held.
   */
  inputs: PlayerInputs;
  /**
   * Run `ticks` fixed sim steps synchronously. The only way sim time moves, and only on the play
   * screen: the menu and debrief pause the sim (and any lesson) where it stands.
   */
  step: (ticks: number) => void;
  /**
   * Replace the sim state wholesale (free play, test fixtures) and show the panels; ends any
   * lesson and clears the scenario id unless given.
   */
  reset: (sim?: SimState, scenarioId?: string | null) => void;
  /** Scenario the sim was loaded from, if any (the header picker shows it). */
  scenarioId: string | null;
  /**
   * The player's own appliance: the truck active when the sim was loaded. Scenarios are built
   * and offered on it, whichever truck the player is operating now.
   */
  playerSpec: ApplianceSpec;
  /** Load a scenario's initial state on the player's appliance for free play; throws if it can't play it. */
  loadScenario: (id: string) => void;
  /**
   * Train on another catalogue appliance (saved): ends any lesson and loads free play's tank attack
   * on it, staying on the screen showing. Throws on an id not in the catalogue.
   */
  setPlayerAppliance: (id: string) => void;
  /** Displayed readings for the last `WAKE_HISTORY_S` of sim time, oldest first. */
  wake: readonly WakeSample[];
  setThrottle: (position: number) => void;
  /** A speed switch held one way (null: released); the throttle ramps on every sim tick. */
  throttleRamp: ThrottleRamp | null;
  /** Push a speed switch: flick the throttle by `rates.flick` now, then ramp at `rates.perS`. */
  pressSpeedSwitch: (direction: 1 | -1, rates: { perS: number; flick: number }) => void;
  releaseSpeedSwitch: () => void;
  /** Set a valve-type control (0 shut – 1 open) by spec control id. */
  setValve: (id: ControlId, open: number) => void;
  /** Set an on/off control (primer) by spec control id. */
  setSwitch: (id: ControlId, on: boolean) => void;
  /**
   * Operate another truck: the controls set on this one stay held on it, the panel takes the
   * other's. Clears the highlight and the Wake (both belong to the truck left).
   */
  setActiveTruck: (truckId: string) => void;
  highlight: Highlight | null;
  /** Highlight a delivery on the scene and panel, or clear it if it's already highlighted. */
  toggleHighlight: (deliveryId: ControlId, from: HighlightSource) => void;
}

const initialSaved = loadSaved(browserStorage());
const initialSim = defaultSim(playerAppliance(initialSaved.settings.applianceId));

/** Save `saved` if it changed. */
function persist(before: Saved, after: Saved): Saved {
  if (after !== before) writeSaved(browserStorage(), after);
  return after;
}

export const useStore = create<PumpOpsStore>()((set, get) => ({
  screen: 'menu',
  openMenu: () => {
    set({ screen: 'menu' });
  },
  openPlay: () => {
    set({ screen: 'play' });
  },
  openDebrief: () => {
    if (get().lesson !== null) set({ screen: 'debrief' });
  },
  aboutReturn: 'menu',
  openAbout: () => {
    const { screen } = get();
    if (screen !== 'about') set({ screen: 'about', aboutReturn: screen });
  },
  closeAbout: () => {
    set(({ aboutReturn }) => ({ screen: aboutReturn }));
  },
  lesson: null,
  startLesson: (id, opts = {}) => {
    const { sim, lesson } = beginLesson(id, opts.spec ?? get().playerSpec, opts.support);
    get().reset(sim, id);
    set({ lesson });
  },
  acknowledgeCoach: () => {
    set(({ lesson, sim }) => {
      if (lesson === null) return {};
      const step = lesson.def.coach?.[lesson.progress.coachIndex];
      if (step === undefined || step.done !== undefined) return {};
      const acked = acknowledge(lesson.def, lesson.progress, step.id);
      return { lesson: { ...lesson, progress: advanceCoach(lesson.def, acked, sim) } };
    });
  },
  lessonListOpen: false,
  setLessonListOpen: (open) => {
    set({ lessonListOpen: open });
  },
  saved: initialSaved,
  setSound: (on) => {
    set(({ saved }) => ({
      saved: persist(saved, { ...saved, settings: { ...saved.settings, sound: on } }),
    }));
  },
  setPanelView: (view) => {
    set(({ saved }) => ({
      saved: persist(saved, { ...saved, settings: { ...saved.settings, panelView: view } }),
    }));
  },
  sim: initialSim,
  inputs: activeTruck(initialSim).inputs,
  playerSpec: activeTruck(initialSim).spec,
  highlight: null,
  scenarioId: TANK_ATTACK.id,
  wake: [],
  step: (ticks) => {
    set(({ screen, sim, inputs, wake, lesson, saved, throttleRamp }) => {
      if (screen !== 'play') return {};
      let next = sim;
      let panel = inputs;
      let playing = lesson;
      const samples = [...wake];
      for (let i = 0; i < ticks; i++) {
        if (throttleRamp !== null)
          panel = { ...panel, throttle: rampedThrottle(panel.throttle, throttleRamp, TICK_S) };
        next = advance(next, panel, TICK_S);
        if (playing !== null) {
          const held = activeTruck(next).inputs;
          ({ sim: next, lesson: playing } = stepActive(playing, next, TICK_S));
          // An event that set the operated truck's controls (a support truck the player has
          // switched to) moves the panel with them, or the next tick would undo it.
          if (activeTruck(next).inputs !== held) panel = activeTruck(next).inputs;
        }
        samples.push(wakeSample(next));
      }
      const cutoff = next.timeS - WAKE_HISTORY_S;
      const recorded =
        lesson === null || playing === null
          ? saved
          : persist(saved, recordIfEnded(lesson.progress, playing, next, saved));
      return {
        sim: next,
        inputs: panel,
        lesson: playing,
        saved: recorded,
        wake: samples.filter((w) => w.tS >= cutoff),
      };
    });
  },
  reset: (sim, scenarioId) => {
    const next = sim ?? defaultSim(get().playerSpec);
    set({
      screen: 'play',
      lesson: null,
      sim: next,
      inputs: activeTruck(next).inputs,
      playerSpec: activeTruck(next).spec,
      highlight: null,
      throttleRamp: null,
      wake: [],
      scenarioId: scenarioId !== undefined ? scenarioId : sim === undefined ? TANK_ATTACK.id : null,
    });
  },
  loadScenario: (id) => {
    const spec = get().playerSpec;
    const scenario = getScenario(id);
    if (!supports(scenario, spec)) throw new Error(`${spec.id} can’t play '${id}'`);
    get().reset(scenario.build(spec).state, id);
  },
  setPlayerAppliance: (id) => {
    const spec = getAppliance(id);
    const { screen, saved } = get();
    set({
      saved: persist(saved, { ...saved, settings: { ...saved.settings, applianceId: id } }),
    });
    if (get().playerSpec.id === id) return;
    get().reset(defaultSim(spec), TANK_ATTACK.id);
    set({ screen });
  },
  throttleRamp: null,
  pressSpeedSwitch: (direction, rates) => {
    set(({ inputs }) => ({
      inputs: { ...inputs, throttle: clamp01(inputs.throttle + direction * rates.flick) },
      throttleRamp: { direction, perS: rates.perS },
    }));
  },
  releaseSpeedSwitch: () => {
    set({ throttleRamp: null });
  },
  setThrottle: (position) => {
    set(({ inputs }) => ({ inputs: { ...inputs, throttle: clamp01(position) } }));
  },
  setValve: (id, open) => {
    if (!valveControlIds(activeTruck(get().sim).spec).includes(id)) {
      throw new Error(`setValve: '${id}' is not a valve on the active appliance`);
    }
    set(({ inputs }) => ({
      inputs: { ...inputs, valves: { ...inputs.valves, [id]: clamp01(open) } },
    }));
  },
  setSwitch: (id, on) => {
    if (!switchControlIds(activeTruck(get().sim).spec).includes(id)) {
      throw new Error(`setSwitch: '${id}' is not a switch on the active appliance`);
    }
    set(({ inputs }) => ({ inputs: { ...inputs, switches: { ...inputs.switches, [id]: on } } }));
  },
  setActiveTruck: (truckId) => {
    set(({ sim, inputs }) => {
      const next = switchTruck(sim, truckId, inputs);
      return {
        sim: next,
        inputs: activeTruck(next).inputs,
        highlight: null,
        wake: [],
        throttleRamp: null,
      };
    });
  },
  toggleHighlight: (deliveryId, from) => {
    const truck = activeTruck(get().sim);
    if (!truck.spec.deliveries.some((d) => d.id === deliveryId)) {
      throw new Error(`toggleHighlight: '${deliveryId}' is not a delivery on the active appliance`);
    }
    set(({ highlight }) => ({
      highlight:
        highlight?.truckId === truck.id && highlight.deliveryId === deliveryId
          ? null
          : { truckId: truck.id, deliveryId, from },
    }));
  },
}));
