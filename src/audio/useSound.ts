import { useEffect } from 'react';
import { activeTruck } from '../state/selectors';
import { useStore } from '../state/store';
import { createSoundEngine, type SoundEngine } from './engine';
import { soundParams } from './params';

/**
 * Plays the pump while the panels are on screen and sound is on. Browsers only allow audio after a
 * user gesture, so the engine is built on the first tap or key press; muting or leaving the panels
 * suspends it.
 */
export function useSound(): void {
  useEffect(() => {
    if (import.meta.env.VITE_E2E) return;
    let engine: SoundEngine | undefined;
    const audible = () => {
      const s = useStore.getState();
      return s.saved.settings.sound && s.screen === 'play';
    };
    const refresh = () => {
      if (engine === undefined) return;
      const s = useStore.getState();
      engine.setRunning(audible());
      if (audible()) engine.update(soundParams(activeTruck(s.sim), s.inputs));
    };
    const start = () => {
      if (engine !== undefined || !audible() || typeof AudioContext === 'undefined') return;
      engine = createSoundEngine(new AudioContext());
      refresh();
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    const unsubscribe = useStore.subscribe(() => {
      start();
      refresh();
    });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      unsubscribe();
      engine?.close();
    };
  }, []);
}
