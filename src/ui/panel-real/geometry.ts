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

/** Hit box of a lever: its pivot and the quarter it sweeps from shut to open, padded. */
export function leverBox(g: LeverGeometry): RBox {
  const pts = [g.pivot, leverTip(g, g.shutDeg), leverTip(g, g.openDeg)];
  // The arc bulges past its ends only where it crosses a 90° axis, which a quarter between two
  // axis-aligned ends never does; for other angles, sample the middle too.
  pts.push(leverTip(g, (g.shutDeg + g.openDeg) / 2));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - LEVER_PAD_U;
  const y0 = Math.min(...ys) - LEVER_PAD_U;
  return {
    x: x0,
    y: y0,
    w: Math.max(...xs) + LEVER_PAD_U - x0,
    h: Math.max(...ys) + LEVER_PAD_U - y0,
  };
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
    case 'gauge':
    case 'tank-gauge':
    case 'inert':
      return [];
  }
}

/** An item's drawing box on its plate (levers: their hit box). */
export function itemBox(item: RealItem): RBox {
  switch (item.kind) {
    case 'lever':
    case 'outlet':
      return leverBox(item);
    default:
      return item.box;
  }
}

/** Width each plate is drawn at, CSS px, when the panel is `panelPx` wide. */
export function plateWidthsPx(plates: readonly RealPlate[], panelPx: number): Map<string, number> {
  const insetW = plates.filter((p) => p.inset).reduce((w, p) => w + p.viewBox.w, 0);
  return new Map(
    plates.map((p) => [p.id, p.inset ? (panelPx * p.viewBox.w) / insetW : panelPx] as const),
  );
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
