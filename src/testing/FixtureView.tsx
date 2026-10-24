import { useEffect } from 'react';
import { FIXTURE_RENDERERS } from './fixtures/renderers';

/** Renders one named fixture full-screen. An unknown id logs an error so e2e tests fail loudly. */
export function FixtureView({ id }: { id: string }) {
  const render = FIXTURE_RENDERERS[id];
  useEffect(() => {
    if (!render) console.error(`Unknown fixture: ${id}`);
  }, [id, render]);
  return render ? render() : <p role="alert">Unknown fixture: {id}</p>;
}
