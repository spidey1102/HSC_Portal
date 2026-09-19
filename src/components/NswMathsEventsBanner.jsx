import { ArrowUpRight, CalendarDays, Minimize2 } from 'lucide-react';

export const NSW_MATHS_BOOKING_URL = 'https://bookwhen.com/nswmaths';

/** A site-owned promotion for NSW Maths events and mock exams. */
export default function NswMathsEventsBanner({ onMinimise }) {
  return (
    <aside className="nsw-maths-events" aria-label="NSW Maths upcoming events">
      <div className="nsw-maths-events__icon" aria-hidden="true">
        <CalendarDays size={20} strokeWidth={2.2} />
      </div>
      <div className="nsw-maths-events__copy">
        <span className="nsw-maths-events__eyebrow">NSW Maths</span>
        <strong>Upcoming events</strong>
        <p>Mock exams, revision sessions and upcoming bookings.</p>
      </div>
      <a
        className="nsw-maths-events__link"
        href={NSW_MATHS_BOOKING_URL}
        target="_blank"
        rel="noreferrer"
      >
        View dates &amp; book now
        <ArrowUpRight size={16} aria-hidden="true" />
      </a>
      <button
        type="button"
        className="nsw-maths-events__minimise"
        onClick={onMinimise}
        title="Minimise NSW Maths events"
        aria-label="Minimise NSW Maths events"
      >
        <Minimize2 size={16} aria-hidden="true" />
        <span>Minimise</span>
      </button>
    </aside>
  );
}
