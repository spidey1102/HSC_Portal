import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, BookOpen, Clock, ChevronDown, ChevronUp, Sparkles, Check } from 'lucide-react';
import { getPaperIdentity } from '../utils/paperIdentity';
import AgentCommandCenter from './AgentCommandCenter';

const TIMER_MAX_DURATION_MINUTES = 4 * 60;
const TIMER_DURATION_OPTIONS = Array.from({ length: TIMER_MAX_DURATION_MINUTES / 5 }, (_, index) => (index + 1) * 5);

function formatTimerDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
}

export default function PracticeRoom({
  paper,
  subjectName,
  schoolName,
  onClose,
  agentContext = {}
}) {
  const paperKey = getPaperIdentity(paper);

  const loadSavedTimerSeconds = () => {
    try {
      const raw = localStorage.getItem('hsc_timer_duration_secs');
      const secs = parseInt(raw, 10);
      if (secs >= 60 && secs <= TIMER_MAX_DURATION_MINUTES * 60) return secs;
    } catch (e) {
      // ignore
    }
    return 3 * 3600;
  };

  const initialTimerSecs = loadSavedTimerSeconds();

  // Timer States
  const [secondsLeft, setSecondsLeft] = useState(initialTimerSecs);
  const [totalSeconds, setTotalSeconds] = useState(initialTimerSecs);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPopoverOpen, setTimerPopoverOpen] = useState(false);
  const timerInterval = useRef(null);
  // Formula Sheet states
  const [showFormula, setShowFormula] = useState(false);
  const [mobileTab, setMobileTab] = useState('paper');
  const [isPaperAgentOpen, setIsPaperAgentOpen] = useState(false);
  const [paperContext, setPaperContext] = useState({
    status: 'loading',
    text: '',
    pagesExtracted: 0,
    pageStart: 0,
    pageEnd: 0,
    totalPages: 0,
    reason: '',
  });

  const [actionMessage, setActionMessage] = useState('');
  const actionTimerRef = useRef(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const getFormulaSheet = (sub) => {
    if (!sub) return null;
    const s = sub.toLowerCase();
    
    if (s.includes('physics')) {
      return '/sheets/physics-data-sheet.pdf';
    } else if (s.includes('chemistry')) {
      return '/sheets/chemistry-data-sheet.pdf';
    } else if (s.includes('earth') || s.includes('environmental')) {
      return '/sheets/earth-env-science-sheet.pdf';
    } else if (s.includes('math')) {
      if (s.includes('standard')) {
        return '/sheets/maths-standard-reference.pdf';
      } else {
        // Advanced, Extension 1, Extension 2
        return '/sheets/mathematics-reference.pdf';
      }
    }
    return null;
  };

  const sheetUrl = getFormulaSheet(subjectName);

  const requestPaperContext = async (signal) => {
    const requestUrl = `/api/agent/paper-context?paperId=${encodeURIComponent(paper.v)}&paperName=${encodeURIComponent(paper.n)}`;
    const response = await fetch(requestUrl, { signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'The complete paper could not be prepared.');
    return payload;
  };

  useEffect(() => {
    const controller = new AbortController();
    setPaperContext({ status: 'loading', text: '', pagesExtracted: 0, pageStart: 0, pageEnd: 0, totalPages: 0, reason: '' });

    requestPaperContext(controller.signal)
      .then((payload) => {
        setPaperContext({
          status: payload.status || 'unavailable',
          text: payload.text || '',
          pagesExtracted: payload.pagesExtracted || 0,
          pageStart: payload.pageStart || 0,
          pageEnd: payload.pageEnd || 0,
          totalPages: payload.totalPages || 0,
          reason: payload.reason || '',
        });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setPaperContext({ status: 'unavailable', text: '', pagesExtracted: 0, pageStart: 0, pageEnd: 0, totalPages: 0, reason: error.message || 'The complete paper could not be prepared.' });
      });

    return () => controller.abort();
  }, [paper.v, paper.n, paperKey]);

  // Record that this paper was viewed (recently opened)
  useEffect(() => {
    try {
      const key = 'hsc_viewed_papers';
      const raw = localStorage.getItem(key) || '[]';
      const arr = JSON.parse(raw);
      const entry = { key: paperKey, v: paper.v, n: paper.n, s: paper.s, h: paper.h, y: paper.y, dateViewed: Date.now() };
      const filtered = (arr || []).filter(a => String(a.key || a.v) !== paperKey);
      filtered.unshift(entry);
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 200)));
    } catch (e) {
      // ignore
    }
  }, [paperKey, paper]);

  // Track whether this paper is marked completed locally
  useEffect(() => {
    try {
      const key = 'hsc_completed_papers';
      const raw = localStorage.getItem(key) || '[]';
      const arr = JSON.parse(raw) || [];
      const found = arr.some(a => String(a.paperId || a.paperIdLegacy || a.v) === paperKey || String(a.paperId || a.paperIdLegacy || a.v) === String(paper.v));
      setIsCompleted(Boolean(found));
    } catch (e) {
      setIsCompleted(false);
    }
  }, [paperKey, paper.v]);

  useEffect(() => {
    if (timerRunning) {
      timerInterval.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            clearInterval(timerInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerInterval.current);
    }

    return () => clearInterval(timerInterval.current);
  }, [timerRunning]);

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setTimerDuration = (minutes) => {
    const safeMinutes = Math.min(TIMER_MAX_DURATION_MINUTES, Math.max(5, Number(minutes) || 5));
    const total = safeMinutes * 60;

    setSecondsLeft(total);
    setTotalSeconds(total);
    setTimerRunning(false);

    try {
      localStorage.setItem('hsc_timer_duration_secs', String(total));
    } catch (e) {
      // ignore
    }
  };

  const handleMarkCompleted = () => {
    try {
      const key = 'hsc_completed_papers';
      const raw = localStorage.getItem(key) || '[]';
      const arr = JSON.parse(raw);
      const entryId = `${paperKey}_${Date.now()}`;
      const entry = {
        id: entryId,
        paperId: paperKey,
        paperIdLegacy: paper.v,
        paperName: paper.n,
        subjectName: subjectName,
        schoolName: schoolName,
        dateCompleted: Date.now(),
        timeSpent: totalSeconds - secondsLeft,
        status: 'Completed'
      };
      const idx = (arr || []).findIndex(a => String(a.paperId || a.paperIdLegacy || a.v) === paperKey || String(a.paperId || a.paperIdLegacy || a.v) === String(paper.v));
      if (idx >= 0) arr[idx] = { ...arr[idx], ...entry };
      else arr.unshift(entry);
      localStorage.setItem(key, JSON.stringify((arr || []).slice(0, 500)));
      setActionMessage('Marked as completed');
      setIsCompleted(true);
      try { window.dispatchEvent(new CustomEvent('hsc:history-updated')); } catch (e) { /* ignore */ }
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    } catch (e) {
      setActionMessage('Failed to mark completed');
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    }
  };

  const handleUnmarkCompleted = () => {
    try {
      const key = 'hsc_completed_papers';
      const raw = localStorage.getItem(key) || '[]';
      const arr = (JSON.parse(raw) || []).filter(a => String(a.paperId || a.paperIdLegacy || a.v) !== paperKey && String(a.paperId || a.paperIdLegacy || a.v) !== String(paper.v));
      localStorage.setItem(key, JSON.stringify(arr));
      setActionMessage('Marked as incomplete');
      setIsCompleted(false);
      try { window.dispatchEvent(new CustomEvent('hsc:history-updated')); } catch (e) { /* ignore */ }
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    } catch (e) {
      setActionMessage('Failed to update');
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    }
  };

  const timerDurationMinutes = Math.min(TIMER_MAX_DURATION_MINUTES, Math.max(5, Math.round(totalSeconds / 60 / 5) * 5));
  const timerDurationIndex = TIMER_DURATION_OPTIONS.indexOf(timerDurationMinutes);
  const timerWheelAngle = 360 / TIMER_DURATION_OPTIONS.length;
  const timerWheelRotation = -(timerDurationIndex * timerWheelAngle);
  const isTimeCritical = secondsLeft < 15 * 60;

  const changeTimerDuration = (direction) => {
    const nextIndex = (timerDurationIndex + direction + TIMER_DURATION_OPTIONS.length) % TIMER_DURATION_OPTIONS.length;
    setTimerDuration(TIMER_DURATION_OPTIONS[nextIndex]);
  };

  const handleTimerWheelKeyDown = (event) => {
    if (['ArrowUp', 'ArrowRight', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      changeTimerDuration(1);
    }
    if (['ArrowDown', 'ArrowLeft', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      changeTimerDuration(-1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setTimerDuration(TIMER_DURATION_OPTIONS[0]);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setTimerDuration(TIMER_DURATION_OPTIONS[TIMER_DURATION_OPTIONS.length - 1]);
    }
  };

  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    setPdfLoading(true);
    setPdfBlobUrl(null);

    if (!paper) {
      setPdfLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    if (!isCancelled) {
      setPdfBlobUrl(null);
      setPdfLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [paper?.v, paper?.n, paper?.cf]);

  // Build the PDF URL: prefer Cloudflare Pages if paper.cf is present,
  // otherwise fall back to the old THSC Online viewer so unmatched papers still work.
  const directIframeUrl = paper?.cf
    ? `https://hscportal.pages.dev/${encodeURI(paper.cf)}`
    : `https://thsconline.github.io/s/viewer.html?field=${encodeURIComponent(paper?.n ?? '')}&base=${paper?.v ?? ''}`;
  const viewUrl = pdfBlobUrl || directIframeUrl;
  const paperCategory = paper.c === 'H' ? 'Official HSC' : paper.c === 'T' ? 'School trial' : paper.c === 'A' ? 'Assessment task' : 'Resource';
  const paperAgentContext = {
    ...agentContext,
    currentPaper: {
      name: paper.n,
      subject: subjectName,
      school: schoolName,
      level: `Year ${paper.l}`,
      year: paper.y,
      category: paperCategory,
      hasSolutions: paper.w === 1,
      textStatus: paperContext.status,
      textReason: paperContext.reason,
      pagesExtracted: paperContext.pagesExtracted,
      pageStart: paperContext.pageStart,
      pageEnd: paperContext.pageEnd,
      totalPages: paperContext.totalPages,
      text: paperContext.text,
    },
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column'
    }} className="practice-surface animate-fade-in">
      
      {/* Top Header Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--bg-modifier-accent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '6px' }}
            title="Leave Practice Room"
          >
            <X size={20} />
          </button>
          
          <div>
            <div style={{ fontSize: '12px', color: 'var(--header-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Practice Mode • {subjectName}
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--header-primary)' }}>
              {paper.n}
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="practice-timer-anchor">
            <button
              type="button"
              onClick={() => setTimerPopoverOpen((open) => !open)}
              className={`practice-timer-trigger ${timerPopoverOpen ? 'is-open' : ''}`}
              aria-expanded={timerPopoverOpen}
              aria-controls="practice-exam-timer"
              title="Open exam timer"
            >
              <Clock size={16} />
              <span>Timer</span>
              <span className="practice-timer-trigger-time">{formatTime(secondsLeft)}</span>
            </button>

            <div
              id="practice-exam-timer"
              className={`practice-timer-popover ${timerPopoverOpen ? 'is-open' : ''}`}
              role="dialog"
              aria-label="Exam timer"
              aria-hidden={!timerPopoverOpen}
            >
              <div className="practice-timer-popover-header">
                <div>
                  <span className="practice-timer-eyebrow">Exam timer</span>
                  <span className={`practice-timer-status ${timerRunning ? 'is-running' : ''}`}>
                    <span aria-hidden="true" />
                    {timerRunning ? 'Running' : secondsLeft === 0 ? 'Finished' : 'Ready'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTimerPopoverOpen(false)}
                  className="practice-timer-close"
                  aria-label="Close exam timer"
                  title="Close timer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="practice-timer-duration-picker">
                <div className="practice-timer-wheel-controls">
                  <button
                    type="button"
                    onClick={() => changeTimerDuration(1)}
                    className="practice-timer-wheel-step"
                    aria-label="Increase timer duration by five minutes"
                    title="Increase duration"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <div
                    className="practice-timer-wheel-viewport"
                    role="spinbutton"
                    tabIndex={0}
                    aria-label="Timer duration"
                    aria-valuemin={5}
                    aria-valuemax={TIMER_MAX_DURATION_MINUTES}
                    aria-valuenow={timerDurationMinutes}
                    aria-valuetext={formatTimerDuration(timerDurationMinutes)}
                    onKeyDown={handleTimerWheelKeyDown}
                    onWheel={(event) => {
                      event.preventDefault();
                      changeTimerDuration(event.deltaY > 0 ? -1 : 1);
                    }}
                  >
                    <div
                      className="practice-timer-wheel"
                      style={{ '--timer-wheel-rotation': `${timerWheelRotation}deg`, '--timer-wheel-angle': `${timerWheelAngle}deg` }}
                      aria-hidden="true"
                    >
                      {TIMER_DURATION_OPTIONS.map((duration, index) => (
                        <span
                          key={duration}
                          className={`practice-timer-wheel-item ${index === timerDurationIndex ? 'is-selected' : ''}`}
                          style={{ '--timer-wheel-item-angle': `${index * timerWheelAngle}deg` }}
                        >
                          {formatTimerDuration(duration)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeTimerDuration(-1)}
                    className="practice-timer-wheel-step"
                    aria-label="Decrease timer duration by five minutes"
                    title="Decrease duration"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>

              <div className="practice-timer-controls">
                <button
                  type="button"
                  onClick={() => setTimerRunning((running) => !running)}
                  className="practice-timer-primary"
                >
                  {timerRunning ? <Pause size={17} /> : <Play size={17} />}
                  <span>{timerRunning ? 'Pause timer' : 'Start timer'}</span>
                </button>
                <div className="practice-timer-readout" aria-live="polite">
                  {formatTime(secondsLeft)}
                </div>
                <button
                  type="button"
                  onClick={() => { setTimerRunning(false); setSecondsLeft(totalSeconds); }}
                  className="practice-timer-reset"
                  title="Reset timer"
                  aria-label="Reset timer"
                >
                  <RotateCcw size={17} />
                </button>
              </div>

              {isTimeCritical && secondsLeft > 0 && (
                <div className="practice-timer-warning">Less than 15 minutes remaining</div>
              )}
            </div>
          </div>

          {sheetUrl && (
            <button
              onClick={() => setShowFormula(prev => !prev)}
              className="btn-secondary"
              style={{
                backgroundColor: showFormula ? 'var(--brand-experiment)' : 'transparent',
                color: showFormula ? 'white' : 'var(--interactive-normal)',
                borderColor: showFormula ? 'var(--brand-experiment)' : 'var(--bg-modifier-accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                fontWeight: 600,
                fontSize: '14px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Toggle Formula Sheet Split View"
            >
              <BookOpen size={16} />
              <span>{showFormula ? 'Hide Formula Sheet' : 'Formula Sheet'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPaperAgentOpen(true)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-experiment)' }}
            title="Ask AI about this open paper"
          >
            <Sparkles size={16} />
            <span>Ask AI</span>
          </button>

          {isCompleted ? (
            <button
              onClick={handleUnmarkCompleted}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Unmark completed"
            >
              <X size={16} />
              <span>Unmark Completed</span>
            </button>
          ) : (
            <button
              onClick={handleMarkCompleted}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Mark exam completed"
            >
              <Check size={16} />
              <span>Mark Completed</span>
            </button>
          )}

          {actionMessage && (
            <span className="pill subtle" style={{ padding: '6px 10px' }}>{actionMessage}</span>
          )}

        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Mobile Pane Switcher (only when formula sheet is available and shown) */}
        {showFormula && sheetUrl && (
          <div className="mobile-pane-switcher" style={{ display: 'none', background: 'var(--bg-tertiary)', padding: '8px 16px', borderBottom: '1px solid var(--bg-modifier-accent)', justifyContent: 'center', gap: '8px', zIndex: 10 }}>
            <button
              onClick={() => setMobileTab('paper')}
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                backgroundColor: mobileTab === 'paper' ? 'var(--brand-experiment)' : 'var(--bg-secondary)',
                color: mobileTab === 'paper' ? '#fff' : 'var(--text-normal)',
                fontWeight: mobileTab === 'paper' ? 600 : 400,
                border: mobileTab === 'paper' ? 'none' : '1px solid var(--bg-modifier-accent)'
              }}
            >
              Exam Paper
            </button>
            <button
              onClick={() => setMobileTab('formula')}
              className="btn-secondary"
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                backgroundColor: mobileTab === 'formula' ? 'var(--brand-experiment)' : 'var(--bg-secondary)',
                color: mobileTab === 'formula' ? '#fff' : 'var(--text-normal)',
                fontWeight: mobileTab === 'formula' ? 600 : 400,
                border: mobileTab === 'formula' ? 'none' : '1px solid var(--bg-modifier-accent)'
              }}
            >
              Formula Sheet
            </button>
          </div>
        )}

        {/* Split View Container */}
        <div className="practice-split-container" style={{
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden',
          gap: showFormula && sheetUrl ? '8px' : '0px',
          padding: showFormula && sheetUrl ? '8px' : '0',
          backgroundColor: 'var(--bg-primary)'
        }}>
          
          {/* Left: Exam Paper Panel */}
          <div className={`practice-pane practice-pane-paper ${mobileTab === 'paper' ? 'mobile-active' : 'mobile-hidden'}`} style={{
            width: showFormula && sheetUrl ? '50%' : '100%',
            flexGrow: 1,
            position: 'relative',
            transition: 'width 0.22s ease',
            borderRadius: showFormula && sheetUrl ? '8px' : '0',
            overflow: 'hidden'
          }}>
            {pdfLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                zIndex: 10,
                gap: '12px',
                color: 'var(--text-muted)'
              }}>
                <div className="animate-spin" style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--bg-modifier-accent)',
                  borderTopColor: 'var(--brand-experiment)',
                  borderRadius: '50%'
                }} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Loading exam paper...</span>
              </div>
            )}
            <iframe
              src={viewUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'var(--bg-primary)'
              }}
              title="PDF Practice Viewer"
            />
          </div>

          {/* Right: Formula Sheet Panel */}
          {showFormula && sheetUrl && (
            <div className={`practice-pane practice-pane-formula ${mobileTab === 'formula' ? 'mobile-active' : 'mobile-hidden'}`} style={{
              width: '50%',
              flexGrow: 1,
              position: 'relative',
              transition: 'width 0.22s ease',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--bg-modifier-accent)'
            }}>
              <iframe
                src={sheetUrl}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: 'var(--bg-primary)'
                }}
                title="Formula Sheet Reference"
              />
            </div>
          )}
          
        </div>

      </div>

      <AgentCommandCenter
        isOpen={isPaperAgentOpen}
        onClose={() => setIsPaperAgentOpen(false)}
        appContext={paperAgentContext}
      />
    </div>
  );
}
