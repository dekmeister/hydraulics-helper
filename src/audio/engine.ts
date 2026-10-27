// The pump's sounds, synthesised with Web Audio (no samples, no dependency). Driven by
// `SoundParams`; every change glides so the sound never clicks.
import type { SoundParams } from './params';

export interface SoundEngine {
  update(p: SoundParams): void;
  setRunning(on: boolean): void;
  close(): void;
}

/** Seconds a change takes to settle: quick enough to follow the throttle, slow enough not to click. */
const GLIDE_S = 0.08;
const MASTER_GAIN = 0.25;

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createSoundEngine(ctx: AudioContext): SoundEngine {
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(ctx.destination);
  const voice = (input: AudioNode, filter: BiquadFilterType, hz: number) => {
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = 0;
    input.connect(f).connect(g).connect(master);
    return g;
  };
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    src.start();
    return src;
  };

  // Engine: a sawtooth at the firing frequency with a sub-octave, muffled.
  const engine = ctx.createOscillator();
  engine.type = 'sawtooth';
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  const engineMix = ctx.createGain();
  engine.connect(engineMix);
  sub.connect(engineMix);
  const engineGain = voice(engineMix, 'lowpass', 500);
  // Primer: a buzzing vane pump.
  const primer = ctx.createOscillator();
  primer.type = 'square';
  primer.frequency.value = 140;
  const primerGain = voice(primer, 'bandpass', 900);
  // Cavitation: bright noise chopped by a fast irregular gate, like gravel in the casing.
  const chop = ctx.createOscillator();
  chop.type = 'square';
  chop.frequency.value = 17;
  const chopDepth = ctx.createGain();
  chopDepth.gain.value = 0.5;
  const gate = ctx.createGain();
  gate.gain.value = 0.5;
  chop.connect(chopDepth).connect(gate.gain);
  noise().connect(gate);
  const rattleGain = voice(gate, 'highpass', 1800);
  // Spray: soft broadband hiss.
  const sprayGain = voice(noise(), 'lowpass', 1500);
  // Overflow: a heavy low gush that surges unevenly (two slow, unrelated swells), with bright
  // splashing on top as it hits the ground and runs round the truck.
  const surge = ctx.createGain();
  surge.gain.value = 0.6;
  const swells = [0.9, 2.3].map((hz) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const depth = ctx.createGain();
    depth.gain.value = 0.2;
    o.connect(depth).connect(surge.gain);
    return o;
  });
  noise().connect(surge);
  const gush = ctx.createGain();
  gush.gain.value = 0;
  gush.connect(master);
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 450;
  const splash = ctx.createBiquadFilter();
  splash.type = 'bandpass';
  splash.frequency.value = 2600;
  splash.Q.value = 0.7;
  const splashLevel = ctx.createGain();
  splashLevel.gain.value = 0.35;
  surge.connect(body).connect(gush);
  surge.connect(splash).connect(splashLevel).connect(gush);
  for (const o of [engine, sub, primer, chop, ...swells]) o.start();

  const glide = (param: AudioParam, value: number) => {
    param.setTargetAtTime(value, ctx.currentTime, GLIDE_S);
  };
  return {
    update(p) {
      glide(engine.frequency, p.engineHz);
      glide(sub.frequency, p.engineHz / 2);
      glide(engineGain.gain, p.engineGain);
      glide(primerGain.gain, p.primerGain);
      glide(rattleGain.gain, p.rattleGain);
      glide(sprayGain.gain, p.sprayGain);
      glide(gush.gain, p.overflowGain);
    },
    setRunning(on) {
      void (on ? ctx.resume() : ctx.suspend());
    },
    close() {
      void ctx.close();
    },
  };
}
