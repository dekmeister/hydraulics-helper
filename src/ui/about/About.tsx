import { useStore } from '../../state/store';
import './About.css';

const REPO_URL = 'https://github.com/dekmeister/hydraulics-helper';

/** What the game is and isn't: an unofficial self-study tool on a simplified hydraulics model. */
export function About() {
  const closeAbout = useStore((s) => s.closeAbout);
  return (
    <main className="screen about" aria-labelledby="about-title">
      <h1 id="about-title" className="screen__title">
        About PumpOps
      </h1>
      <p className="screen__sub">A pump operator trainer for rural fire appliances.</p>
      <section className="paper about__card" aria-labelledby="about-what">
        <h2 id="about-what" className="about__heading">
          What this is
        </h2>
        <p>
          An unofficial self-study tool for practising pump operation: reading the gauges, working
          the deliveries, tank to pump, draughting and relays.
        </p>
        <p>It is not affiliated with, endorsed by or produced by any fire service or agency.</p>
      </section>
      <section className="paper about__card" aria-labelledby="about-sim">
        <h2 id="about-sim" className="about__heading">
          How the simulation works
        </h2>
        <p>
          The game is driven by physics, not scripts. Ten times a second it works out the flows and
          pressures through the pump, hoses and branches from real hydraulic relationships: the
          pump’s curve, friction loss in the hose, the flow through each branch and the height the
          water climbs. Then it moves on the slower things: the water in the tank, engine speed, the
          primer’s vacuum and the pump’s temperature.
        </p>
        <p>
          Cavitation, water hammer, overheating and running dry come out of the same model rather
          than being set off on cue, so what you do on the panel is what causes them.
        </p>
        <p>
          It is simplified, and some of its figures are estimates. Trust it for how things behave
          (what rises, what falls, what goes wrong and why) more than for exact numbers. Real
          appliances, pumps and hoses differ.
        </p>
      </section>
      <section className="paper about__card" aria-labelledby="about-training">
        <h2 id="about-training" className="about__heading">
          Alongside your training, not instead of it
        </h2>
        <p>
          The program may contain errors and must not be relied on. Your training manuals, standard
          operating procedures and instructors are the authority on current procedures.
        </p>
      </section>
      <section className="paper about__card" aria-labelledby="about-source">
        <h2 id="about-source" className="about__heading">
          Source
        </h2>
        <p>
          PumpOps is open source. Code, issues and corrections:{' '}
          <a className="about__link" href={REPO_URL} target="_blank" rel="noreferrer">
            github.com/dekmeister/hydraulics-helper
          </a>
        </p>
      </section>
      <div className="about__actions">
        <button type="button" className="paper-button" onClick={closeAbout}>
          Back
        </button>
      </div>
    </main>
  );
}
