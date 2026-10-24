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
  /**
   * Inlet gauge pressure below which the pump cavitates, kPa (negative: vacuum). The inlet can't
   * be pulled lower, so it caps the flow the pump can draw from a draught or a weak supply.
   */
  cavitationInletKpa: number;
  /** Water held in the pump casing, L: the air the primer must clear and the churn heat's mass. */
  casingVolumeL: number;
  /** Heat churned into the casing water at max rpm, kW; scales with (rpm/max)³ (affinity law). */
  churnKw: number;
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

/**
 * What an inlet is on the truck. 'tank' is the internal tank-to-pump feed. 'suction' is an external
 * inlet: hard suction to a static source (draughting) or a collecting head and layflat from a
 * hydrant. What is connected to it is scenario data (`SupplyLine`), not part of the appliance.
 */
export type InletKind = 'tank' | 'suction';

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

/** What any primer can pull: the vacuum it approaches and how fast it moves air. */
export interface PrimerPerformance {
  /** Best vacuum the primer reaches on a sealed pump, kPa (positive number). */
  maxVacuumKpa: number;
  /** Air it removes, L/s: with the air volume this sets how fast the vacuum builds. */
  displacementLps: number;
}

/**
 * How the pump is primed for draughting. 'rotaryVane' runs while its switch is held, within a duty
 * cycle; 'diaphragm' works while the operator strokes its handle (the switch input); 'selfPriming'
 * has no control and primes whenever the suction path is open. No primer: the pump can't draught.
 */
export type PrimerSpec =
  | ({
      kind: 'rotaryVane';
      /** Control id of the primer switch. */
      id: ControlId;
      /** Max continuous run, s. */
      maxOnS: number;
      /** Duty period the max run applies within, s. */
      periodS: number;
    } & PrimerPerformance)
  | ({
      kind: 'diaphragm';
      /** Control id of the primer handle. */ id: ControlId;
    } & PrimerPerformance)
  | ({ kind: 'selfPriming' } & PrimerPerformance);

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

/**
 * A water source on the fireground (scenario data; a dam's volume changes as it's drawn).
 * 'hydrant': pressurised main, residual = static − main loss·Q² (manual L1055–1065, C14).
 * 'static': open water (dam, tank, creek) whose surface is `liftM` below the pump inlet.
 */
export type WaterSource =
  | {
      id: string;
      kind: 'hydrant';
      label: string;
      /** Pressure at the hydrant with nothing drawn, kPa. */
      staticKpa: number;
      /** Main and hydrant loss, kPa per (L/min)². */
      mainLossKpaPerLpm2: number;
    }
  | {
      id: string;
      kind: 'static';
      label: string;
      /** Height of the pump inlet above the water surface, m. */
      liftM: number;
      /** Water left, L. */
      volumeL: number;
    };

/** Hose from a source to one of a truck's suction inlets: hard suction or layflat. */
export interface SupplyLine {
  id: string;
  truckId: string;
  /** Spec inlet id (a 'suction' inlet). */
  inletId: ControlId;
  sourceId: string;
  segments: HoseSegment[];
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
  /** Flow in through each inlet, keyed by inlet id, L/min. */
  inletFlowLpm: Record<ControlId, number>;
  /** How hard the pump is cavitating, 0 (not) to 1 (fully); clean readings carry no flutter. */
  cavitation: number;
}

/** Slow pump states, integrated every tick. */
export interface PumpState {
  /** Whether the suction side is full of water from a draught source. */
  primed: boolean;
  /** Vacuum the primer has pulled on the casing, kPa (positive number). */
  vacuumKpa: number;
  /** How long the primer has run without a break, s. */
  primerRunS: number;
  /** Rotary vane duty used, s: rises while running, falls at the rest rate. */
  primerDutyS: number;
  /** Primer tripped its duty cut-out; it won't run until the duty has recovered. */
  primerCutOut: boolean;
  /** Casing water temperature, °C. */
  tempC: number;
  /** Gauge flutter noise, −1…1: a smoothed seeded random walk, scaled by cavitation for display. */
  flutter: number;
}

/** A water hammer event on a delivery. */
export interface HammerEvent {
  /** Sim time it happened, s. */
  atS: number;
  deliveryId: ControlId;
  /** Estimated pressure surge, kPa. */
  surgeKpa: number;
}

/** Fault counters for the debrief (M6 scores them). */
export interface FaultTally {
  cavitationS: number;
  overheatS: number;
  waterHammer: number;
  worstSurgeKpa: number;
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
  pump: PumpState;
  tally: FaultTally;
  /** Most recent water hammer, if any. */
  lastHammer?: HammerEvent;
}

export interface SimState {
  /** Sim time in seconds since scenario load. */
  timeS: number;
  /** Truck the player's inputs apply to. */
  activeTruckId: string;
  trucks: TruckState[];
  lines: HoseLine[];
  sources: WaterSource[];
  supplies: SupplyLine[];
  /** Seeded PRNG state (mulberry32), so noisy behaviour replays exactly. */
  rngState: number;
}

/** Everything the player can change, keyed by spec control id (ARCHITECTURE §9.3). */
export interface PlayerInputs {
  /** Throttle position, 0 (idle) to 1 (full). */
  throttle: number;
  /** Valve openings, 0 (closed) to 1 (fully open). */
  valves: Record<ControlId, number>;
  switches: Record<ControlId, boolean>;
}
