// Run with any TS-aware runner (vitest, `node --test` after tsc, tsx --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueToAngle, ticks, arc, zoneAt, zoneArcs } from './gaugeScale';
import { pressureDial, compoundDial, tachDial } from './dials';
import { WakeBuffer } from './wake';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('pressure dial maps linearly over 270°', () => {
  close(valueToAngle(pressureDial, 0), -135);
  close(valueToAngle(pressureDial, 800), 0);
  close(valueToAngle(pressureDial, 1050), 42.1875);
  close(valueToAngle(pressureDial, 1600), 135);
});

test('values outside the scale clamp to the stops', () => {
  close(valueToAngle(pressureDial, -50), -135);
  close(valueToAngle(pressureDial, 2400), 135);
});

test('compound dial is two segments joined at 0 kPa = -75°', () => {
  close(valueToAngle(compoundDial, -100), -135);
  close(valueToAngle(compoundDial, -40), -99);
  close(valueToAngle(compoundDial, 0), -75);
  close(valueToAngle(compoundDial, 1600), 135);
  close(valueToAngle(compoundDial, -78), -121.8);
});

test('tick counts match sheet 02', () => {
  const p = ticks(pressureDial);
  assert.equal(p.length, 33);
  assert.equal(p.filter((t) => t.major).length, 9);
  assert.deepEqual(p.filter((t) => t.label).map((t) => t.label), ['0', '2', '4', '6', '8', '10', '12', '14', '16']);

  const c = ticks(compoundDial);
  assert.equal(c.length, 11 + 17 - 1); // shared tick at 0
  assert.deepEqual(c.filter((t) => t.label).map((t) => t.label), ['−100', '−50', '0', '4', '8', '12', '16']);

  assert.equal(ticks(tachDial).length, 17);
});

test('arcs are dash-arrayed circles rotated to their start angle', () => {
  const a = arc(84, 67.5, 101.25, 7);
  assert.equal(a.strokeDasharray, '49.48 527.79');
  assert.equal(a.transform, 'rotate(-22.5)');
  const z = zoneArcs(compoundDial);
  assert.equal(z[0].transform, 'rotate(-216)'); // caution starts at -85 kPa = -126°
});

test('zoneAt prefers alarm over caution', () => {
  assert.equal(zoneAt(pressureDial, 1000), null);
  assert.equal(zoneAt(pressureDial, 1300), 'caution');
  assert.equal(zoneAt(pressureDial, 1400), 'alarm');
  assert.equal(zoneAt(compoundDial, -78), 'caution');
});

test('wake band covers the last 3 s only', () => {
  const w = new WakeBuffer();
  for (let i = 0; i <= 100; i++) w.push(i * 0.05, i < 20 ? 500 : 1000); // 500 until t=1.0, then 1000
  assert.deepEqual(w.band(), { lo: 1000, hi: 1000 }); // t now 5.0; window 2.0..5.0
});

test('wake ghosts are spaced 0.6 s apart and fade', () => {
  const w = new WakeBuffer();
  for (let i = 0; i <= 80; i++) w.push(i * 0.05, i * 10); // ramp: v = 200·t
  const g = w.ghosts();
  assert.equal(g.length, 5);
  close(g[0].value, 200 * (4 - 0.6), 1e-6);
  close(g[4].value, 200 * (4 - 3.0), 1e-6);
  close(g[0].opacity, 0.26);
  close(g[4].opacity, 0.07);
});

test('hunting detection needs reversals and span', () => {
  const steady = new WakeBuffer();
  const hunting = new WakeBuffer();
  for (let i = 0; i <= 60; i++) {
    const t = i * 0.05;
    steady.push(t, -28 + Math.sin(t * 15) * 1);
    hunting.push(t, -70 + Math.sin(t * 15) * 15);
  }
  assert.equal(steady.isHunting(15, 2), false);
  assert.equal(hunting.isHunting(15, 2), true);
});
