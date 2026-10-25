// Realistic pump-bay layout as data (ARCHITECTURE §9.4): the real arrangement of a truck's panel
// and plumbing, simplified as a part-task trainer. Plain data only, like the panel layout: e2e
// specs import it. Accessible names, delivery tags and tap behaviour come from the appliance's
// simplified layout, so both views name every control the same way.
import type { ControlId } from '../../sim/types';
import type { WaterRef } from '../../state/plumbing';
import type { DialId } from '../panel-pump/gauge/dials';

/** Plate drawing units: each plate has its own viewBox, scaled to the panel's width. */
export interface RPoint {
  x: number;
  y: number;
}

export interface RBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A quarter-turn lever on a pipe: it swings in the plane of the drawing from `shutDeg` (across the
 * pipe) to `openDeg` (along it), degrees clockwise from 12 o'clock, 90° apart either way round.
 */
export interface LeverGeometry {
  pivot: RPoint;
  shutDeg: number;
  openDeg: number;
  lengthU: number;
}

/** How an item that isn't in the game yet is drawn: simply, and labelled as future work. */
export type InertLook =
  | 'button'
  | 'toggle'
  | 'lamp'
  | 'dial'
  | 'knobs'
  | 'placard'
  | 'fuses'
  | 'indicator'
  | 'reel'
  | 'valve';

export type RealItem =
  | { kind: 'gauge'; instrument: string; dial: DialId; box: RBox }
  | { kind: 'tank-gauge'; instrument: string; box: RBox }
  | ({ kind: 'lever'; control: ControlId } & LeverGeometry)
  | ({
      /** A delivery: its lever, and its coupling with the number plate (the scene locate button). */
      kind: 'outlet';
      control: ControlId;
      coupling: RBox;
    } & LeverGeometry)
  | {
      /** 'pull-handle': a T-handle pulled out (Cat 1). 'hand-pump': a hand primer's handle, stroked. */
      kind: 'primer';
      control: ControlId;
      variant: 'pull-handle' | 'hand-pump';
      box: RBox;
    }
  | {
      /**
       * 'speed-switch': a momentary speed controller (`EngineSpec.speedController`), ramps while
       * held. 'vernier': a vernier knob (`EngineSpec.vernier`), pushed, pulled and twisted.
       */
      kind: 'throttle';
      variant: 'speed-switch' | 'vernier';
      box: RBox;
    }
  | {
      kind: 'inert';
      id: string;
      /** What it is on the truck, e.g. 'Ignition switch'. */
      label: string;
      look: InertLook;
      box: RBox;
      /** Placard lines, for a placard; a knob panel's legend, for knobs. */
      text?: readonly string[];
    };

/** Which way a pipe end or nozzle points. */
export type PipeDir = 'up' | 'down' | 'left' | 'right';

/**
 * Backdrop art for a plate: drawn under the items, in order, never interactive. Pipes have square
 * ends: author each run to end on a pipe centreline (hidden under a `fitting`), a coupling's
 * centre, the pump's eye, or the plate edge (capped with a `flange`).
 *
 * A pipe or casing with `water` shows what the water in that stretch is doing (flowing, still or
 * none). Split such pipes at every valve's pivot, since each side of a valve holds its own water,
 * and draw each run the way the water flows: the flow streaks follow the path.
 */
export type PlateArt =
  | { kind: 'panel'; box: RBox }
  | { kind: 'pipe'; d: string; widthU: number; water?: WaterRef }
  | {
      /**
       * A radial pump seen from the front: water enters at the eye (the centre; draw the inlet
       * pipe after the casing, ending on it, and a `fitting` there for the eye) and leaves through
       * a nozzle tangent to the volute's edge, ending at `outlet` with a flange.
       */
      kind: 'casing';
      cx: number;
      cy: number;
      r: number;
      label: string;
      outlet: RPoint & { dir: PipeDir; widthU: number };
      water?: WaterRef;
    }
  | { kind: 'coupling'; cx: number; cy: number; r: number }
  /** A tee, elbow or the pump's eye: a collar over the joint. */
  | { kind: 'fitting'; cx: number; cy: number; r: number }
  /** A flange across a pipe's end at the plate edge, the pipe running `along` it. */
  | { kind: 'flange'; x: number; y: number; widthU: number; along: 'h' | 'v' }
  /** A red label plate centred on (x, y); `w` fixes its width (text squeezes to fit). */
  | { kind: 'plate'; x: number; y: number; text: string; w?: number }
  | { kind: 'text'; x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' };

export interface RealPlate {
  id: string;
  /** Caption above the plate (insets say where on the truck they are); null for none. */
  caption: string | null;
  viewBox: { w: number; h: number };
  /** Insets sit side by side in one row under the main plates, sharing its width by viewBox width. */
  inset: boolean;
  art: readonly PlateArt[];
  items: readonly RealItem[];
}

export interface RealisticLayout {
  applianceId: string;
  /** Main plates top to bottom (as on the truck), then the insets. */
  plates: readonly RealPlate[];
}
