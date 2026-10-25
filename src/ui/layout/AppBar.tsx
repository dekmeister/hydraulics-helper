import { useStore } from '../../state/store';

/** Above every screen: the game's name, the way back to the scenario menu, and the sound switch. */
export function AppBar() {
  const screen = useStore((s) => s.screen);
  const openMenu = useStore((s) => s.openMenu);
  const sound = useStore((s) => s.saved.settings.sound);
  const setSound = useStore((s) => s.setSound);
  return (
    <header className="app-bar">
      <p className="app-bar__name">PumpOps</p>
      <nav className="app-bar__actions" aria-label="Game">
        {screen !== 'menu' && (
          <button type="button" className="app-bar__button" onClick={openMenu}>
            Scenarios
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={sound}
          className="app-bar__button app-bar__sound"
          onClick={() => {
            setSound(!sound);
          }}
        >
          Sound {sound ? 'on' : 'off'}
        </button>
      </nav>
    </header>
  );
}
