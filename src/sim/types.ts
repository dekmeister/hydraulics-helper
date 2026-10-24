// Plain, serialisable sim data. Grows in M1 (ARCHITECTURE §4.8, §9.2).

/** Id of a control or instrument as defined by an appliance spec, e.g. 'd1', 'tank-to-pump'. */
export type ControlId = string;

export interface SimState {
  /** Sim time in seconds since scenario load. */
  timeS: number;
}

/** Everything the player can change, keyed by spec control id (ARCHITECTURE §9.3). */
export interface PlayerInputs {
  /** Throttle position, 0 (idle) to 1 (full). */
  throttle: number;
  /** Valve openings, 0 (closed) to 1 (fully open). */
  valves: Record<ControlId, number>;
  switches: Record<ControlId, boolean>;
}
