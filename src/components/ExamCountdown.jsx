import React, { useState, useEffect } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { getNextExamState, formatExamDate } from '../utils/examDates';

function CountdownUnit({ value, label, urgent }) {
  return (
    <div
      style={{
        minWidth: '56px',
        textAlign: 'center',
        padding: '8px 6px',
        borderRadius: '8px',
        background: urgent ? 'var(--status-warning)' : 'var(--accent-brand)',
        color: '#fff',
      }}
    >
      <div style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.9, marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}

export default function ExamCountdown({ subjectName = null }) {
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch('/hsc-exam-dates.json')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load exam dates.');
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(err.message);
      });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loadError) return null;
  if (!config) return null;

  const state = getNextExamState(config, { subjectName }, now);

  if (state.status === 'unavailable' || state.status === 'no-subject-exams') {
    return null;
  }

  const cardStyle = {
    marginTop: '20px',
    padding: '16px 20px',
    background: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
  };

  if (state.status === 'finished') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Calendar size={20} color="var(--status-positive)" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--header-primary)' }}>
            {state.subjectName
              ? `All ${state.subjectName} written exams have finished`
              : `HSC ${state.year} written exams have finished`}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Good luck with results. Confirm dates on NESA for next year.
        </p>
      </div>
    );
  }

  const { countdown, target, nextUp, upcomingInScope, period, nesaUrl, nesaPdfUrl, year, mode, subjectName: subject } = state;
  const isImminent = countdown.totalSeconds < 3600;

  const heading =
    mode === 'subject' && subject
      ? `${subject} — next exam`
      : 'Next HSC written exam';

  return (
    <div
      style={{
        ...cardStyle,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: '16px 24px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 280px' }}>
        <div style={{ fontSize: '12px', color: 'var(--header-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
          <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          HSC {year} · {heading}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <CountdownUnit value={countdown.days} label="days" urgent={isImminent} />
          <CountdownUnit value={countdown.hours} label="hrs" urgent={isImminent} />
          <CountdownUnit value={countdown.minutes} label="min" urgent={isImminent} />
          <CountdownUnit value={countdown.seconds} label="sec" urgent={isImminent} />
        </div>

        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--header-primary)', marginBottom: '4px' }}>
            {target.label}
          </div>
          <div style={{ fontSize: '13px', color: isImminent ? 'var(--status-warning)' : 'var(--text-muted)' }}>
            {formatExamDate(target.date, target.time, target.endTime)}
            {target.hscDay != null && ` · HSC Day ${target.hscDay}`}
          </div>
          {nextUp && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Then: {nextUp.label} ({formatExamDate(nextUp.date, nextUp.time, nextUp.endTime)})
            </div>
          )}
        </div>

        {mode === 'subject' && upcomingInScope.length > 1 && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--header-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Upcoming in this subject
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {upcomingInScope.map((exam) => (
                <li key={exam.id} style={{ marginBottom: '4px' }}>
                  {exam.label} — {formatExamDate(exam.date, exam.time, exam.endTime)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'global' && period && (
          <div style={{ fontSize: '12px', color: 'var(--interactive-muted)' }}>
            Exam period: {formatExamDate(period.start)} – {formatExamDate(period.end)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
        <a
          href={nesaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            textDecoration: 'none',
          }}
        >
          NESA timetable
          <ExternalLink size={14} />
        </a>
        {nesaPdfUrl && (
          <a
            href={nesaPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: 'var(--text-muted)' }}
          >
            Download PDF timetable
          </a>
        )}
        <span style={{ fontSize: '11px', color: 'var(--interactive-muted)', maxWidth: '220px' }}>
          {config.source ? `${config.source}. ` : ''}
          Times are Australia/Sydney. Confirm your personal timetable on Students Online.
        </span>
      </div>
    </div>
  );
}
