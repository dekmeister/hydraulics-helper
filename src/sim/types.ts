// Plain, serialisable sim data (ARCHITECTURE §4.8, §9.2).

/** Id of a control or instrument as defined by an appliance spec, e.g. 'd1', 'tank-to-pump'. */
export type ControlId = string;

/** Key into the shared hose catalogue (`HOSES` in constants.ts), e.g. '38L' = 38 mm lined. */
export type HoseId = string;

// ---------------------------------------------------------------------------
// Appliance spec: immutable data describing one vehicle type (ARCHITECTURE §9).
// ---------------------------------------------------------------------------

/** Centrifugal pump curve: P = shutoffKpa·(rpm/maxRpm)² − droopKpaPerLpm2·Q². */
export interface PumpSpec {
  /** Pump pressure rise at zero flow and max rpm, kPa. */
  shutoffKpa: number;
  /** Curve droop, kPa per (L/min)². */
  droopKpaPerLpm2: number;
}

/** Engine driving the pump. Rpm chases the throttle with a first-order lag. */
export interface EngineSpec {
  idleRpm: number;
  maxRpm: number;
  /** First-order lag time constant, seconds. */
  rpmLagS: number;
}

export interface TankSpec {
  capacityL: number;
}

export type InletKind = 'tank' | 'hydrant' | 'draught' | 'relay';

export interface InletSpec {
  /** Control id of this inlet's valve, e.g. 'tank-to-pump'. */
  id: ControlId;
  label: string;
  kind: InletKind;
  /** Loss through the inlet path with the valve fully open, kPa per (L/min)². */
  lossKpaPerLpm2: number;
  sizeMm?: number;
}

export interface DeliverySpec {
  /** Control id of this delivery's valve, e.g. 'd1'. */
  id: ControlId;
  label: string;
  sizeMm: number;
}

/** How the pump is primed for draughting. Data only in M1; behaviour arrives in M4. */
export type PrimerSpec =
  | {
      kind: 'rotaryVane';
      /** Control id of the primer switch. */
      id: ControlId;
      /** Max continuous run, s. */
      maxOnS: number;
      /** Duty period the max run applies within, s. */
      periodS: number;
    }
  | { kind: 'diaphragm'; /** Control id of the primer handle. */ id: ControlId }
  | { kind: 'selfPriming' };

/**
 * Pressure relief: a bypass that opens above `setKpa` and dumps flow back to the tank or pump inlet.
 * 'preset' is fixed at the factory; 'adjustable' takes the set pressure from a panel control.
 */
export type ReliefSpec =
  | { kind: 'preset'; setKpa: number; dumpTo: 'tank' | 'inlet'; slopeLpmPerKpa: number }
  | {
      kind: 'adjustable';
      /** Control id of the set-pressure wheel; its 0–1 valve input maps onto [minKpa, maxKpa]. */
      id: ControlId;
      minKpa: number;
      maxKpa: number;
      dumpTo: 'tank' | 'inlet';
      slopeLpmPerKpa: number;
    };

export type InstrumentKind = 'compound' | 'discharge' | 'tacho' | 'tank';

/** A coloured band on a dial face, in the instrument's unit. */
export interface GaugeZone {
  from: number;
  to: number;
  tone: 'caution' | 'alarm';
}

/**
 * Markings on a fitted dial gauge. Display data only: the sim never reads it. Compound gauges also
 * carry a fixed −100…0 kPa vacuum sector, so their zones may go negative.
 */
export interface GaugeScaleSpec {
  /** Top of the scale, in the instrument's unit (kPa or rpm). */
  fullScale: number;
  zones: GaugeZone[];
}

export type InstrumentSpec =
  | { id: string; kind: Exclude<InstrumentKind, 'tank'>; scale: GaugeScaleSpec }
  | { id: string; kind: 'tank' };

export interface ApplianceSpec {
  /** Stable id used in saves and scenarios, e.g. 'cat1-generic'. */
  id: string;
  /** UI copy; generic, no branding. */
  name: string;
  pump: PumpSpec;
  engine: EngineSpec;
  tank?: TankSpec;
  inlets: InletSpec[];
  deliveries: DeliverySpec[];
  primer?: PrimerSpec;
  relief?: ReliefSpec;
  instruments: InstrumentSpec[];
}

// ---------------------------------------------------------------------------
// Hose lays and branches (scenario data, not part of the appliance).
// ---------------------------------------------------------------------------

export interface HoseSegment {
  hose: HoseId;
  lengthM: number;
}

/** Branch (nozzle) at the end of a line, sized by its tip bore. */
export interface Branch {
  tipMm: number;
}

/** One hose lay from a delivery to a branch. */
export interface HoseLine {
  id: string;
  truckId: string;
  deliveryId: ControlId;
  segments: HoseSegment[];
  /** Branch height above the pump, m (negative = downhill). */
  elevationM: number;
  branch: Branch;
}

// ---------------------------------------------------------------------------
// Dynamic state.
// ---------------------------------------------------------------------------

/** What the instruments would show, recomputed every tick. */
export interface TruckReadings {
  /** Discharge (delivery) gauge, kPa. */
  dischargeKpa: number;
  /** Compound (inlet) gauge, kPa; negative is vacuum. */
  compoundKpa: number;
  /** Total flow through the pump, including relief bypass, L/min. */
  pumpFlowLpm: number;
  /** Flow through the pressure relief bypass, L/min. */
  reliefFlowLpm: number;
  /** Flow out of each delivery, keyed by delivery id, L/min. */
  deliveryFlowLpm: Record<ControlId, number>;
  /** Pressure at each branch, keyed by line id, kPa. */
  branchKpa: Record<string, number>;
}

export interface TruckState {
  id: string;
  /** Copy of the appliance spec, so saved states stay self-contained (ARCHITECTURE §9.2). */
  spec: ApplianceSpec;
  rpm: number;
  /** Water in the tank, L. 0 if the appliance has no tank. */
  tankL: number;
  /** Inputs last applied to this truck. */
  inputs: PlayerInputs;
  readings: TruckReadings;
}

export interface SimState {
  /** Sim time in seconds since scenario load. */
  timeS: number;
  /** Truck the player's inputs apply to. */
  activeTruckId: string;
  trucks: TruckState[];
  lines: HoseLine[];
}

/** Everything the player can change, keyed by spec control id (ARCHITECTURE §9.3). */
export interface PlayerInputs {
  /** Throttle position, 0 (idle) to 1 (full). */
  throttle: number;
  /** Valve openings, 0 (closed) to 1 (fully open). */
  valves: Record<ControlId, number>;
  switches: Record<ControlId, boolean>;
}
