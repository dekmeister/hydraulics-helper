// Press and hold on touch browsers (issue #21): a long press on Android Chrome or a TV browser
// raises the context menu / selection callout, and the menu cancels the pointer, dropping the hold.
// Every control that is pressed, held or dragged must refuse the menu and refuse to be selected.
import type { Page } from '@playwright/test';
import { APPLIANCES } from '../../src/sim/appliances/catalogue';
import { expect, test } from '../fixtures';
import { showRealistic } from '../panel';
import { load } from '../sources';

/** The elements a thumb presses, holds or drags, by view. */
const SURFACES = {
  simplified: [
    '.valve',
    '.throttle__slider',
    '.panel-button',
    '.primer__button',
    '.engine-switch__button',
  ],
  realistic: [
    '.bay-lever',
    '.pull-primer__handle',
    '.hand-primer__handle',
    '.speed-switch',
    '.vernier',
    '.real-engine',
  ],
} as const;

interface Probe {
  selector: string;
  index: number;
  contextMenuPrevented: boolean;
  userSelect: string;
  webkitUserSelect: string;
  touchAction: string;
}

/** Fire a long-press's `contextmenu` at each surface and read back how it is styled. */
async function probe(page: Page, selectors: readonly string[]): Promise<Probe[]> {
  return page.evaluate((sels) => {
    const out: Probe[] = [];
    for (const selector of sels) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el, index) => {
        const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        const cs = getComputedStyle(el);
        out.push({
          selector,
          index,
          contextMenuPrevented: ev.defaultPrevented,
          userSelect: cs.userSelect,
          webkitUserSelect: cs.getPropertyValue('-webkit-user-select'),
          touchAction: cs.touchAction,
        });
      });
    }
    return out;
  }, selectors);
}

for (const spec of APPLIANCES) {
  for (const view of ['simplified', 'realistic'] as const) {
    test(`${spec.id} ${view}: no menu or selection on pressed controls`, async ({ page }) => {
      await load(page, 'tank-attack', spec.id, undefined, { cold: true });
      if (view === 'realistic') await showRealistic(page);

      const found = await probe(page, SURFACES[view]);
      expect(found.length, 'surfaces found').toBeGreaterThan(0);
      for (const p of found) {
        const who = `${p.selector}[${String(p.index)}]`;
        expect(p.contextMenuPrevented, `${who} contextmenu prevented`).toBe(true);
        expect(p.userSelect, `${who} user-select`).toBe('none');
        expect(p.webkitUserSelect, `${who} -webkit-user-select`).toBe('none');
        expect(p.touchAction, `${who} touch-action`).toBe('none');
      }
    });
  }
}

test('the whole app shell, panel included, cannot be selected by a long press', async ({
  page,
}) => {
  await load(page, 'tank-attack', APPLIANCES[0]?.id ?? '', undefined, { cold: true });
  const styles = await page.evaluate(() => {
    const read = (sel: string) => {
      const el = document.querySelector(sel);
      return el === null ? null : getComputedStyle(el).userSelect;
    };
    return {
      shell: read('.app-shell'),
      panel: read('.pump-panel'),
    };
  });
  expect(styles.shell).toBe('none');
  expect(styles.panel).toBe('none');
});
