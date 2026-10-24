// Review reporter for `npm run review` (docs/TESTING.md §6): writes review/report.md, per-project
// shots, contact sheets (one fixture at every viewport) and diff composites. No image library:
// sheets are small HTML grids screenshotted by Playwright's own Chromium.
import { chromium } from '@playwright/test';
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

type Outcome = 'failure' | 'changed' | 'new' | 'unchanged' | 'skipped';

interface Entry {
  fixture: string;
  file: string;
  project: string;
  outcome: Outcome;
  expect: string;
  errors: string[];
  meters: string;
  aria: string;
  diffRatio?: string;
  shot?: Buffer;
  expected?: Buffer;
  actual?: Buffer;
  diff?: Buffer;
}

const PROJECT_ORDER = ['phone', 'tablet', 'desktop'];

function attachment(result: TestResult, test: (name: string) => boolean): Buffer | undefined {
  return result.attachments.find((a) => test(a.name))?.body;
}

function classify(result: TestResult, hasDiff: boolean): Outcome {
  if (result.status === 'skipped') return 'skipped';
  if (result.status === 'passed') return 'unchanged';
  const text = result.errors.map((e) => e.message ?? '').join('\n');
  if (/snapshot doesn't exist|A snapshot doesn't exist/i.test(text)) return 'new';
  if (hasDiff) return 'changed';
  return 'failure';
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

function dataUri(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}

function gridHtml(title: string, cells: { label: string; png: Buffer }[]): string {
  const cols = cells
    .map(
      (c) =>
        `<figure><figcaption>${c.label}</figcaption><img src="${dataUri(c.png)}"></figure>`,
    )
    .join('');
  return `<!doctype html><html><head><style>
    body{margin:0;padding:16px;background:#f3efe4;font:14px monospace;color:#16191b}
    h1{font-size:16px;margin:0 0 12px}
    .row{display:flex;gap:16px;align-items:flex-start}
    figure{margin:0} figcaption{margin-bottom:6px;font-weight:bold}
    img{display:block;border:1px solid #16191b;max-height:1400px}
  </style></head><body><h1>${title}</h1><div class="row">${cols}</div></body></html>`;
}

export default class ReviewReporter implements Reporter {
  private readonly outputDir: string;
  private readonly entries: Entry[] = [];

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'review';
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const note = (type: string) => test.annotations.find((a) => a.type === type)?.description;
    const fixture = note('fixture') ?? test.title;
    const expected = attachment(result, (n) => n.endsWith('-expected.png'));
    const actual = attachment(result, (n) => n.endsWith('-actual.png'));
    const diff = attachment(result, (n) => n.endsWith('-diff.png'));
    const errors = result.errors.map((e) => stripAnsi(e.message ?? String(e.value)));
    const ratio = /ratio ([0-9.]+)/.exec(errors.join('\n'))?.[1];
    this.entries.push({
      fixture,
      file: fixture.replaceAll('/', '-'),
      project: test.parent.project()?.name ?? 'default',
      outcome: classify(result, diff !== undefined),
      expect: note('expect') ?? '',
      errors,
      meters: attachment(result, (n) => n === 'meters')?.toString('utf8') ?? '',
      aria: attachment(result, (n) => n === 'aria')?.toString('utf8') ?? '',
      ...(ratio === undefined ? {} : { diffRatio: ratio }),
      ...(expected === undefined ? {} : { expected }),
      ...(actual === undefined ? {} : { actual }),
      ...(diff === undefined ? {} : { diff }),
      ...(() => {
        const shot = attachment(result, (n) => n === 'shot') ?? actual;
        return shot === undefined ? {} : { shot };
      })(),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const out = this.outputDir;
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const write = (path: string, body: Buffer | string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
    };

    for (const e of this.entries) {
      if (e.shot) write(join(out, 'shots', e.project, `${e.file}.png`), e.shot);
    }

    const byFixture = new Map<string, Entry[]>();
    for (const e of this.entries.filter((x) => x.outcome !== 'skipped')) {
      byFixture.set(e.fixture, [...(byFixture.get(e.fixture) ?? []), e]);
    }
    for (const list of byFixture.values()) {
      list.sort((a, b) => PROJECT_ORDER.indexOf(a.project) - PROJECT_ORDER.indexOf(b.project));
    }

    const browser = await chromium.launch(
      process.env.PW_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
        : {},
    );
    try {
      const page = await browser.newPage({ deviceScaleFactor: 1 });
      const render = async (html: string, path: string) => {
        await page.setViewportSize({ width: 800, height: 400 });
        await page.setContent(html, { waitUntil: 'load' });
        write(path, await page.screenshot({ fullPage: true }));
      };
      for (const [fixture, list] of byFixture) {
        const file = fixture.replaceAll('/', '-');
        const cells = list.flatMap((e) => (e.shot ? [{ label: e.project, png: e.shot }] : []));
        if (cells.length > 0) await render(gridHtml(fixture, cells), join(out, 'sheets', `${file}.png`));
        for (const e of list) {
          if (e.outcome !== 'changed' || !e.expected || !e.actual || !e.diff) continue;
          await render(
            gridHtml(`${fixture} · ${e.project}`, [
              { label: 'expected', png: e.expected },
              { label: 'actual', png: e.actual },
              { label: 'diff', png: e.diff },
            ]),
            join(out, 'diffs', e.project, `${file}.png`),
          );
        }
      }
    } finally {
      await browser.close();
    }

    write(join(out, 'report.md'), this.report(byFixture, result.status));
  }

  private report(byFixture: Map<string, Entry[]>, status: FullResult['status']): string {
    const rel = (p: string) => relative(this.outputDir, join(this.outputDir, p));
    const groups: Record<Outcome, string[]> = {
      failure: [],
      changed: [],
      new: [],
      unchanged: [],
      skipped: [],
    };
    for (const [fixture, list] of byFixture) {
      const file = fixture.replaceAll('/', '-');
      const worst = (['failure', 'changed', 'new', 'unchanged'] as const).find((o) =>
        list.some((e) => e.outcome === o),
      );
      if (worst === undefined) continue;
      if (worst === 'unchanged') {
        groups.unchanged.push(`- ${fixture}`);
        continue;
      }
      const first = list[0];
      const lines = [`### ${fixture}`, '', `**Expect:** ${first?.expect ?? ''}`, ''];
      lines.push(`Contact sheet: \`${rel(`sheets/${file}.png`)}\``, '');
      for (const e of list) {
        const ratio = e.diffRatio === undefined ? '' : ` (${e.diffRatio} of pixels differ)`;
        lines.push(`- **${e.project}**: ${e.outcome}${ratio}`);
        if (e.outcome === 'changed') lines.push(`  - diff: \`${rel(`diffs/${e.project}/${file}.png`)}\``);
        if (e.outcome === 'failure') for (const err of e.errors) lines.push(`  - ${err.split('\n')[0] ?? ''}`);
      }
      if (first?.meters) lines.push('', `**Readings:** ${first.meters}`);
      if (first?.aria) {
        const aria = first.aria.split('\n').slice(0, 40).join('\n');
        lines.push('', '<details><summary>ARIA (trimmed)</summary>', '', '```yaml', aria, '```', '</details>');
      }
      groups[worst].push(lines.join('\n'));
    }
    const section = (title: string, items: string[]) =>
      `## ${title} (${String(items.length)})\n\n${items.length > 0 ? items.join('\n\n') : '_none_'}\n`;
    return [
      `# Review report`,
      '',
      `Run status: **${status}**. Start with Failures, then look at the contact sheet of every Changed and New fixture (docs/TESTING.md §6).`,
      '',
      section('Failures', groups.failure),
      section('Changed', groups.changed),
      section('New', groups.new),
      section('Unchanged', groups.unchanged),
    ].join('\n');
  }
}
