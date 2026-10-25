// A lesson: what the player must do in a scenario, what can go wrong, what happens along the way
// and how a guided scenario coaches them (ARCHITECTURE §5). Plain, JSON-shaped data: everything is
// named symbolically (a line, an inlet kind, a gauge), never by a spec control id, so one lesson
// plays on every appliance that can play the scenario.
import type { HoseSegment, InletKind, InstrumentKind, WaterSource } from '../types';

/** A valve on a truck, named by what it does rather than its spec id. */
export type ValveRef =
  /** The truck's first inlet of this kind: the tank-to-pump feed or the suction inlet. */
  | { inlet: InletKind; truck?: string }
  /** The delivery a line or relay hose is on (and so its truck). */
  | { line: string };

/** Something the coach points at on the pump panel. */
export type CoachTarget =
  | { valve: ValveRef }
  | { throttle: true }
  | { primer: true }
  | { gauge: InstrumentKind }
  | { lamps: true };

/** Inclusive bounds; a missing bound is open. */
export interface Range {
  min?: number;
  max?: number;
}

/** Gauges a condition can read, in their native units (kPa, rpm). */
export type GaugeId = 'discharge' | 'compound' | 'rpm';

/** Fault counters a condition can read (`FaultTally`). */
export type TallyId = 'cavitationS' | 'overheatS' | 'waterHammer' | 'hoseBursts';

/**
 * A yes/no question about the fireground. Truck-scoped kinds default to the player's truck (the
 * one active when the scenario loaded).
 */
export type Condition =
  /** A valve's opening, 0–1. */
  | ({ kind: 'valve'; valve: ValveRef } & Range)
  | ({ kind: 'throttle'; truck?: string } & Range)
  | ({ kind: 'gauge'; gauge: GaugeId; truck?: string } & Range)
  /** Water in the tank as a fraction of capacity, 0–1. */
  | ({ kind: 'tank'; truck?: string } & Range)
  /** The branch on `line` is within its working band (Table 1 pressure for its tip ± a margin). */
  | { kind: 'branch'; line: string }
  /** Flow out of the delivery `line` is on, L/min. */
  | ({ kind: 'flow'; line: string } & Range)
  | { kind: 'primed'; truck?: string }
  | { kind: 'cavitating'; truck?: string }
  /** Water left in a static source, L. */
  | ({ kind: 'source'; source: string } & Range)
  /** A relay hose has burst (and not been repaired). */
  | { kind: 'burst'; link: string }
  | ({ kind: 'tally'; tally: TallyId; truck?: string } & Range)
  /** Sim time, s. */
  | ({ kind: 'time' } & Range)
  /** The player has acknowledged a read-only coach step. */
  | { kind: 'ack'; step: string }
  | { kind: 'objective'; objective: string }
  /** At least `s` seconds since an event fired. */
  | { kind: 'since'; event: string; s: number }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

export interface Objective {
  id: string;
  /** What the player is asked to do, e.g. 'Hold the branch at working pressure for 30 s'. */
  text: string;
  when: Condition;
  /** Seconds `when` must hold without a break; default 0 (once is enough). */
  holdS?: number;
  /** Objectives that must be done before this one starts counting. */
  after?: string[];
}

/** Ends the lesson as failed the moment its condition holds. */
export interface Failure {
  id: string;
  /** Why, in a sentence: shown on the debrief. */
  text: string;
  when: Condition;
}

/** A line the crew lays during the scenario, on the free delivery closest in size. */
export interface LineDef {
  id: string;
  hose: string;
  lengths: number;
  tipMm: number;
  elevationM?: number;
  truck?: string;
}

/** A change to the fireground, applied between ticks. */
export type Effect =
  | { kind: 'layLine'; line: LineDef }
  /** The crew moves the branch: extra standard lengths of the line's last hose, a new height. */
  | { kind: 'moveBranch'; line: string; addLengths?: number; elevationM?: number }
  /** A source (if new) and a supply hose to a truck's suction inlet. */
  | {
      kind: 'connectSupply';
      source?: WaterSource;
      supply: { id: string; sourceId: string; truck?: string; segments: HoseSegment[] };
    }
  | { kind: 'repairRelay'; link: string }
  /** A support truck's operator changes the settings it holds. */
  | { kind: 'holdSettings'; truck: string; throttle?: number };

/** Who is on the radio, e.g. 'Branch 1', 'OIC', 'Base pump'. */
export interface RadioCall {
  from: string;
  text: string;
}

export interface ScenarioEvent {
  id: string;
  /** Fires once, the first tick this holds. */
  when: Condition;
  effects?: Effect[];
  radio?: RadioCall;
}

/** One guided step: the coach's words, what it points at, and when it moves on. */
export interface CoachStep {
  id: string;
  /** `{target}` is replaced by the target's panel label. */
  text: string;
  target?: CoachTarget;
  /** Default: the player acknowledges it ('Got it'). */
  done?: Condition;
}

export interface LessonDef {
  /** Position on the scenario ladder, 1 = first. */
  ladder: number;
  /** A short paragraph: the situation and the lesson. */
  brief: string;
  objectives: Objective[];
  failures?: Failure[];
  events?: ScenarioEvent[];
  /** Guided scenarios walk the player through these in order. */
  coach?: CoachStep[];
}
