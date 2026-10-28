import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, warmStart } from '../sim/engine';
import { RELAY_MIN_RESIDUAL_KPA } from '../sim/constants';
import { getScenario } from '../sim/scenarios';
import { withHeavyLines } from '../sim/scenarios/heavyLines';
import { inputsWith, run, suctionInletOf } from '../sim/testUtils';
import type { ApplianceSpec } from '../sim/types';
import { activeTruck } from './selectors';
import { APPLIANCES } from '../sim/appliances/catalogue';
import { DEFAULT_APPLIANCE_ID, playerAppliance, useStore, WAKE_HISTORY_S } from './store';

describe('store', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('starts with the tank-attack lines laid and every control shut', () => {
    const { sim, inputs } = useStore.getState();
    expect(sim.lines.length).toBeGreaterThan(0);
    expect(inputs.throttle).toBe(0);
    expect(Object.values(inputs.valves).every((v) => v === 0)).toBe(true);
  });

  it('applies panel inputs to the sim on the next tick', () => {
    const { sim, setValve, setThrottle, setSwitch } = useStore.getState();
    const spec = activeTruck(sim).spec;
    // Start it from cold as a player would: ignition on, hold START until it fires.
    setSwitch(spec.engine.controls.ignition, true);
    setSwitch(spec.engine.controls.start, true);
    useStore.getState().step(Math.ceil(spec.engine.crankS / 0.1) + 1);
    expect(activeTruck(useStore.getState().sim).engine.running).toBe(true);
    setSwitch(spec.engine.controls.start, false);
    for (const i of spec.inlets) setValve(i.id, 1);
    const line = sim.lines[0];
    if (line === undefined) throw new Error('no line');
    setValve(line.deliveryId, 1);
    setThrottle(0.6);
    useStore.getState().step(50);
    const truck = activeTruck(useStore.getState().sim);
    expect(truck.inputs.throttle).toBe(0.6);
    expect(truck.readings.dischargeKpa).toBeGreaterThan(0);
    expect(truck.readings.deliveryFlowLpm[line.deliveryId]).toBeGreaterThan(0);
  });

  it('switches the pump panel view and keeps it in the saved settings', () => {
    const { setPanelView } = useStore.getState();
    setPanelView('simplified');
    expect(useStore.getState().saved.settings.panelView).toBe('simplified');
    setPanelView('realistic');
    expect(useStore.getState().saved.settings.panelView).toBe('realistic');
  });

  it('runs the throttle up while a speed switch is held, by sim time, and holds on release', () => {
    const { pressSpeedSwitch, releaseSpeedSwitch } = useStore.getState();
    pressSpeedSwitch(1, { perS: 0.1, flick: 0.02 });
    // The press flicks the throttle at once.
    expect(useStore.getState().inputs.throttle).toBeCloseTo(0.02, 12);
    useStore.getState().step(10); // 1 s
    expect(useStore.getState().inputs.throttle).toBeCloseTo(0.12, 9);
    expect(activeTruck(useStore.getState().sim).inputs.throttle).toBeCloseTo(0.12, 9);
    releaseSpeedSwitch();
    useStore.getState().step(10);
    expect(useStore.getState().inputs.throttle).toBeCloseTo(0.12, 9);
    pressSpeedSwitch(-1, { perS: 0.1, flick: 0.02 });
    useStore.getState().step(50);
    expect(useStore.getState().inputs.throttle).toBe(0);
    releaseSpeedSwitch();
  });

  it('clamps inputs to 0–1', () => {
    const { setThrottle, setValve, sim } = useStore.getState();
    setThrottle(1.7);
    const id = activeTruck(sim).spec.deliveries[0]?.id ?? '';
    setValve(id, -3);
    expect(useStore.getState().inputs.throttle).toBe(1);
    expect(useStore.getState().inputs.valves[id]).toBe(0);
  });

  it('rejects control ids the active appliance does not have', () => {
    expect(() => {
      useStore.getState().setValve('d99', 1);
    }).toThrow(/not a valve/);
    expect(() => {
      useStore.getState().setSwitch('d1', true);
    }).toThrow(/not a switch/);
  });

  it('toggles the scene↔panel highlight on a delivery and remembers which side asked', () => {
    const { sim, toggleHighlight } = useStore.getState();
    const [a, b] = activeTruck(sim).spec.deliveries;
    if (a === undefined || b === undefined) throw new Error('need two deliveries');
    expect(useStore.getState().highlight).toBeNull();
    toggleHighlight(a.id, 'scene');
    expect(useStore.getState().highlight).toEqual({
      truckId: sim.activeTruckId,
      deliveryId: a.id,
      from: 'scene',
    });
    toggleHighlight(b.id, 'panel');
    expect(useStore.getState().highlight).toEqual({
      truckId: sim.activeTruckId,
      deliveryId: b.id,
      from: 'panel',
    });
    toggleHighlight(b.id, 'scene');
    expect(useStore.getState().highlight).toBeNull();
  });

  it('rejects a highlight on something that is not a delivery, and clears it on reset', () => {
    const { sim, toggleHighlight } = useStore.getState();
    const spec = activeTruck(sim).spec;
    const inlet = spec.inlets[0]?.id ?? '';
    expect(() => {
      toggleHighlight(inlet, 'panel');
    }).toThrow();
    toggleHighlight(spec.deliveries[0]?.id ?? '', 'panel');
    useStore.getState().reset();
    expect(useStore.getState().highlight).toBeNull();
  });
});

describe('store: scenarios and the Wake', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('starts on tank attack and loads another scenario on the same appliance', () => {
    expect(useStore.getState().scenarioId).toBe('tank-attack');
    const applianceId = activeTruck(useStore.getState().sim).spec.id;
    useStore.getState().loadScenario('draughting');
    const { sim, scenarioId } = useStore.getState();
    expect(scenarioId).toBe('draughting');
    expect(activeTruck(sim).spec.id).toBe(applianceId);
    expect(sim.sources.some((s) => s.kind === 'static')).toBe(true);
  });

  it('free play loads the sandbox: two trucks of the player’s appliance, attack pump active', () => {
    const applianceId = useStore.getState().playerSpec.id;
    useStore.getState().loadScenario('free-play');
    const { sim, scenarioId, lesson } = useStore.getState();
    expect(scenarioId).toBe('free-play');
    expect(lesson).toBeNull();
    expect(sim.trucks.map((t) => t.spec.id)).toEqual([applianceId, applianceId]);
    expect(sim.activeTruckId).toBe('attack');
    // The player's appliance stays the one picked, whichever truck is being operated.
    useStore.getState().setActiveTruck('base');
    expect(useStore.getState().playerSpec.id).toBe(applianceId);
  });

  it('refuses a scenario the active appliance can’t play, naming both', () => {
    const spec = activeTruck(useStore.getState().sim).spec;
    const noSuction: ApplianceSpec = {
      ...spec,
      id: 'no-suction',
      inlets: spec.inlets.filter((i) => i.kind !== 'suction'),
    };
    useStore.getState().reset(createInitialState(noSuction));
    expect(() => {
      useStore.getState().loadScenario('draughting');
    }).toThrow(/no-suction can’t play 'draughting'/);
  });

  it('a raw state reset has no scenario', () => {
    useStore.getState().reset(useStore.getState().sim);
    expect(useStore.getState().scenarioId).toBeNull();
  });

  it('keeps about 3 s of readings, one per tick, and clears them on reset', () => {
    useStore.getState().step(100);
    const { wake, sim } = useStore.getState();
    expect(wake.length).toBe(Math.round(WAKE_HISTORY_S / 0.1) + 1);
    expect(wake.at(-1)?.tS).toBeCloseTo(sim.timeS, 9);
    expect(wake[0]?.values.discharge).toBeDefined();
    useStore.getState().reset();
    expect(useStore.getState().wake).toEqual([]);
  });
});

describe('store: the player’s appliance', () => {
  beforeEach(() => {
    useStore.getState().setPlayerAppliance(DEFAULT_APPLIANCE_ID);
    useStore.getState().reset();
  });

  it.each(APPLIANCES.map((a) => [a.id] as const))(
    'trains on %s: free play reloads on it, lessons build on it, and it is saved',
    (id) => {
      useStore.getState().openMenu();
      useStore.getState().setPlayerAppliance(id);
      const s = useStore.getState();
      expect(s.screen).toBe('menu');
      expect(s.playerSpec.id).toBe(id);
      expect(activeTruck(s.sim).spec.id).toBe(id);
      expect(s.scenarioId).toBe('tank-attack');
      expect(s.saved.settings.applianceId).toBe(id);
      s.startLesson('first-line');
      expect(activeTruck(useStore.getState().sim).spec.id).toBe(id);
    },
  );

  it('ends a lesson in play when the appliance changes, and refuses one not in the catalogue', () => {
    const other = APPLIANCES.find((a) => a.id !== DEFAULT_APPLIANCE_ID);
    if (other === undefined) throw new Error('needs a second appliance');
    useStore.getState().startLesson('first-line');
    useStore.getState().setPlayerAppliance(other.id);
    expect(useStore.getState().lesson).toBeNull();
    expect(() => {
      useStore.getState().setPlayerAppliance('test-2d');
    }).toThrow(/Unknown appliance/);
  });

  it('falls back to the default appliance for an unknown saved id', () => {
    expect(playerAppliance('no-such-truck').id).toBe(DEFAULT_APPLIANCE_ID);
    expect(playerAppliance(undefined).id).toBe(DEFAULT_APPLIANCE_ID);
  });
});

describe('store: the About screen', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('pauses the sim while open and returns to the screen it was opened from', () => {
    const timeS = useStore.getState().sim.timeS;
    useStore.getState().openAbout();
    expect(useStore.getState().screen).toBe('about');
    useStore.getState().step(10);
    expect(useStore.getState().sim.timeS).toBe(timeS);
    useStore.getState().openAbout();
    useStore.getState().closeAbout();
    expect(useStore.getState().screen).toBe('play');

    useStore.getState().startLesson('first-line');
    useStore.getState().openDebrief();
    useStore.getState().openAbout();
    useStore.getState().closeAbout();
    expect(useStore.getState().screen).toBe('debrief');
  });
});

describe('store: replacing a burst relay length', () => {
  const spec = playerAppliance(DEFAULT_APPLIANCE_ID);
  /** The closed relay on heavy lines, worked, then its inlet slammed shut: a length bursts. */
  const burst = () => {
    const state = warmStart(withHeavyLines(getScenario('closed-relay').build(spec).state));
    const inlet = suctionInletOf(spec);
    const lines = state.lines.filter((l) => l.truckId === 'attack').map((l) => l.deliveryId);
    const working = run(state, inputsWith(0.6, [inlet, ...lines]), 150);
    const slammed = run(working, inputsWith(0.6, lines), 1);
    return { slammed, inlet };
  };

  beforeEach(() => {
    useStore.getState().reset();
  });

  it('repairs the relay in free play: the burst clears and water comes back up it', () => {
    const { slammed, inlet } = burst();
    expect(slammed.links[0]?.burst).toBeDefined();
    useStore.getState().reset(slammed);
    useStore.getState().replaceBurstLength('relay');
    expect(useStore.getState().sim.links[0]?.burst).toBeUndefined();
    // Reopen the inlet at a throttle the relay can feed (0.6 on heavy lines over-runs it).
    useStore.getState().setValve(inlet, 1);
    useStore.getState().setThrottle(0.2);
    useStore.getState().step(200);
    const { sim } = useStore.getState();
    expect(sim.links[0]?.burst).toBeUndefined();
    expect(sim.linkReadings.relay?.flowLpm).toBeGreaterThan(0);
    expect(activeTruck(sim).readings.compoundKpa).toBeGreaterThanOrEqual(RELAY_MIN_RESIDUAL_KPA);
    // The burst still counts against the base pump.
    expect(sim.trucks.find((t) => t.id === 'base')?.tally.hoseBursts).toBe(1);
  });

  it('throws on a relay that isn’t there', () => {
    useStore.getState().reset(burst().slammed);
    expect(() => {
      useStore.getState().replaceBurstLength('nope');
    }).toThrow(/no relay 'nope'/);
  });

  it('leaves the repair to a lesson’s own event', () => {
    useStore.getState().startLesson('closed-relay');
    expect(() => {
      useStore.getState().replaceBurstLength('relay');
    }).toThrow(/lesson/);
  });
});
