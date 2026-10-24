/**
 * Truck layout data model.
 *
 * Idea: every truck type shares the same *vocabulary* (zones, item roles, sim bindings);
 * each type only changes positions, sizes, presence and control variants.
 * The simplified panel and the realistic bay are two *views* of the same layout data,
 * so a trainee who learns "D2 = outlet 1" in the simplified view finds it in the same
 * place on the realistic view.
 *
 * Coordinates are in the drawing space of the reference sheets:
 *   - `bay`     : sheet 07 rear elevation, viewBox 0 0 1440 860 (px ≈ 0.5 mm at the truck)
 *   - `closeUp` : sheet 08 panel close-up, viewBox 0 0 960 820 (zone C items only)
 * They are layout positions for drawing, not survey measurements.
 */

export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'E';

/** What the player does with it. Drives hit-area and affordance rendering. */
export type Interaction =
  | 'read'          // gauges, lamps (lamps are also 'tap' to acknowledge)
  | 'drag-rotate'   // quarter-turn lever valves: drag through 90°
  | 'rotate'        // vernier throttle knob, key switch
  | 'tap'           // momentary buttons, lamp acknowledge
  | 'hold'          // primer
  | 'none';         // context only (reel drum, placards, pump body)

export type ItemKind =
  | 'gauge' | 'lamp' | 'valve' | 'coupling' | 'button' | 'key-switch' | 'knob'
  | 'reel' | 'nozzle' | 'placard' | 'pump' | 'estop';

/** Real-truck handle colour convention: inlets green, outlets blue. */
export type FlowFunction = 'inlet' | 'outlet' | null;

export type GaugeVariant = 'compound' | 'pressure' | 'tachometer' | 'small' | 'mini';
export type ThrottleVariant = 'vernier-knob' | 't-handle';

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

export interface LayoutItem {
  id: string;                 // zone-scoped id, stable across truck types: 'D2', 'C1'
  zone: ZoneId;
  kind: ItemKind;
  /** Semantic role, stable across truck types. The game logic keys off this, never off id. */
  role: string;
  label: string;              // what the trainee is told it is
  function: FlowFunction;
  interaction: Interaction;
  bay: Point;                 // centre on sheet 07
  closeUp?: Point;            // centre on sheet 08 (zone C only)
  radius?: number;            // for round items, in the closeUp space if present, else bay space
  bounds?: Box;               // for large items, bay space
  sizeMm?: number;            // coupling / outlet nominal size
  gauge?: GaugeVariant;
  throttle?: ThrottleVariant;
  /** Suggested simulation binding. Rename to match the sim model; keep it identical across trucks. */
  sim?: string;
  /** true when the position or function was inferred, not seen in the reference photo. */
  assumed?: boolean;
  notes?: string;
}

export interface Zone {
  id: ZoneId;
  name: string;
  bounds: Box;                // bay space; zones are logical groups and may overlap
  note?: string;
}

export interface TruckLayout {
  id: string;                 // 'layout-a'
  name: string;
  description: string;
  source: string;             // provenance of the layout
  drawing: { bayViewBox: [number, number, number, number]; closeUpViewBox: [number, number, number, number] };
  zones: Zone[];
  items: LayoutItem[];
}
