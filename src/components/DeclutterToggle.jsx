import { Minimize2 } from 'lucide-react';

export default function DeclutterToggle({ enabled, onToggle, className = 'btn-secondary', style }) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={onToggle}
      aria-label="Declutter home dashboard"
      aria-pressed={enabled}
      title={enabled ? 'Show the full home dashboard' : 'Show only the HSC timetable on home'}
    >
      <Minimize2 size={14} aria-hidden="true" />
      <span>{enabled ? 'Declutter on' : 'Declutter'}</span>
    </button>
  );
}
