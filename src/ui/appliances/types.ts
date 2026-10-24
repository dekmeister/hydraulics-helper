// Pump panel layout as data (ARCHITECTURE §9.4). Plain data only: e2e specs import layouts to
// enumerate what must be on screen, so nothing here may pull in React.
import type { ControlId } from '../../sim/types';
import type { DialId } from '../panel-pump/gauge/dials';

/** Identity glyph for a delivery tag (Design §2); triangle and diamond are reserved for signals. */
export type DeliveryGlyph = 'circle' | 'square' | 'bar' | 'hexagon';

/**
 * What a tap does on a lever valve. 'toggle' snaps it fully open or shut; 'none' means drag only,
 * so a stray thumb never charges a line (Design §5).
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
  /** 'row' wraps items side by side; 'list' stacks full-width rows. */
  arrangement: 'row' | 'list';
  items: PanelItem[];
}

export interface PanelLayout {
  applianceId: string;
  sections: PanelSection[];
}
