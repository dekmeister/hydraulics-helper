import { useMemo } from 'react';
import { SCENARIOS } from '../../sim/scenarios';
import { FREE_PLAY } from '../../sim/scenarios/freePlay';
import { TANK_ATTACK } from '../../sim/scenarios/tankAttack';
import {
  missingRequirements,
  supports,
  type Scenario,
  type ScenarioSetting,
} from '../../sim/scenarios/types';
import { lessonBrief } from '../../sim/scenarios/load';
import { useStore } from '../../state/store';
import { AppliancePicker } from './AppliancePicker';
import { Stars } from './Stars';
import './ScenarioMenu.css';

/** Where each scenario is set (issue #10), as its card's tag says it. */
const SETTING_NAMES: Readonly<Record<ScenarioSetting, string>> = {
  bush: 'Bush',
  village: 'Village',
  interface: 'Urban interface',
};

const LADDER: readonly Scenario[] = SCENARIOS.filter((s) => s.lesson !== undefined).sort(
  (a, b) => (a.lesson?.ladder ?? 0) - (b.lesson?.ladder ?? 0),
);

/**
 * The scenario ladder (ARCHITECTURE §5): each lesson with its brief, how the player has done on it
 * with this appliance, and the next one to try marked. Free play loads the sandbox.
 */
export function ScenarioMenu() {
  const spec = useStore((s) => s.playerSpec);
  const results = useStore((s) => s.saved.results);
  const startLesson = useStore((s) => s.startLesson);
  const loadScenario = useStore((s) => s.loadScenario);
  const resumable = useStore((s) => s.lesson?.progress.status === 'running');
  const openPlay = useStore((s) => s.openPlay);
  // Each brief names what this truck's crews run, so it's built on the truck: once per pick.
  const briefs = useMemo(() => new Map(LADDER.map((s) => [s.id, lessonBrief(s, spec)])), [spec]);
  const playable = (s: Scenario) => missingRequirements(s, spec, {}, true).length === 0;
  const next = LADDER.find((s) => playable(s) && results[s.id]?.[spec.id]?.passed !== true);
  // The sandbox fireground, or on a truck that can't work it, the first one it can play.
  const sandbox = [FREE_PLAY, TANK_ATTACK, ...SCENARIOS].find((s) => supports(s, spec));
  return (
    <main className="screen menu" aria-labelledby="menu-title">
      <h1 id="menu-title" className="screen__title">
        Scenarios
      </h1>
      <p className="screen__sub">Pick the truck you’re training on, then a scenario.</p>
      <AppliancePicker />
      {resumable && (
        <p className="menu__resume">
          <button type="button" className="paper-button paper-button--primary" onClick={openPlay}>
            Resume lesson
          </button>
        </p>
      )}
      <ol className="menu__ladder">
        {LADDER.map((s) => {
          const missing = missingRequirements(s, spec, {}, true);
          const result = results[s.id]?.[spec.id];
          const isNext = s === next;
          const n = s.lesson?.ladder ?? 0;
          return (
            <li
              key={s.id}
              className={`menu-card paper${isNext ? ' menu-card--next' : ''}`}
              data-scenario={s.id}
            >
              <div className="menu-card__head">
                <span className="menu-card__number" aria-hidden="true">
                  {n}
                </span>
                <h2 className="menu-card__title">{s.title}</h2>
              </div>
              <p className="menu-card__brief">{briefs.get(s.id)}</p>
              <div className="menu-card__foot">
                <p className="menu-card__status">
                  <span className="menu-card__tag" data-setting={s.setting}>
                    {SETTING_NAMES[s.setting]}
                  </span>
                  {s.lesson?.coach !== undefined && <span className="menu-card__tag">Guided</span>}
                  {isNext && <span className="menu-card__tag menu-card__tag--next">Next up</span>}
                  {missing.length > 0 ? (
                    <span>Needs {missing.join(' and ')}</span>
                  ) : result === undefined ? (
                    <span>Not tried yet</span>
                  ) : (
                    <>
                      <span>{result.passed ? 'Passed' : 'Not passed yet'}</span>
                      {result.passed && (
                        <>
                          <Stars stars={result.bestStars} />
                          <span>best {result.bestPoints}</span>
                        </>
                      )}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className={`paper-button${isNext ? ' paper-button--primary' : ''}`}
                  aria-label={`Start ${String(n)}. ${s.title}`}
                  disabled={missing.length > 0}
                  onClick={() => {
                    startLesson(s.id);
                  }}
                >
                  {result === undefined ? 'Start' : 'Play again'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <section className="menu-card paper menu__free" aria-labelledby="free-play-title">
        <h2 id="free-play-title" className="menu-card__title">
          Free play
        </h2>
        <p className="menu-card__brief">
          Two trucks, a dam, a hydrant, a relay, crews and a monitor. No objectives and no score:
          try anything, break things.
        </p>
        <button
          type="button"
          className="paper-button"
          disabled={sandbox === undefined}
          onClick={() => {
            if (sandbox !== undefined) loadScenario(sandbox.id);
          }}
        >
          Free play
        </button>
      </section>
    </main>
  );
}
