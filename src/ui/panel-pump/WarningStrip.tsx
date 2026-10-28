import type { Warning, WarningId } from '../../state/selectors';
import { COLOR } from '../theme/colors';
import './WarningStrip.css';

/** Lamp icons, drawn on a 40 × 40 glass. */
const ICONS: Readonly<Record<WarningId, string>> = {
  tank: 'M20 8 C14 16 12 20 12 24 a8 8 0 0 0 16 0 C28 20 26 16 20 8 Z',
  supply: 'M8 20 H26 M20 13 L27 20 L20 27 M30 12 V28',
  'over-pressure': 'M10 27 A11 11 0 1 1 30 27 M20 20 L27 13',
  overheat: 'M18 9 a2 2 0 0 1 4 0 V22 a5 5 0 1 1 -4 0 Z M14 31 h12',
  cavitation: 'M13 22 a3 3 0 1 0 0.1 0 M24 15 a4 4 0 1 0 0.1 0 M26 27 a2.5 2.5 0 1 0 0.1 0',
  // A pipe with a shock: the bang of a valve slammed shut.
  hammer: 'M7 24 H19 M19 18 V30 M24 16 L27 12 M26 24 H31 M24 32 L27 36',
};

const LEVEL_TEXT = { off: 'off', caution: 'caution', alarm: 'alarm' } as const;

function Lamp({ warning }: { warning: Warning }) {
  const { level } = warning;
  const lit = level === 'caution' || level === 'alarm';
  const glass = level === 'caution' ? COLOR.caution : level === 'alarm' ? COLOR.alarm : '#262a26';
  const icon = lit ? COLOR.ink : '#5a615b';
  return (
    <li className={`lamp lamp--${level}`} data-warning={warning.id}>
      <svg className="lamp__glass" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx={24} cy={24} r={23} style={{ fill: COLOR.galvMid }} />
        <circle cx={24} cy={24} r={19} style={{ fill: glass }} />
        {/* Severity shape appears only when lit: triangle = caution, diamond = alarm (Design §2). */}
        {level === 'caution' && (
          <path d="M24 9 L39 36 H9 Z" fill="none" strokeWidth={2.5} style={{ stroke: COLOR.ink }} />
        )}
        {level === 'alarm' && (
          <path
            d="M24 7 L41 24 L24 41 L7 24 Z"
            fill="none"
            strokeWidth={2.5}
            style={{ stroke: COLOR.ink }}
          />
        )}
        <g transform="translate(4 4)">
          <path
            d={ICONS[warning.id]}
            fill="none"
            strokeWidth={2.2}
            strokeLinecap="round"
            style={{ stroke: icon }}
          />
        </g>
      </svg>
      <span className="lamp__caption">
        {warning.label}
        <span className="visually-hidden"> lamp: {LEVEL_TEXT[level]}</span>
      </span>
    </li>
  );
}

interface Props {
  warnings: readonly Warning[];
  /** Offered under a burst relay's alarm (free play): the crew replaces the burst length. */
  onReplaceBurst?: () => void;
}

/**
 * Warning strip (ARCHITECTURE §7): a lamp per warning plus a polite live region spelling out
 * whatever is lit, so faults read without sound and without colour alone.
 */
export function WarningStrip({ warnings, onReplaceBurst }: Props) {
  const lit = warnings.filter((w) => w.level === 'caution' || w.level === 'alarm');
  return (
    <div className="warnings">
      <ul className="warnings__lamps" aria-label="Warning lamps">
        {warnings.map((w) => (
          <Lamp key={w.id} warning={w} />
        ))}
      </ul>
      <p className="warnings__messages" role="status" aria-live="polite">
        {lit.length === 0 ? 'No warnings.' : lit.map((w) => w.message).join(' ')}
      </p>
      {onReplaceBurst !== undefined && (
        <button type="button" className="warnings__action" onClick={onReplaceBurst}>
          Replace burst length
        </button>
      )}
    </div>
  );
}
