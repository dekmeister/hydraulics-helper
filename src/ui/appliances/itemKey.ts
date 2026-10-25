// Panel item keys: how the lesson coach names what it points at (`state/lessonView.ts`). The same
// key names a control or instrument in the simplified and the realistic view.
import type { RealItem } from './realistic';
import type { PanelItem } from './types';

/** A simplified-panel item's key. */
export function itemKey(item: PanelItem): string {
  switch (item.kind) {
    case 'gauge':
    case 'tank-level':
      return `i:${item.instrument}`;
    case 'valve':
    case 'delivery':
    case 'primer':
      return `c:${item.control}`;
    case 'throttle':
    case 'warnings':
      return item.kind;
  }
}

/** A realistic-view item's key; null for an item that isn't in the game yet. */
export function realItemKey(item: RealItem): string | null {
  switch (item.kind) {
    case 'gauge':
    case 'tank-gauge':
      return `i:${item.instrument}`;
    case 'lever':
    case 'outlet':
    case 'primer':
      return `c:${item.control}`;
    case 'throttle':
      return 'throttle';
    case 'inert':
      return null;
  }
}
