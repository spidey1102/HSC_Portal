import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, ExternalLink, Edit3, BookOpen, Clock, AlertTriangle } from 'lucide-react';

export default function PracticeRoom({
  paper,
  subjectName,
  schoolName,
  onClose,
  allPapers,
  subjects,
  schools,
  onSelectPaper
}) {
  // Timer States
  const [secondsLeft, setSecondsLeft] = useState(3 * 3600); // 3 hours default
  const [totalSeconds, setTotalSeconds] = useState(3 * 3600);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerInterval = useRef(null);

  // Scratchpad State
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem(`hsc_notes_${paper.v}`) || '';
  });

  // Matching papers (e.g. guidelines or solutions for this exact exam)
  const [relatedResources, setRelatedResources] = useState([]);

  useEffect(() => {
    // Save notes to localStorage
    localStorage.setItem(`hsc_notes_${paper.v}`, notes);
  }, [notes, paper.v]);

  // Find related solutions or marking guidelines dynamically!
  useEffect(() => {
    if (!allPapers || allPapers.length === 0) return;

    // Scan for papers in the same subject, same year, but different file
    // e.g. if this is "2001 HSC", find "2001 Marking Guidelines"
    // Or if this is "Sydney Boys 2020", find another "Sydney Boys 2020 w. sol"
    const parsedYear = paper.y;
    const cleanCurrentName = paper.n.toLowerCase();
    
    const related = allPapers.filter(p => {
      // Must be same subject and year
      if (p.s !== paper.s || p.y !== paper.y || p.v === paper.v) return false;
      
      const otherName = p.n.toLowerCase();
      
      // Look for marking guidelines, solutions, or marking criteria
      const isGuideline = otherName.includes('guidelines') || otherName.includes('marking') || otherName.includes('sol');
      
      // If current paper is already a marking guideline, find the original exam!
      const currentIsGuideline = cleanCurrentName.includes('guidelines') || cleanCurrentName.includes('marking') || cleanCurrentName.includes('sol');
      
      if (currentIsGuideline) {
        return !isGuideline; // Find original exam
      } else {
        return isGuideline; // Find guidelines/solutions
      }
    });

    setRelatedResources(related.slice(0, 5));
  }, [allPapers, paper]);

  // Timer countdown logic
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

  // Format time (HH:MM:SS)
  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const setPresetTime = (hours) => {
    setSecondsLeft(hours * 3600);
    setTotalSeconds(hours * 3600);
    setTimerRunning(false);
  };

  const progressPercentage = (secondsLeft / totalSeconds) * 100;
  const isTimeCritical = secondsLeft < 15 * 60; // Less than 15 mins remaining

  // Direct URLs
  const viewUrl = `https://thsconline.github.io/s/v/${paper.v}/${encodeURIComponent(paper.n)}`;
  const directIframeUrl = `https://script.google.com/macros/s/AKfycbx69GPoJtf9sSevsUbWtPr46vpa01u4oNkHjFmkkWxmj62AZ0q-/exec?export=view&field=${encodeURIComponent(paper.n)}&base=${paper.v}`;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#040711',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column'
    }} className="animate-fade-in">
      
      {/* Header Bar */}
      <header className="glass" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        background: 'rgba(6, 9, 19, 0.9)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <X size={18} />
          </button>
          
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '700', textTransform: 'uppercase' }}>
              Practice Exam Mode • {subjectName}
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', maxWidth: '600px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={paper.n}>
              {paper.n}
            </h2>
          </div>
        </div>

        {/* Quick External Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{
              padding: '10px 16px',
              fontSize: '0.85rem',
              borderRadius: '10px',
              gap: '6px'
            }}
          >
            <span>Full Tab View</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Main Workspace split */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* PDF Frame Panel (Left 70%) */}
        <div style={{ flexGrow: 1, background: '#111422', position: 'relative' }}>
          <iframe
            src={directIframeUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#111422'
            }}
            sandbox="allow-scripts allow-popups allow-pointer-lock allow-presentation allow-same-origin allow-modals allow-top-navigation allow-downloads"
            title="PDF Practice Viewer"
          />
        </div>

        {/* Control and Study Sidebar Panel (Right 30% / 380px) */}
        <div className="glass-panel" style={{
          width: '400px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: 'none',
          borderLeft: '1px solid var(--border-color)',
          background: 'rgba(6, 9, 19, 0.95)',
          overflowY: 'auto'
        }}>
          
          {/* Timer Widget */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Clock size={16} color="var(--accent-indigo)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Practice countdown
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              padding: '20px',
              borderRadius: '16px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Progress bar boundary background */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '4px',
                width: `${progressPercentage}%`,
                background: isTimeCritical ? 'var(--danger)' : 'var(--accent-cyan)',
                boxShadow: isTimeCritical ? '0 0 10px var(--danger)' : 'none',
                transition: 'width 1s linear'
              }} />

              {/* Display Clock */}
              <h3 style={{
                fontSize: '2.5rem',
                fontFamily: 'monospace',
                fontWeight: '700',
                color: isTimeCritical ? 'var(--danger)' : 'white',
                marginBottom: '16px',
                letterSpacing: '0.05em'
              }}>
                {formatTime(secondsLeft)}
              </h3>

              {/* Time Critical Warning */}
              {isTimeCritical && secondsLeft > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--danger)',
                  fontSize: '0.75rem',
                  marginBottom: '12px',
                  fontWeight: '600'
                }} className="pulse-glow">
                  <AlertTriangle size={12} />
                  <span>Time running out! Hurry!</span>
                </div>
              )}

              {/* Controls */}
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="btn-primary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    background: timerRunning ? 'var(--warning)' : 'var(--success)',
                    boxShadow: 'none',
                    width: '100px',
                    justifyContent: 'center'
                  }}
                >
                  {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                  <span>{timerRunning ? 'Pause' : 'Start'}</span>
                </button>
                <button
                  onClick={() => { setTimerRunning(false); setSecondsLeft(totalSeconds); }}
                  className="btn-secondary"
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              </div>

              {/* Time Presets */}
              <div style={{
                display: 'flex',
                gap: '4px',
                marginTop: '16px',
                background: 'rgba(0,0,0,0.2)',
                padding: '2px',
                borderRadius: '8px',
                width: '100%'
              }}>
                {[1, 2, 3].map((hrs) => (
                  <button
                    key={hrs}
                    onClick={() => setPresetTime(hrs)}
                    style={{
                      flexGrow: 1,
                      background: totalSeconds === hrs * 3600 ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: 'none',
                      color: totalSeconds === hrs * 3600 ? 'white' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {hrs} hr
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Solutions & Guideline Links Drawer */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <BookOpen size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Exam pack / Solutions
              </span>
            </div>

            {relatedResources.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {relatedResources.map((res) => (
                  <button
                    key={res.v}
                    onClick={() => {
                      // Switch current practice exam to guidelines!
                      onSelectPaper(res);
                    }}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      borderColor: 'rgba(16, 185, 129, 0.2)',
                      background: 'rgba(16, 185, 129, 0.02)'
                    }}
                  >
                    <BookOpen size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                    <span style={{
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      color: 'var(--success)',
                      fontWeight: '600'
                    }} title={res.n}>
                      {res.n.includes('Guidelines') ? 'Marking Guidelines' : res.n}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px dashed var(--border-color)',
                padding: '16px',
                borderRadius: '10px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem'
              }}>
                No separate solutions detected. (They may be bundled inside the primary exam document).
              </div>
            )}
          </div>

          {/* Interactive Scratch pad */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Edit3 size={16} color="var(--accent-purple)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Solving Scratch pad
              </span>
            </div>
            
            <textarea
              placeholder="Record multiple-choice answers, essay outlines, or scratch calculations here... (Saved automatically)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                flexGrow: 1,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '12px 14px',
                color: 'white',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                outline: 'none',
                resize: 'none',
                fontFamily: 'monospace'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-purple)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>

        </div>

      </div>

    </div>
  );
}
