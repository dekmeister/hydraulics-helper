// Pump panel layout as data (ARCHITECTURE §9.4). Plain data only: e2e specs import layouts to
// enumerate what must be on screen, so nothing here may pull in React.
import type { ControlId } from '../../sim/types';
import type { DialId } from '../panel-pump/gauge/dials';

/** Identity glyph for a delivery tag (Design §2); triangle and diamond are reserved for signals. */
export type DeliveryGlyph = 'circle' | 'square' | 'bar' | 'hexagon';

/**
 * What a tap does on a lever valve, per appliance layout. 'toggle' snaps it fully open or shut;
 * 'none' means drag only, so a stray thumb never charges a line (Design §5). Cat 1 toggles every
 * valve, deliveries included (Dek, 2026-10-25).
 */
export type TapBehaviour = 'toggle' | 'none';

export type PanelItem =
  | {
      kind: 'gauge';
      /** Spec instrument id. */
      instrument: string;
      dial: DialId;
      /** Accessible name and the reading's label. */
      label: string;
      /** Face plate text; defaults to the dial's. */
      plate?: string;
      size: 'large' | 'medium';
    }
  | { kind: 'tank-level'; instrument: string; label: string }
  | {
      /** A lever valve that isn't a delivery: inlet valves, an adjustable relief wheel. */
      kind: 'valve';
      control: ControlId;
      label: string;
      /** Handle colour by function (Design §2): inlets green, outlets blue. */
      function: 'inlet' | 'outlet';
      tap: TapBehaviour;
    }
  | {
      kind: 'delivery';
      control: ControlId;
      label: string;
      /** Short tag shown beside the glyph, e.g. 'D1'. */
      tag: string;
      glyph: DeliveryGlyph;
      tap: TapBehaviour;
    }
  | { kind: 'throttle'; variant: 't-handle'; label: string }
  | { kind: 'primer'; control: ControlId; label: string }
  | { kind: 'warnings' };

export interface PanelSection {
  id: string;
  /** Section heading, e.g. 'Deliveries'; null for an untitled group. */
  title: string | null;
  /**
   * 'row' wraps items side by side; 'list' stacks full-width rows; 'cards' sets them side by side
   * as cards where the panel is wide enough, else stacks them as rows.
   */
  arrangement: 'row' | 'list' | 'cards';
  /** 'half': on a wide panel, consecutive half sections share a row. Full width when omitted. */
  span?: 'half';
  items: PanelItem[];
}

export interface PanelLayout {
  applianceId: string;
  sections: PanelSection[];
}

// ---------------------------------------------------------------------------
// Scene art (ARCHITECTURE §9.4): how the appliance is drawn on the plan-view scene.
// ---------------------------------------------------------------------------

/**
 * A coupling on the truck, in truck-local drawing units: origin at the body's centre, +x towards
 * the cab, +y towards the truck's right-hand side. Deliveries take hose lays; external inlets take
 * supply hoses (hard suction, layflat from a hydrant).
 */
export interface SceneCoupling {
  /** Spec control id: a delivery or an external inlet (suction, tank fill). */
  control: ControlId;
  kind: 'delivery' | 'inlet';
  x: number;
  y: number;
  /** Way the coupling points, degrees in the same frame: 0 forward, 90 right, 180 rearward. */
  facingDeg: number;
}

/**
 * Top-down truck art. Units are scene drawing units: the truck is a map symbol drawn larger than
 * the hose scale, so these are not metres.
 */
export interface SceneArt {
  applianceId: string;
  /** Body length, cab included, and width. */
  lengthU: number;
  widthU: number;
  /** Cab length at the front of the body. */
  cabU: number;
  /** Round tank hatch on the body (tankers). */
  hatch: boolean;
  /** One coupling per spec delivery and per external inlet (the tank feed is internal). */
  couplings: SceneCoupling[];
}
