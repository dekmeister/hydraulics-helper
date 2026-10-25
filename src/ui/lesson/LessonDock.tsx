import { useLayoutEffect, useRef } from 'react';
import { coachView, objectiveRows } from '../../state/lessonView';
import { activeTruck } from '../../state/selectors';
import { useStore } from '../../state/store';
import { getPanelLayout, getRealisticLayout } from '../appliances/registry';
import { gestureHint, metricMet, metricText, targetLabel } from './labels';
import './LessonDock.css';

/**
 * The lesson in play, docked to the bottom of the screen so it never covers a control (the page
 * reserves its height): the coach's current step, or the objective in hand with its live readings;
 * the latest radio call; the full objective list on demand; the debrief once it's over.
 */
export function LessonDock() {
  const lesson = useStore((s) => s.lesson);
  const sim = useStore((s) => s.sim);
  const acknowledgeCoach = useStore((s) => s.acknowledgeCoach);
  const openDebrief = useStore((s) => s.openDebrief);
  const expanded = useStore((s) => s.lessonListOpen);
  const setExpanded = useStore((s) => s.setLessonListOpen);
  const view = useStore((s) => s.saved.settings.panelView);
  const ref = useRef<HTMLElement>(null);

  // Reserve the dock's height at the foot of the page, so every control can scroll clear of it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const reserve = () => {
      document.documentElement.style.setProperty('--dock-h', `${String(el.offsetHeight)}px`);
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--dock-h');
    };
  }, []);

  if (lesson === null) return null;
  const applianceId = activeTruck(sim).spec.id;
  const layout = getPanelLayout(applianceId);
  const realistic = view === 'realistic' ? getRealisticLayout(applianceId) : undefined;
  const rows = objectiveRows(lesson, sim);
  const done = rows.filter((r) => r.state === 'done').length;
  const active = rows.filter((r) => r.state === 'active');
  const coach = coachView(lesson, sim);
  const radio = lesson.progress.radio.at(-1);
  const status = lesson.progress.status;
  const failure = lesson.def.failures?.find((f) => f.id === lesson.progress.failure);
  const fill = (text: string) =>
    text
      .replace(
        '{target}',
        coach?.targetKey === undefined ? 'it' : targetLabel(layout, coach.targetKey),
      )
      .replace(
        '{gesture}',
        coach?.targetKey === undefined ? '' : gestureHint(layout, realistic, coach.targetKey),
      );

  return (
    <section
      ref={ref}
      className="lesson-dock paper"
      aria-label="Lesson"
      data-dock="true"
      data-status={status}
    >
      {status !== 'running' ? (
        <div className="lesson-dock__end">
          <p className="lesson-dock__text">
            <strong>{status === 'passed' ? 'Scenario complete.' : 'Scenario failed.'}</strong>{' '}
            {failure?.text ?? 'Every objective done.'}
          </p>
          <button
            type="button"
            className="paper-button paper-button--primary"
            onClick={openDebrief}
          >
            See debrief
          </button>
        </div>
      ) : coach !== undefined ? (
        <div className="lesson-dock__coach" data-coach-step={coach.step.id}>
          <p className="lesson-dock__step">
            Step {coach.number} of {coach.count}
          </p>
          <p className="lesson-dock__text">{fill(coach.step.text)}</p>
          {coach.step.done === undefined && (
            <button
              type="button"
              className="paper-button paper-button--primary"
              onClick={acknowledgeCoach}
            >
              Got it
            </button>
          )}
        </div>
      ) : (
        <div className="lesson-dock__now">
          {active.map((r) => (
            <div key={r.id} className="lesson-dock__objective" data-objective={r.id}>
              <p className="lesson-dock__text">{r.text}</p>
              {r.holdS > 0 && r.heldS > 0 && (
                <p className="lesson-dock__hold">
                  Holding {Math.floor(r.heldS)} of {r.holdS} s
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {status === 'running' && coach === undefined && active.some((r) => r.metrics.length > 0) && (
        <ul className="lesson-dock__metrics">
          {active.flatMap((r) =>
            r.metrics.map((m, i) => (
              <li key={`${r.id}-${String(i)}`} data-met={metricMet(m) ? 'true' : 'false'}>
                <span aria-hidden="true">{metricMet(m) ? '✓' : '·'}</span>{' '}
                {metricText(layout, sim, m)}
              </li>
            )),
          )}
        </ul>
      )}
      <p className="lesson-dock__radio" aria-live="polite">
        {radio !== undefined && (
          <>
            <span className="lesson-dock__from">{radio.from}:</span> {radio.text}
          </>
        )}
      </p>
      <div className="lesson-dock__bar">
        <button
          type="button"
          className="paper-button"
          aria-expanded={expanded}
          aria-controls="lesson-objectives"
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          Objectives {done}/{rows.length}
        </button>
        {status === 'running' && (
          <button type="button" className="paper-button" onClick={openDebrief}>
            End
          </button>
        )}
      </div>
      <ol id="lesson-objectives" className="lesson-dock__list" hidden={!expanded}>
        {rows.map((r) => (
          <li key={r.id} data-state={r.state}>
            <span aria-hidden="true">
              {r.state === 'done' ? '✓' : r.state === 'active' ? '▸' : '○'}
            </span>{' '}
            <span className="visually-hidden">
              {r.state === 'done' ? 'Done: ' : r.state === 'active' ? 'Now: ' : 'Later: '}
            </span>
            {r.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
