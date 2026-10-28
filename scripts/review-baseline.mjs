#!/usr/bin/env node
// Render the visual baselines from a committed reference (docs/TESTING.md §5). Baselines aren't
// committed: the renders are deterministic, so a commit's screenshots are a build output of it.
// The reference is checked out in a temporary worktree (so uncommitted work is never in the
// baseline), rendered with this checkout's node_modules, and copied into SNAPSHOT_DIR with a
// stamp naming the commit. `npm run review` then compares the working tree against it.
//
// Usage: node scripts/review-baseline.mjs [--if-stale] [ref]   (default ref: HEAD)
//   --if-stale  do nothing if the stamp already names ref, or if every change since the stamped
//               commit is docs only (the stamp moves on); otherwise render.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Must match `snapshotPathTemplate` in playwright.review.config.ts. */
const SNAPSHOT_DIR = 'e2e/visual/__screenshots__';
/** First line: `<sha> <subject>` of the commit the baselines were rendered from. */
const STAMP = join(SNAPSHOT_DIR, '.baseline');
/** Changes that can't alter a render: a commit touching only these keeps its baselines. */
const DOCS_ONLY = /(\.md$)|(^docs\/)|(^Design\/)|(^Resources\/)/;

const args = process.argv.slice(2);
if (args.includes('-h') || args.includes('--help')) {
  console.log('Usage: node scripts/review-baseline.mjs [--if-stale] [ref]');
  process.exit(0);
}
const ifStale = args.includes('--if-stale');
const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD';

const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
const log = (msg) => console.error(`review-baseline: ${msg}`);

const sha = git('rev-parse', '--verify', `${ref}^{commit}`);
const subject = git('log', '-1', '--format=%s', sha);
const stamped = existsSync(STAMP) ? (readFileSync(STAMP, 'utf8').split(/\s/)[0] ?? '') : '';
const stamp = () => writeFileSync(STAMP, `${sha} ${subject}\n`);

if (ifStale && stamped !== '') {
  if (stamped === sha) {
    log(`baselines are current (${sha.slice(0, 7)} ${subject})`);
    process.exit(0);
  }
  const known = spawnSync('git', ['cat-file', '-e', `${stamped}^{commit}`]).status === 0;
  const changed = known ? git('diff', '--name-only', stamped, sha).split('\n').filter(Boolean) : [];
  if (known && changed.every((f) => DOCS_ONLY.test(f))) {
    stamp();
    log(`only docs changed since ${stamped.slice(0, 7)}; baselines now stamped ${sha.slice(0, 7)}`);
    process.exit(0);
  }
}

// The reference renders with this checkout's dependencies; a different lockfile means its
// baselines may differ for reasons that aren't in its code.
if (spawnSync('git', ['diff', '--quiet', sha, '--', 'package-lock.json']).status !== 0) {
  log(
    `warning: package-lock.json differs from ${sha.slice(0, 7)}; rendering with this checkout's node_modules`,
  );
}

const tmp = mkdtempSync(join(tmpdir(), 'pumpops-baseline-'));
const tree = join(tmp, 'tree');
log(`rendering baselines from ${sha.slice(0, 7)} ${subject} (a few minutes)`);
git('worktree', 'add', '--detach', '--quiet', tree, sha);
try {
  symlinkSync(resolve('node_modules'), join(tree, 'node_modules'), 'dir');
  // Commits from before baselines left git still carry them; render every one afresh.
  rmSync(join(tree, SNAPSHOT_DIR), { recursive: true, force: true });
  const run = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      '-c',
      'playwright.review.config.ts',
      '--update-snapshots=all',
      '--reporter=dot',
    ],
    // Every shot is written fresh, so Playwright notes each one; show its output only on failure.
    { cwd: tree, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (run.status !== 0) {
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
      .split('\n')
      .filter((line) => !/snapshot doesn't exist at .*writing actual/i.test(line))
      .join('\n');
    console.error(run.error?.message ?? output);
    log(`rendering ${sha.slice(0, 7)} failed; baselines left as they were`);
    process.exitCode = 1;
  } else {
    rmSync(SNAPSHOT_DIR, { recursive: true, force: true });
    cpSync(join(tree, SNAPSHOT_DIR), SNAPSHOT_DIR, { recursive: true });
    stamp();
    log(`baselines rendered from ${sha.slice(0, 7)}`);
  }
} finally {
  git('worktree', 'remove', '--force', tree);
  rmSync(tmp, { recursive: true, force: true });
}
