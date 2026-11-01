import { PumpPanel } from '../panel-pump/PumpPanel';
import { SceneView } from '../panel-scene/SceneView';
import { useStore } from '../../state/store';
import { ScenarioTitle } from './ScenarioTitle';
import { TruckSwitcher } from './TruckSwitcher';
import './AppShell.css';

/** Responsive two-panel shell: scene above pump panel on phones, side by side from 900 px. */
export function AppShell() {
  const activeTruckId = useStore((s) => s.sim.activeTruckId);
  return (
    // A long press raises the context menu on touch browsers, and the menu cancels the pointer, which
    // drops a held primer or START (issue #21). Nothing in the shell needs the menu.
    <main
      className="app-shell"
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <section className="app-panel" aria-labelledby="scene-title">
        <div className="app-panel__head">
          <h2 id="scene-title" className="app-panel__title">
            Scene
          </h2>
          <ScenarioTitle />
        </div>
        <SceneView />
      </section>
      <section className="app-panel app-panel--pump" aria-labelledby="pump-panel-title">
        <div className="app-panel__head">
          <h2 id="pump-panel-title" className="app-panel__title">
            Pump panel
          </h2>
          <TruckSwitcher />
        </div>
        {/* A fresh panel per truck: needles start at its readings, not swing from the last. */}
        <PumpPanel key={activeTruckId} />
      </section>
    </main>
  );
}
