import { useStore } from '../../state/store';

/**
 * Which truck the pump panel operates, when the fireground has more than one (relays). One
 * thumb-sized button per truck, pressed for the active one; tapping a truck on the scene does the
 * same. Lives in the pump panel's header so a phone player can switch without scrolling up.
 */
export function TruckSwitcher() {
  const trucks = useStore((s) => s.sim.trucks);
  const activeTruckId = useStore((s) => s.sim.activeTruckId);
  const setActiveTruck = useStore((s) => s.setActiveTruck);
  if (trucks.length < 2) return null;
  return (
    <div className="truck-switcher" role="group" aria-label="Truck you operate">
      {trucks.map((t) => (
        <button
          key={t.id}
          type="button"
          className="truck-switcher__truck"
          aria-pressed={t.id === activeTruckId}
          data-truck={t.id}
          onClick={() => {
            if (t.id !== activeTruckId) setActiveTruck(t.id);
          }}
        >
          <span className="truck-switcher__label">{t.label}</span>
          <span className="truck-switcher__spec">{t.spec.name}</span>
        </button>
      ))}
    </div>
  );
}
