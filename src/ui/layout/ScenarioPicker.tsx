import { useId } from 'react';
import { SCENARIOS } from '../../sim/scenarios';
import { supports } from '../../sim/scenarios/types';
import { useStore } from '../../state/store';

/**
 * Loads any scenario the player's appliance can play (a native select: thumb-sized, keyboard and
 * screen-reader ready) in free play; names the lesson during one (scenario selection is the menu).
 */
export function ScenarioPicker() {
  const id = useId();
  const spec = useStore((s) => s.playerSpec);
  const scenarioId = useStore((s) => s.scenarioId);
  const loadScenario = useStore((s) => s.loadScenario);
  const lesson = useStore((s) => s.lesson);
  const playable = SCENARIOS.filter((s) => supports(s, spec));
  if (lesson !== null) {
    // In a lesson the scenario is fixed: say which, and leave changing it to the menu.
    const title = SCENARIOS.find((s) => s.id === lesson.scenarioId)?.title ?? lesson.scenarioId;
    return (
      <p className="scenario-picker scenario-picker__lesson">
        <span className="scenario-picker__label">Lesson {lesson.def.ladder}</span> {title}
      </p>
    );
  }
  return (
    <div className="scenario-picker">
      <label htmlFor={id} className="scenario-picker__label">
        Scenario
      </label>
      <select
        id={id}
        className="scenario-picker__select"
        value={scenarioId ?? ''}
        onChange={(e) => {
          loadScenario(e.target.value);
        }}
      >
        {scenarioId === null && <option value="">Custom state</option>}
        {playable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}
