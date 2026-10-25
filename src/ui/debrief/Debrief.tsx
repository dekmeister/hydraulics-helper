import { useMemo } from 'react';
import { getScenario, SCENARIOS } from '../../sim/scenarios';
import type { ScoreLineId } from '../../sim/lesson/score';
import { debrief } from '../../state/debrief';
import { lessonScore } from '../../state/lesson';
import { useStore } from '../../state/store';
import { supportsLesson } from '../../sim/scenarios/types';
import { Stars } from '../menu/Stars';
import './Debrief.css';

const SCORE_LABEL: Readonly<Record<ScoreLineId, string>> = {
  objectives: 'Objectives',
  clean: 'Clean running',
  cavitation: 'Cavitation',
  overheat: 'Pump overheating',
  hammer: 'Water hammer',
  bursts: 'Burst relay lengths',
  crewDry: 'Crews without water',
};

const signed = (n: number) => (n > 0 ? `+${String(n)}` : n < 0 ? `−${String(-n)}` : '0');

/** After a lesson: the result, the score and why, and where to go next. */
export function Debrief() {
  const lesson = useStore((s) => s.lesson);
  const sim = useStore((s) => s.sim);
  const spec = useStore((s) => s.playerSpec);
  const startLesson = useStore((s) => s.startLesson);
  const openPlay = useStore((s) => s.openPlay);
  const openMenu = useStore((s) => s.openMenu);
  const score = useMemo(() => (lesson === null ? null : lessonScore(lesson, sim)), [lesson, sim]);
  if (lesson === null || score === null) return null;
  const scenario = getScenario(lesson.scenarioId);
  const { headline, findings } = debrief(lesson.def, lesson.progress, score);
  const next = SCENARIOS.filter(
    (s) => (s.lesson?.ladder ?? 0) > lesson.def.ladder && supportsLesson(s, spec),
  ).sort((a, b) => (a.lesson?.ladder ?? 0) - (b.lesson?.ladder ?? 0))[0];
  return (
    <main
      className="screen debrief"
      aria-labelledby="debrief-title"
      data-status={lesson.progress.status}
    >
      <h1 id="debrief-title" className="screen__title">
        {headline}
      </h1>
      <p className="screen__sub">
        {lesson.def.ladder}. {scenario.title} · {spec.name}
      </p>
      <section className="paper debrief__card debrief__result" aria-label="Result">
        <Stars stars={score.stars} />
        <p className="debrief__points">
          <span className="debrief__points-value">{score.points}</span> points
        </p>
      </section>
      <section className="paper debrief__card" aria-labelledby="debrief-findings">
        <h2 id="debrief-findings" className="debrief__heading">
          What happened
        </h2>
        <ul className="debrief__list">
          {findings.map((f) => (
            <li
              key={f.id}
              className={`debrief__finding debrief__finding--${f.tone}`}
              data-finding={f.id}
            >
              <span className="debrief__finding-title">{f.title}</span>
              <span className="debrief__finding-detail">{f.detail}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="paper debrief__card" aria-labelledby="debrief-objectives">
        <h2 id="debrief-objectives" className="debrief__heading">
          Objectives
        </h2>
        <ul className="debrief__list">
          {lesson.def.objectives.map((o) => {
            const done = lesson.progress.objectives[o.id]?.doneAtS !== undefined;
            return (
              <li key={o.id} className="debrief__objective">
                <span aria-hidden="true">{done ? '✓' : '○'}</span>
                <span>
                  <span className="visually-hidden">{done ? 'Done: ' : 'Not done: '}</span>
                  {o.text}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="paper debrief__card" aria-labelledby="debrief-score">
        <h2 id="debrief-score" className="debrief__heading">
          Score
        </h2>
        <table className="debrief__score">
          <tbody>
            {score.lines.map((l) => (
              <tr key={l.id}>
                <th scope="row">{SCORE_LABEL[l.id]}</th>
                <td>{signed(l.points)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Total</th>
              <td>{score.points}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <div className="debrief__actions">
        {next !== undefined && lesson.progress.status === 'passed' && (
          <button
            type="button"
            className="paper-button paper-button--primary"
            onClick={() => {
              startLesson(next.id);
            }}
          >
            Next scenario
          </button>
        )}
        <button
          type="button"
          className="paper-button"
          onClick={() => {
            startLesson(lesson.scenarioId);
          }}
        >
          Try again
        </button>
        <button type="button" className="paper-button" onClick={openPlay}>
          Back to the panel
        </button>
        <button type="button" className="paper-button" onClick={openMenu}>
          All scenarios
        </button>
      </div>
    </main>
  );
}
