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
  /** Cylinders of the four-stroke engine driving the pump: sets the engine note (sound only). */
  cylinders: number;
  /**
   * The truck's throttle is a momentary speed controller (hold to run the governor up or down)
   * rather than a lever that stays put. Absent: a plain throttle.
   */
  speedController?: SpeedControllerSpec;
  /**
   * The throttle is a vernier cable: twist the knob for fine travel, hold its release button to
   * push or pull it freely. Absent: not a vernier. The throttle input is the same 0–1 position.
   */
  vernier?: VernierSpec;
  /** Panel controls that start and stop the engine. */
  controls: EngineControlsSpec;
  /** Cranking the starter needs before the engine fires, s. */
  crankS: number;
  /** Speed the starter turns the engine at, rpm. */
  crankRpm: number;
  /**
   * With the fuel cut, the engine is stopped once it runs down below this, rpm; let go of STOP
   * above it and the fuel rack returns and the engine picks up again.
   */
  refireRpm: number;
  /** Spin-down time constant with the fuel cut, s. */
  runDownS: number;
}

/**
 * Engine switches, each a held on/off input. START cranks while held (with the ignition on); STOP
 * cuts the fuel while held. An energise-to-stop solenoid (`needsIgnition`) is powered through the
 * ignition, so STOP does nothing with it off; a mechanical stop works either way.
 */
export interface EngineControlsSpec {
  ignition: ControlId;
  start: ControlId;
  stop: { id: ControlId; needsIgnition: boolean };
}

/** How far one full twist of a vernier throttle's knob moves the throttle, as a fraction of travel. */
export interface VernierSpec {
  throttlePerTurn: number;
}

/** How fast a held speed controller moves the engine, and how far one flick nudges it. */
export interface SpeedControllerSpec {
  rampRpmPerS: number;
  flickRpm: number;
}

export interface TankSpec {
  capacityL: number;
}

/**
 * What an inlet is on the truck. 'tank' is the internal tank-to-pump feed. 'suction' is an external
 * inlet: hard suction to a static source (draughting) or a collecting head and layflat from a
 * hydrant. 'tankFill' is an external inlet straight into the tank (hydrant to tank), bypassing the
 * pump. What is connected to an external inlet is scenario data (`SupplyLine`), not the appliance.
 */
export type InletKind = 'tank' | 'suction' | 'tankFill';

export interface InletSpec {
  /** Control id of this inlet's valve, e.g. 'tank-to-pump'. */
  id: ControlId;
  label: string;
  kind: InletKind;
  /** Loss through the inlet path with the valve fully open, kPa per (L/min)². */
  lossKpaPerLpm2: number;
  sizeMm?: number;
  /** 'tankFill' only: how high the water climbs from the inlet into the tank, m (default 0). */
  fillHeightM?: number;
}

/**
 * Pump to tank: a valved return from the discharge side into the tank. Refills the tank from a
 * hydrant or a draught through the pump, and is the operator's way to keep water moving through
 * a pump that would otherwise churn. Flows to atmosphere, Q = open·√(P_d / k).
 */
export interface PumpToTankSpec {
  /** Control id of its valve, e.g. 'pump-to-tank'. */
  id: ControlId;
  label: string;
  sizeMm: number;
  /** Loss through the return with the valve fully open, kPa per (L/min)². */
  lossKpaPerLpm2: number;
}

/**
 * Tank recirculation: a fixed bleed from the discharge into the tank through a check valve (the
 * Cat 7's 3-way valve set to TANK RECIRC). Not a control: it flows Q = √(P_d / k) whenever the pump
 * has water, so a pump with no relief keeps cool churning with every delivery shut. The check valve
 * keeps air out, so unlike pump to tank it doesn't stop the primer catching.
 */
export interface RecircSpec {
  sizeMm: number;
  /** Loss through the bleed and its check valve, kPa per (L/min)². */
  lossKpaPerLpm2: number;
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

/** One lit band of an electronic tank gauge: lit from `fromFraction` of full up to the next band. */
export interface TankBand {
  fromFraction: number;
  tone: 'green' | 'blue' | 'red';
}

/**
 * How a tank's level is shown on the truck. Display data only: the sim never reads it.
 * 'sightTube': a clear tube on the tank with a float at the water line. 'bands': an electronic
 * gauge that lights one coloured band for the range the level is in.
 */
export type TankDisplay = { kind: 'sightTube' } | { kind: 'bands'; bands: TankBand[] };

export type InstrumentSpec =
  | { id: string; kind: Exclude<InstrumentKind, 'tank'>; scale: GaugeScaleSpec }
  | { id: string; kind: 'tank'; display: TankDisplay };

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
  /** Return from the discharge into the tank; needs a tank. */
  pumpToTank?: PumpToTankSpec;
  /** Fixed recirculation bleed from the discharge into the tank; needs a tank. */
  recirc?: RecircSpec;
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
      /**
       * Most it holds, L: a portable dam or a tank on the ground overflows past it. Open water
       * (a farm dam, a creek) has no limit.
       */
      capacityL?: number;
      /** Water overflowed past `capacityL` onto the ground and not yet soaked away, L. */
      spilledL?: number;
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

/**
 * Where a relay hose ends. 'inlet': another truck's suction inlet (closed relay: the pumps are
 * coupled). 'tank': another truck's tank, and 'dam': a static source such as a portable dam (open
 * relay: the water lands at atmospheric pressure and the next pump draws on it independently).
 */
export type RelayEnd =
  | { kind: 'inlet'; truckId: string; inletId: ControlId }
  | { kind: 'tank'; truckId: string }
  | { kind: 'dam'; sourceId: string };

/** A burst length in a relay hose. */
export interface HoseBurst {
  /** Sim time it burst, s. */
  atS: number;
  /** Index of the length that burst in `segments`. */
  segment: number;
  /** Peak pressure in the hose when it went, kPa. */
  peakKpa: number;
}

/** A relay hose from one truck's delivery to another truck or a dam (ARCHITECTURE §4.7). */
export interface RelayLink {
  id: string;
  /** Supplying truck and the delivery the relay hose leaves from. */
  truckId: string;
  deliveryId: ControlId;
  segments: HoseSegment[];
  /** Height of the far end above the supplying pump, m (negative = downhill). */
  elevationM: number;
  to: RelayEnd;
  /** Set once over-pressure has burst a length; the relay no longer reaches its far end. */
  burst?: HoseBurst;
}

/** What a relay hose is doing, recomputed every tick. */
export interface RelayReading {
  /** Flow leaving the supplying delivery, L/min. */
  flowLpm: number;
  /** Pressure at the supplying end, after its delivery valve, kPa. */
  startKpa: number;
  /** Pressure at the far end, kPa: the receiving inlet's residual for a closed relay; 0 when open. */
  endKpa: number;
  /** A closed relay's layflat is pulled flat by the receiving pump (over-running the relay). */
  collapsed: boolean;
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
  /** Total flow through the pump, including relief, pump to tank and recirculation, L/min. */
  pumpFlowLpm: number;
  /** Flow through the pressure relief bypass, L/min. */
  reliefFlowLpm: number;
  /** Flow back to the tank through pump to tank, L/min; 0 if none is fitted. */
  pumpToTankLpm: number;
  /** Flow back to the tank through the recirculation bleed, L/min; 0 if none is fitted. */
  recircLpm: number;
  /** Water out the tank's overflow, L/min: what a full tank can't hold. 0 with room in the tank. */
  overflowLpm: number;
  /** Flow out of each delivery, keyed by delivery id, L/min. */
  deliveryFlowLpm: Record<ControlId, number>;
  /** Pressure at each branch, keyed by line id, kPa. */
  branchKpa: Record<string, number>;
  /**
   * Water leaving each branch, keyed by line id, L/min: water on the fire. 0 while the line fills;
   * a shut downhill line's drain flow. Delivery flow is what leaves the pump.
   */
  branchFlowLpm: Record<string, number>;
  /** Flow in through each inlet, keyed by inlet id, L/min. */
  inletFlowLpm: Record<ControlId, number>;
  /** Whether each inlet's layflat supply is pulled flat (soft hose, "inlet zero"), keyed by inlet id. */
  inletCollapsed: Record<ControlId, boolean>;
  /** How hard the pump is cavitating, 0 (not) to 1 (fully); clean readings carry no flutter. */
  cavitation: number;
}

/** Slow pump states, integrated every tick. */
export interface PumpState {
  /** Whether the suction side is full of water from a draught source. */
  primed: boolean;
  /**
   * Whether the casing and discharge manifold hold water. Fills whenever water reaches the pump and
   * stays after the feed is shut, as a real pump stays full. Display only: no hydraulics read it.
   */
  casingWet: boolean;
  /** Vacuum the primer has pulled on the casing, kPa (positive number). */
  vacuumKpa: number;
  /**
   * Vacuum above the water in the hard suction, kPa: it holds the column `vacuum/10` m up. The
   * same as the casing's while the suction valve is open; shut, the hose keeps its own (the column
   * is trapped), and the two mix when it opens again.
   */
  suctionVacuumKpa: number;
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
  /** Relay hose lengths burst by over-pressure on this truck's deliveries. */
  hoseBursts: number;
}

/** Whether the engine is firing, and how long the starter has cranked it unbroken. */
export interface EngineState {
  running: boolean;
  crankS: number;
}

export interface TruckState {
  id: string;
  /** UI copy naming the truck on the fireground, e.g. 'Base pump'. */
  label: string;
  /** Copy of the appliance spec, so saved states stay self-contained (ARCHITECTURE §9.2). */
  spec: ApplianceSpec;
  rpm: number;
  engine: EngineState;
  /** Water in the tank, L. 0 if the appliance has no tank. */
  tankL: number;
  /** Water overflowed from the tank onto the ground around the truck and not yet soaked away, L. */
  spilledL: number;
  /** Inputs last applied to this truck. */
  inputs: PlayerInputs;
  readings: TruckReadings;
  pump: PumpState;
  tally: FaultTally;
  /** Most recent water hammer, if any. */
  lastHammer?: HammerEvent;
  /** This truck's seeded PRNG state (mulberry32), so its noise replays and other trucks don't shift it. */
  rngState: number;
}

export interface SimState {
  /** Sim time in seconds since scenario load. */
  timeS: number;
  /** Truck the player's inputs apply to. */
  activeTruckId: string;
  trucks: TruckState[];
  lines: HoseLine[];
  /** Water in each lay, keyed by line id, L (0 to the hose's volume; missing is dry). */
  lineWaterL: Record<string, number>;
  sources: WaterSource[];
  supplies: SupplyLine[];
  /** Relay hoses between trucks, and into tanks and dams. */
  links: RelayLink[];
  /** What each relay hose is doing, keyed by link id. */
  linkReadings: Record<string, RelayReading>;
}

/** Everything the player can change, keyed by spec control id (ARCHITECTURE §9.3). */
export interface PlayerInputs {
  /** Throttle position, 0 (idle) to 1 (full). */
  throttle: number;
  /** Valve openings, 0 (closed) to 1 (fully open). */
  valves: Record<ControlId, number>;
  switches: Record<ControlId, boolean>;
}
