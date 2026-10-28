import { useSound } from '../../audio/useSound';
import { useStore } from '../../state/store';
import { About } from '../about/About';
import { Debrief } from '../debrief/Debrief';
import { LessonDock } from '../lesson/LessonDock';
import { ScenarioMenu } from '../menu/ScenarioMenu';
import { AppBar } from './AppBar';
import { AppShell } from './AppShell';
import './AppRoot.css';

/**
 * The whole app: the app bar over the scenario menu, the panels (with a lesson's dock), a debrief
 * or About.
 * Plays the pump's sounds, except in the e2e build (docs/TESTING.md §9: test the state, not the sound).
 */
export function AppRoot() {
  useSound();
  const screen = useStore((s) => s.screen);
  const inLesson = useStore((s) => s.lesson !== null);
  return (
    <>
      <AppBar />
      {screen === 'menu' && <ScenarioMenu />}
      {screen === 'debrief' && <Debrief />}
      {screen === 'about' && <About />}
      {screen === 'play' && (
        <div className={inLesson ? 'app-play app-play--lesson' : 'app-play'}>
          <AppShell />
          {inLesson && <LessonDock />}
        </div>
      )}
    </>
  );
}
