// Derived relay state for the UI: the trucks on the fireground, relay hoses, portable dams.
import type { RelayLink, RelayReading, SimState, WaterSource } from '../sim/types';
import { CHARGED_MIN_LPM } from './selectors';
import { tankLevelState, type TankLevelState } from './tankLevel';

export interface SceneTruck {
  id: string;
  label: string;
  /** Appliance name, e.g. 'Category 1 tanker'. */
  specName: string;
  applianceId: string;
  /** The truck the player is operating. */
  active: boolean;
}

/** Every truck on the fireground, in state order, marking the one the player operates. */
export function trucksOnScene(sim: SimState): SceneTruck[] {
  return sim.trucks.map((t) => ({
    id: t.id,
    label: t.label,
    specName: t.spec.name,
    applianceId: t.spec.id,
    active: t.id === sim.activeTruckId,
  }));
}

/**
 * How the scene draws a relay hose. 'charged': water moving. 'soft': a closed relay over-run, its
 * layflat pulled flat. 'burst': a length has gone. 'dry': nothing flowing.
 */
export type RelayState = 'charged' | 'dry' | 'soft' | 'burst';

export interface RelayLay {
  link: RelayLink;
  /** Closed: into another pump's inlet. Open: into a tank or a dam. */
  kind: 'closed' | 'open';
  state: RelayState;
  reading: RelayReading;
  /** Supplying truck's label. */
  fromLabel: string;
  /** What it runs to: a truck's label, or a dam's. */
  toLabel: string;
}

const NO_READING: RelayReading = { flowLpm: 0, startKpa: 0, endKpa: 0, collapsed: false };

/** What a relay runs to, by name: the receiving truck's label, or the dam's. */
export function relayTarget(sim: SimState, link: RelayLink): string {
  switch (link.to.kind) {
    case 'inlet':
    case 'tank': {
      const id = link.to.truckId;
      return sim.trucks.find((t) => t.id === id)?.label ?? id;
    }
    case 'dam': {
      const id = link.to.sourceId;
      return sim.sources.find((s) => s.id === id)?.label ?? id;
    }
  }
}

/** Every relay hose on the fireground with its state and the names at each end. */
export function relayLays(sim: SimState): RelayLay[] {
  return sim.links.map((link) => {
    const reading = sim.linkReadings[link.id] ?? NO_READING;
    const state: RelayState =
      link.burst !== undefined
        ? 'burst'
        : reading.collapsed
          ? 'soft'
          : reading.flowLpm >= CHARGED_MIN_LPM
            ? 'charged'
            : 'dry';
    return {
      link,
      kind: link.to.kind === 'inlet' ? 'closed' : 'open',
      state,
      reading,
      fromLabel: sim.trucks.find((t) => t.id === link.truckId)?.label ?? link.truckId,
      toLabel: relayTarget(sim, link),
    };
  });
}

export interface PortableDam {
  source: Extract<WaterSource, { kind: 'static' }>;
  /** Water left as a fraction of what it holds, 0–1. */
  fraction: number;
  level: TankLevelState;
}

/** Static sources that hold a fixed amount (portable dams), with how full they are. */
export function portableDams(sim: SimState): PortableDam[] {
  return sim.sources.flatMap((source): PortableDam[] => {
    if (source.kind !== 'static' || source.capacityL === undefined) return [];
    const capacityL = source.capacityL;
    return [
      {
        source,
        fraction: capacityL > 0 ? Math.min(1, Math.max(0, source.volumeL / capacityL)) : 0,
        level: tankLevelState(source.volumeL, capacityL),
      },
    ];
  });
}
