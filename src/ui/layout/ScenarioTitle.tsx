import { SCENARIOS } from '../../sim/scenarios';
import { FREE_PLAY } from '../../sim/scenarios/freePlay';
import { useStore } from '../../state/store';

/**
 * Names what's being played above the scene: the lesson, or free play (with the fireground's
 * title when it isn't the sandbox's own, as fixtures load). Choosing is the menu's job.
 */
export function ScenarioTitle() {
  const scenarioId = useStore((s) => s.scenarioId);
  const lesson = useStore((s) => s.lesson);
  const title = (id: string | null) => SCENARIOS.find((s) => s.id === id)?.title ?? id;
  if (lesson !== null) {
    return (
      <p className="scenario-title">
        <span className="scenario-title__label">Lesson {lesson.def.ladder}</span>{' '}
        {title(lesson.scenarioId)}
      </p>
    );
  }
  return (
    <p className="scenario-title">
      <span className="scenario-title__label">Free play</span>
      {scenarioId !== null && scenarioId !== FREE_PLAY.id && <> {title(scenarioId)}</>}
    </p>
  );
}
