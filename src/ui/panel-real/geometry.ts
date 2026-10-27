// Pure geometry for the realistic view: where each item's hit box sits on its plate, and how wide
// each plate is drawn. Shared by the renderer and the layout tests (44 px targets at 375 px).
import type { LeverGeometry, RBox, RealItem, RealPlate } from '../appliances/realistic';

/** Label plate lettering and height, plate units. */
export const PLATE_FONT_U = 24;
export const PLATE_H_U = 36;
/** Padding either side of a plate's lettering, plate units. */
const PLATE_PAD_U = 14;
/**
 * Mean advance of an upper-case Barlow Condensed bold glyph, ems, with the plates' 0.06 em
 * letter spacing. SVG text can't be measured in pure data; this sizes plates to within a glyph.
 */
const GLYPH_EM = 0.56;

/** Estimated width of a line of plate lettering, plate units. */
export function textWidthU(text: string, fontU: number): number {
  return text.length * GLYPH_EM * fontU;
}

/** Width of a label plate that fits its text. */
export function plateWidthU(text: string): number {
  return Math.round(textWidthU(text, PLATE_FONT_U) + 2 * PLATE_PAD_U);
}

/** Outer radius of a 65 mm delivery coupling, as a fraction of its box's width. */
const COUPLING_65_FRAC = 0.32;
/** Largest coupling radius, as a fraction of box width: inside the 0.38 locate ring. */
const COUPLING_MAX_FRAC = 0.34;

/**
 * Outer radius of a delivery coupling of `sizeMm`, as a fraction of its box's width (issue #15).
 * Grows as √size so a 25 mm fitting is still a thumb-sized target beside a 65 mm one.
 */
export function couplingRadiusFrac(sizeMm: number): number {
  return Math.min(COUPLING_MAX_FRAC, COUPLING_65_FRAC * Math.sqrt(Math.max(0, sizeMm) / 65));
}

/**
 * How BayLever draws a lever, plate units: a pivot boss, a shank, and a rounded grip on its outer
 * `gripLengthFrac` of the length, with a drop shadow lifted further off the plate while dragged.
 * The shank is thinner and darker than any pipe and the grip wider, so a lever never reads as pipe.
 */
export const LEVER_ART = {
  pivotR: 17,
  hubR: 6,
  shankHalfW: 5,
  shankStrokeW: 1.5,
  gripHalfW: 15,
  gripStrokeW: 2.5,
  gripLengthFrac: 0.48,
  shadowHalfW: 7,
  restLift: { x: 3, y: 4 },
  dragLift: { x: 8, y: 12 },
} as const;

/** Margin round a lever's sweep inside its hit box, plate units. */
const LEVER_PAD_U = 10;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A point `lengthU` from the pivot at `deg` clockwise from 12 o'clock. */
export function leverTip(g: LeverGeometry, deg: number): { x: number; y: number } {
  return {
    x: g.pivot.x + g.lengthU * Math.sin(rad(deg)),
    y: g.pivot.y - g.lengthU * Math.cos(rad(deg)),
  };
}

/** A disc: centre and radius, plate units (a point when `r` is 0). */
interface Disc {
  x: number;
  y: number;
  r: number;
}

/**
 * The angles a lever's bounds are taken at. Its arc bulges past its ends only where it crosses a
 * 90° axis, which a quarter between two axis-aligned ends never does; for others, the middle too.
 */
const sweepAngles = (g: LeverGeometry) => [g.shutDeg, g.openDeg, (g.shutDeg + g.openDeg) / 2];

/** Bounding box of a set of discs, padded by `padU`. */
function discsBox(discs: readonly Disc[], padU: number): RBox {
  const x0 = Math.min(...discs.map((d) => d.x - d.r)) - padU;
  const y0 = Math.min(...discs.map((d) => d.y - d.r)) - padU;
  return {
    x: x0,
    y: y0,
    w: Math.max(...discs.map((d) => d.x + d.r)) + padU - x0,
    h: Math.max(...discs.map((d) => d.y + d.r)) + padU - y0,
  };
}

/** Hit box of a lever: its pivot and the quarter it sweeps from shut to open, padded. */
export function leverBox(g: LeverGeometry): RBox {
  const tips = sweepAngles(g).map((deg) => ({ ...leverTip(g, deg), r: 0 }));
  return discsBox([{ ...g.pivot, r: 0 }, ...tips], LEVER_PAD_U);
}

/**
 * Everything a lever draws, shut, open and anywhere between: its pivot boss, its grip (round end
 * and both sides where it starts) and its dragged shadow. It reaches past the hit box, so the
 * lever's SVG draws unclipped; this keeps that drawing on its plate.
 */
export function leverArtBox(g: LeverGeometry): RBox {
  const a = LEVER_ART;
  const L = g.lengthU;
  const gripR = a.gripHalfW + a.gripStrokeW / 2;
  const gripBase = L * (1 - a.gripLengthFrac);
  // (dx, dy) from the pivot in the lever's own frame (pointing up), turned `deg` clockwise.
  const at = (dx: number, dy: number, r: number, deg: number): Disc => ({
    x: g.pivot.x + dx * Math.cos(rad(deg)) - dy * Math.sin(rad(deg)),
    y: g.pivot.y + dx * Math.sin(rad(deg)) + dy * Math.cos(rad(deg)),
    r,
  });
  const discs = sweepAngles(g).flatMap((deg) => [
    at(0, -(L - a.gripHalfW), gripR, deg),
    at(gripR, -gripBase, 0, deg),
    at(-gripR, -gripBase, 0, deg),
    at(a.dragLift.x, -(L - a.dragLift.y - a.shadowHalfW), a.shadowHalfW, deg),
  ]);
  return discsBox([{ ...g.pivot, r: a.pivotR }, ...discs], 0);
}

/** Every interactive hit box an item puts on its plate, with what it is. */
export function interactiveBoxes(item: RealItem): { name: string; box: RBox }[] {
  switch (item.kind) {
    case 'lever':
      return [{ name: item.control, box: leverBox(item) }];
    case 'outlet':
      return [
        { name: item.control, box: leverBox(item) },
        { name: `${item.control} locate`, box: item.coupling },
      ];
    case 'primer':
      return [{ name: item.control, box: item.box }];
    case 'throttle':
      return [{ name: 'throttle', box: item.box }];
    case 'engine-switch':
      return [{ name: item.control, box: item.box }];
    case 'gauge':
    case 'tank-gauge':
    case 'engine-lamp':
    case 'inert':
      return [];
  }
}

/** An item's drawing box on its plate (levers: all they draw, past their hit box). */
export function itemBox(item: RealItem): RBox {
  switch (item.kind) {
    case 'lever':
    case 'outlet':
      return leverArtBox(item);
    default:
      return item.box;
  }
}

/** Gap between the plates in a row, CSS px: `--space-3`, as `.real-panel__row` / `__insets` set. */
export const PLATE_ROW_GAP_PX = 12;

/**
 * The main plates as rows, top to bottom: each stacked plate with the plates beside it. A beside
 * plate with no stacked plate before it starts a row of its own.
 */
export function plateRows(plates: readonly RealPlate[]): RealPlate[][] {
  const rows: RealPlate[][] = [];
  for (const p of plates) {
    const last = rows.at(-1);
    if (p.place === 'beside' && last !== undefined) last.push(p);
    else if (p.place !== 'inset') rows.push([p]);
  }
  return rows;
}

/** Share a row's width bar its gaps among its plates by `weight`. */
function shareRow(
  row: readonly RealPlate[],
  panelPx: number,
  weight: (p: RealPlate) => number,
  into: Map<string, number>,
) {
  const total = row.reduce((w, p) => w + weight(p), 0);
  const px = panelPx - PLATE_ROW_GAP_PX * (row.length - 1);
  for (const p of row) into.set(p.id, (px * weight(p)) / total);
}

/**
 * Each plate's drawn width, CSS px, in a panel `panelPx` wide. A row of main plates shares the
 * width by aspect (w / h), so all are one height; the insets share theirs by viewBox width.
 */
export function plateWidthsPx(plates: readonly RealPlate[], panelPx: number): Map<string, number> {
  const widths = new Map<string, number>();
  for (const row of plateRows(plates))
    shareRow(row, panelPx, (p) => p.viewBox.w / p.viewBox.h, widths);
  shareRow(
    plates.filter((p) => p.place === 'inset'),
    panelPx,
    (p) => p.viewBox.w,
    widths,
  );
  return widths;
}

/** CSS position of a plate-unit box as percentages of the plate. */
export function boxStyle(box: RBox, plate: RealPlate): Record<string, string> {
  const pct = (v: number, of: number) => `${String((100 * v) / of)}%`;
  return {
    left: pct(box.x, plate.viewBox.w),
    top: pct(box.y, plate.viewBox.h),
    width: pct(box.w, plate.viewBox.w),
    height: pct(box.h, plate.viewBox.h),
  };
}
