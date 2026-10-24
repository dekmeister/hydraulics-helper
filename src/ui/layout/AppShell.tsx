import { PumpPanel } from '../panel-pump/PumpPanel';
import './AppShell.css';

/** Responsive two-panel shell: scene above pump panel on phones, side by side from 900 px. */
export function AppShell() {
  return (
    <main className="app-shell">
      <section className="app-panel" aria-labelledby="scene-title">
        <h2 id="scene-title" className="app-panel__title">
          Scene
        </h2>
      </section>
      <section className="app-panel app-panel--pump" aria-labelledby="pump-panel-title">
        <h2 id="pump-panel-title" className="app-panel__title">
          Pump panel
        </h2>
        <PumpPanel />
      </section>
    </main>
  );
}
