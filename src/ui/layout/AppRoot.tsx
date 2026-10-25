import { useStore } from '../../state/store';
import { Debrief } from '../debrief/Debrief';
import { LessonDock } from '../lesson/LessonDock';
import { ScenarioMenu } from '../menu/ScenarioMenu';
import { AppBar } from './AppBar';
import { AppShell } from './AppShell';
import './AppRoot.css';

/** The whole app: the app bar over the scenario menu, the panels (with a lesson's dock) or a debrief. */
export function AppRoot() {
  const screen = useStore((s) => s.screen);
  const inLesson = useStore((s) => s.lesson !== null);
  return (
    <>
      <AppBar />
      {screen === 'menu' && <ScenarioMenu />}
      {screen === 'debrief' && <Debrief />}
      {screen === 'play' && (
        <div className={inLesson ? 'app-play app-play--lesson' : 'app-play'}>
          <AppShell />
          {inLesson && <LessonDock />}
        </div>
      )}
    </>
  );
}
