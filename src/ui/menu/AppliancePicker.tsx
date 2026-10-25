import { APPLIANCES } from '../../sim/appliances/catalogue';
import { useStore } from '../../state/store';
import { applianceSummary } from './summary';

/**
 * Which truck the player trains on: a radio group of the catalogue's appliances, each with a
 * one-line fitout summary. The ladder below follows the choice; it's saved with the settings.
 */
export function AppliancePicker() {
  const spec = useStore((s) => s.playerSpec);
  const setPlayerAppliance = useStore((s) => s.setPlayerAppliance);
  return (
    <fieldset className="menu-card paper appliance-picker">
      <legend className="appliance-picker__legend">Your appliance</legend>
      {APPLIANCES.map((a) => (
        <label
          key={a.id}
          className={`appliance-picker__option${a.id === spec.id ? ' appliance-picker__option--on' : ''}`}
          data-appliance={a.id}
        >
          <input
            type="radio"
            name="appliance"
            value={a.id}
            checked={a.id === spec.id}
            onChange={() => {
              setPlayerAppliance(a.id);
            }}
          />
          <span className="appliance-picker__dot" aria-hidden="true" />
          <span className="appliance-picker__text">
            <span className="appliance-picker__name">{a.name}</span>
            <span className="appliance-picker__summary">{applianceSummary(a)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
