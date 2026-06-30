import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, X, ExternalLink, Edit3, BookOpen, Clock, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Share2, Sparkles, Send, Check } from 'lucide-react';
import { getPaperIdentity, getPaperStorageKey, getLegacyPaperStorageKey } from '../utils/paperIdentity';

export default function PracticeRoom({
  paper,
  subjectName,
  schoolName,
  onClose,
  allPapers,
  subjects,
  schools,
  onSharePaper,
  onSelectPaper
}) {
  const paperKey = getPaperIdentity(paper);

  const loadSavedTimerSeconds = () => {
    try {
      const raw = localStorage.getItem('hsc_timer_duration_secs');
      const secs = parseInt(raw, 10);
      if (secs >= 60 && secs <= 10 * 3600) return secs;
    } catch (e) {
      // ignore
    }
    return 3 * 3600;
  };

  const initialTimerSecs = loadSavedTimerSeconds();

  // Timer States
  const [secondsLeft, setSecondsLeft] = useState(initialTimerSecs);
  const [totalSeconds, setTotalSeconds] = useState(initialTimerSecs);
  const [customHours, setCustomHours] = useState(Math.floor(initialTimerSecs / 3600));
  const [customMinutes, setCustomMinutes] = useState(Math.floor((initialTimerSecs % 3600) / 60));
  const [timerRunning, setTimerRunning] = useState(false);
  const timerInterval = useRef(null);
  // Tools panel collapsed state (persisted)
  const [toolsCollapsed, setToolsCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem('hsc_tools_collapsed');
      return raw ? JSON.parse(raw) : false;
    } catch (e) {
      return false;
    }
  });
  // Collapsed timer state (persisted)
  const [timerCollapsed, setTimerCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem('hsc_timer_collapsed');
      return raw ? JSON.parse(raw) : false;
    } catch (e) {
      return false;
    }
  });

  // Scratchpad State
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem(getPaperStorageKey(paper, 'hsc_notes')) ||
      localStorage.getItem(getLegacyPaperStorageKey(paper, 'hsc_notes')) ||
      '';
  });

  // Formula Sheet states
  const [showFormula, setShowFormula] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiModel, setAiModel] = useState(() => {
    try {
      return localStorage.getItem('hsc_openrouter_model') || 'openrouter/free';
    } catch (e) {
      return 'openrouter/free';
    }
  });
  const [aiExcerpt, setAiExcerpt] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [extractLoading, setExtractLoading] = useState(false);

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

  // Matching papers
  const [relatedResources, setRelatedResources] = useState([]);

  useEffect(() => {
    localStorage.setItem(getPaperStorageKey(paper, 'hsc_notes'), notes);
  }, [notes, paperKey]);

  useEffect(() => {
    try {
      localStorage.setItem('hsc_openrouter_model', aiModel);
    } catch (e) {
      // ignore
    }
  }, [aiModel]);

  useEffect(() => {
    try {
      setNotes(
        localStorage.getItem(getPaperStorageKey(paper, 'hsc_notes')) ||
        localStorage.getItem(getLegacyPaperStorageKey(paper, 'hsc_notes')) ||
        ''
      );
    } catch (e) {
      setNotes('');
    }
    setAiExcerpt('');
    setAiPrompt('');
    setAiResponse('');
    setAiError('');
  }, [paperKey]);

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
    if (!allPapers || allPapers.length === 0) return;

    const cleanCurrentName = paper.n.toLowerCase();
    
    const related = allPapers.filter(p => {
      if (p.s !== paper.s || p.y !== paper.y || getPaperIdentity(p) === paperKey) return false;
      
      const otherName = p.n.toLowerCase();
      const isGuideline = otherName.includes('guidelines') || otherName.includes('marking') || otherName.includes('sol');
      const currentIsGuideline = cleanCurrentName.includes('guidelines') || cleanCurrentName.includes('marking') || cleanCurrentName.includes('sol');
      
      if (currentIsGuideline) {
        return !isGuideline;
      } else {
        return isGuideline;
      }
    });

    setRelatedResources(related.slice(0, 5));
  }, [allPapers, paper, paperKey]);

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

  useEffect(() => {
    try {
      localStorage.setItem('hsc_timer_collapsed', JSON.stringify(timerCollapsed));
    } catch (e) {
      // ignore
    }
  }, [timerCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('hsc_tools_collapsed', JSON.stringify(toolsCollapsed));
    } catch (e) {
      // ignore
    }
  }, [toolsCollapsed]);

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const applyCustomTimer = () => {
    const hrs = Math.min(10, Math.max(0, parseInt(String(customHours), 10) || 0));
    const mins = Math.min(59, Math.max(0, parseInt(String(customMinutes), 10) || 0));
    let total = hrs * 3600 + mins * 60;
    if (total < 60) total = 60;

    setSecondsLeft(total);
    setTotalSeconds(total);
    setTimerRunning(false);
    setCustomHours(Math.floor(total / 3600));
    setCustomMinutes(Math.floor((total % 3600) / 60));

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
      try { window.dispatchEvent(new CustomEvent('hsc:history-updated')); } catch (e) {}
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
      try { window.dispatchEvent(new CustomEvent('hsc:history-updated')); } catch (e) {}
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    } catch (e) {
      setActionMessage('Failed to update');
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => setActionMessage(''), 1800);
    }
  };

  const progressPercentage = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const isTimeCritical = secondsLeft < 15 * 60;

  const compactText = (value, limit = 2400) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (trimmed.length <= limit) return trimmed;
    return `${trimmed.slice(0, limit)}...`;
  };

  const buildStudyContext = () => {
    const resourceList = relatedResources.length > 0
      ? relatedResources.map((res) => res.n.includes('Guidelines') ? 'Marking Guidelines' : res.n).join(', ')
      : 'No closely related resources were detected.';

    const excerptBlock = compactText(aiExcerpt || '', 1200);
    const noteBlock = compactText(notes || '', 2400);

    return [
      `Paper title: ${paper.n}`,
      `Subject: ${subjectName || 'Unknown'}`,
      `School/resource group: ${schoolName || 'Unknown'}`,
      `Paper ID: ${paper.v}`,
      `Related resources: ${resourceList}`,
      excerptBlock ? `Highlighted excerpt:\n${excerptBlock}` : 'Highlighted excerpt: none provided.',
      noteBlock ? `Student notes:\n${noteBlock}` : 'Student notes: none yet.',
    ].join('\n');
  };

  const runStudyAssistant = async (promptText) => {
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) {
      setAiError('Type a question first.');
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiResponse('');

    try {
      const response = await fetch('/api/openrouter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiModel.trim() || 'openai/gpt-oss-120b:free',
          prompt: cleanPrompt,
          context: buildStudyContext(),
          max_tokens: 700,
          temperature: 0.4,
        }),
      });

      const raw = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(raw);
      } catch (e) {
        // ignore parse failure
      }

      if (!response.ok) {
        const message = payload?.error || raw || `Request failed with status ${response.status}.`;
        throw new Error(message);
      }

      const answer = payload?.answer?.trim();
      if (!answer) {
        throw new Error('No response came back from OpenRouter.');
      }

      setAiResponse(answer);
    } catch (error) {
      setAiError(error?.message || 'Something went wrong while contacting OpenRouter.');
    } finally {
      setAiLoading(false);
    }
  };

  const loadExtractedQuestions = async () => {
    setExtractLoading(true);
    setAiError('');
    try {
      const resp = await fetch(`/api/agent/extract?paperId=${encodeURIComponent(paper.v)}`);
      const text = await resp.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch (e) { payload = null; }
      if (!resp.ok) {
        throw new Error(payload?.error || text || `Request failed with status ${resp.status}`);
      }
      const questions = (payload && payload.questions) || [];
      setExtractedQuestions(questions);
      if (!questions.length) setAiError('No questions were extracted for this paper.');
    } catch (error) {
      setAiError(error?.message || 'Failed to extract questions.');
    } finally {
      setExtractLoading(false);
    }
  };

  const runAgentAsk = async (questionId, promptOverride) => {
    setAiLoading(true);
    setAiError('');
    setAiResponse('');
    try {
      const payload = {
        paperId: paper.v,
        questionId,
        prompt: (promptOverride || aiPrompt || 'Explain this question in simple steps.'),
      };

      const resp = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let body = null;
      try { body = JSON.parse(text); } catch (e) { body = null; }
      if (!resp.ok) throw new Error(body?.error || text || `Request failed (${resp.status})`);
      const answer = (body && (body.answer || body.result || body.output)) || text;
      setAiResponse(String(answer));
    } catch (error) {
      setAiError(error?.message || 'Agent ask failed.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load extracted questions whenever a different paper is opened
    if (paper && paper.v) {
      loadExtractedQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.v]);

  const useClipboardExcerpt = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setAiError('Clipboard access is not available in this browser.');
        return;
      }

      const copied = await navigator.clipboard.readText();
      if (!copied.trim()) {
        setAiError('Your clipboard is empty.');
        return;
      }

      setAiExcerpt(copied.trim());
      setAiError('');
    } catch (error) {
      setAiError(error?.message || 'Could not read the clipboard.');
    }
  };

  const viewUrl = `https://thsconline.github.io/s/v/${paper.v}/${encodeURIComponent(paper.n)}`;
  const directIframeUrl = `https://script.google.com/macros/s/AKfycbx69GPoJtf9sSevsUbWtPr46vpa01u4oNkHjFmkkWxmj62AZ0q-/exec?export=view&field=${encodeURIComponent(paper.n)}&base=${paper.v}`;

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
          <button
            onClick={onSharePaper}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Share this test"
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>

          <button
            onClick={() => setAiOpen(prev => !prev)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            title={aiOpen ? 'Hide study helper' : 'Show study helper'}
          >
            <Sparkles size={16} />
            <span>Study AI</span>
          </button>

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

          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            <span>Open in Browser</span>
            <ExternalLink size={16} />
          </a>

          <button
            onClick={() => setToolsCollapsed(s => !s)}
            className="btn-secondary"
            title={toolsCollapsed ? 'Show tools panel' : 'Hide tools panel'}
            style={{ padding: '6px' }}
            aria-expanded={!toolsCollapsed}
          >
            {toolsCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        
        {/* Split View Container */}
        <div style={{
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden',
          gap: showFormula && sheetUrl ? '8px' : '0px',
          padding: showFormula && sheetUrl ? '8px' : '0',
          backgroundColor: 'var(--bg-primary)'
        }}>
          
          {/* Left: Exam Paper Panel */}
          <div style={{
            width: showFormula && sheetUrl ? '50%' : '100%',
            height: '100%',
            position: 'relative',
            transition: 'width 0.22s ease',
            borderRadius: showFormula && sheetUrl ? '8px' : '0',
            overflow: 'hidden'
          }}>
            <iframe
              src={directIframeUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: 'var(--bg-primary)'
              }}
              sandbox="allow-scripts allow-popups allow-pointer-lock allow-presentation allow-same-origin allow-modals allow-top-navigation allow-downloads"
              title="PDF Practice Viewer"
            />
          </div>

          {/* Right: Formula Sheet Panel */}
          {showFormula && sheetUrl && (
            <div style={{
              width: '50%',
              height: '100%',
              position: 'relative',
              transition: 'width 0.22s ease',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--bg-modifier-accent)'
            }}>
              <iframe
                src={sheetUrl}
                style={{
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

        {/* Tools panel */}
        <div
          className={`tools-panel ${toolsCollapsed ? 'collapsed' : ''}`}
          style={{
            width: toolsCollapsed ? '0px' : '350px',
            minWidth: toolsCollapsed ? '0px' : '350px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: toolsCollapsed ? 'none' : '1px solid var(--bg-modifier-accent)',
            overflow: 'hidden',
            transition: 'width 0.22s ease, min-width 0.22s ease, transform 0.22s ease'
          }}
          aria-hidden={toolsCollapsed}
        >
          
          {/* Study AI */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--bg-modifier-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aiOpen ? '12px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--header-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                <Sparkles size={16} />
                <span>Doubt Clarifier</span>
              </div>

              <button
                onClick={() => setAiOpen(prev => !prev)}
                className="btn-secondary"
                title={aiOpen ? 'Hide study helper' : 'Show study helper'}
                style={{ padding: '6px 8px' }}
              >
                {aiOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>

            {!aiOpen ? (
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '10px 12px',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                lineHeight: 1.45
              }}>
                Paste a copied highlight or type your doubt. The assistant will explain the excerpt plainly.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Model
                  </span>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="discord-input"
                    placeholder="openai/gpt-oss-120b:free"
                    autoComplete="off"
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Highlight or excerpt
                  </span>
                  <textarea
                    value={aiExcerpt}
                    onChange={(e) => setAiExcerpt(e.target.value)}
                    className="discord-input"
                    placeholder="Paste the highlighted text here if you copied it from the paper..."
                    rows={4}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      minHeight: '92px',
                      fontSize: '13px',
                      lineHeight: 1.45
                    }}
                  />
                </label>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => {
                      const prompt = 'Explain the highlighted excerpt in simple words and focus only on what it means.';
                      setAiPrompt(prompt);
                      runStudyAssistant(prompt);
                    }}
                  >
                    Explain excerpt
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => {
                      const prompt = 'Turn the highlighted excerpt into a clear study note and point out the main idea, definition, or method.';
                      setAiPrompt(prompt);
                      runStudyAssistant(prompt);
                    }}
                  >
                    Simplify it
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => {
                      const prompt = 'Ask me one short question about the highlighted excerpt at a time and wait for my answer.';
                      setAiPrompt(prompt);
                      runStudyAssistant(prompt);
                    }}
                  >
                    Quiz me
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={useClipboardExcerpt}
                  >
                    Use clipboard
                  </button>
                </div>

                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="discord-input"
                  placeholder="Ask a doubt about the excerpt or tell the assistant what you want explained..."
                  rows={4}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '92px',
                    fontSize: '13px',
                    lineHeight: 1.45
                  }}
                />
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--header-secondary)' }}>Extracted Questions</div>
                    <div>
                      <button
                        type="button"
                        onClick={loadExtractedQuestions}
                        className="btn-secondary"
                        disabled={extractLoading}
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      >
                        {extractLoading ? 'Loading...' : 'Load questions'}
                      </button>
                    </div>
                  </div>

                  {extractedQuestions.length > 0 ? (
                    <div style={{ marginTop: '8px', maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {extractedQuestions.map((q, idx) => (
                        <div key={q.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-normal)', whiteSpace: 'pre-wrap' }}>{q.text}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => { setAiExcerpt(q.text); setAiPrompt('Explain this question in simple steps.'); }}
                              style={{ padding: '6px 8px', fontSize: '12px' }}
                            >
                              Set excerpt
                            </button>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => runAgentAsk(q.id || idx)}
                              disabled={aiLoading}
                              style={{ padding: '6px 8px', fontSize: '12px' }}
                            >
                              {aiLoading ? 'Asking...' : 'Ask AI'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>No extracted questions yet.</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => runStudyAssistant(aiPrompt)}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    disabled={aiLoading}
                  >
                    <Send size={16} />
                    <span>{aiLoading ? 'Asking...' : 'Ask AI'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiPrompt('');
                      setAiResponse('');
                      setAiError('');
                    }}
                    className="btn-secondary"
                  >
                    Clear
                  </button>
                </div>

                {aiError && (
                  <div style={{
                    backgroundColor: 'rgba(163,61,61,0.08)',
                    border: '1px solid rgba(163,61,61,0.16)',
                    color: 'var(--header-primary)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: 1.45
                  }}>
                    {aiError}
                  </div>
                )}

                {aiResponse && (
                  <div style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--bg-modifier-accent)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-normal)',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    {aiResponse}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timer Widget */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--bg-modifier-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--header-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                <Clock size={16} />
                <span>Exam Timer</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setTimerCollapsed(prev => !prev)}
                  className="btn-secondary"
                  aria-expanded={!timerCollapsed}
                  title={timerCollapsed ? 'Show timer' : 'Collapse timer'}
                  style={{ padding: '6px 8px' }}
                >
                  {timerCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>
            </div>

            {timerCollapsed ? (
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '18px', color: isTimeCritical ? 'var(--status-danger)' : 'var(--header-primary)' }}>
                  {formatTime(secondsLeft)}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    className="btn-primary"
                    style={{ padding: '6px 8px', minWidth: '44px' }}
                  >
                    {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                  </button>

                  <button
                    onClick={() => { setTimerRunning(false); setSecondsLeft(totalSeconds); }}
                    className="btn-secondary"
                    style={{ padding: '6px 8px' }}
                  >
                    <RotateCcw size={14} />
                  </button>

                  <button
                    onClick={() => setTimerCollapsed(false)}
                    className="btn-secondary"
                    title="Expand timer"
                    style={{ padding: '6px 8px' }}
                  >
                    <ChevronUp size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '16px',
                borderRadius: '8px',
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
                  backgroundColor: isTimeCritical ? 'var(--status-danger)' : 'var(--brand-experiment)',
                  transition: 'width 1s linear'
                }} />

                {/* Display Clock */}
                <h3 style={{
                  fontSize: '32px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: isTimeCritical ? 'var(--status-danger)' : 'var(--header-primary)',
                  textAlign: 'center',
                  marginBottom: '12px'
                }}>
                  {formatTime(secondsLeft)}
                </h3>

                {/* Time Critical Warning */}
                {isTimeCritical && secondsLeft > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: 'var(--status-danger)',
                    fontSize: '12px',
                    marginBottom: '12px',
                    fontWeight: 600
                  }}>
                    <AlertTriangle size={14} />
                    <span>Time is almost up!</span>
                  </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    className="btn-primary"
                    style={{
                      backgroundColor: timerRunning ? 'var(--status-warning)' : 'var(--status-positive)',
                      color: timerRunning ? 'black' : 'white',
                      flex: 1,
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                    <span>{timerRunning ? 'Pause' : 'Start'}</span>
                  </button>
                  <button
                    onClick={() => { setTimerRunning(false); setSecondsLeft(totalSeconds); }}
                    className="btn-secondary"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Custom duration */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--header-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}>
                    Set duration
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-primary)',
                    padding: '8px',
                    borderRadius: '4px',
                  }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Hours</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyCustomTimer()}
                        className="timer-duration-input"
                        aria-label="Timer hours"
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Minutes</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyCustomTimer()}
                        className="timer-duration-input"
                        aria-label="Timer minutes"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={applyCustomTimer}
                      className="btn-primary"
                      style={{
                        alignSelf: 'flex-end',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
                    Your last duration is remembered for next time (min 1 minute).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Solutions Links */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--bg-modifier-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--header-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
              <BookOpen size={16} />
              <span>Related Resources</span>
            </div>

            {relatedResources.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {relatedResources.map((res) => (
                  <button
                    key={res.v}
                    onClick={() => onSelectPaper(res)}
                    className="btn-secondary"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      backgroundColor: 'transparent',
                      color: 'var(--status-positive)'
                    }}
                  >
                    <BookOpen size={16} style={{ flexShrink: 0 }} />
                    <span style={{
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {res.n.includes('Guidelines') ? 'Marking Guidelines' : res.n}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '12px',
                borderRadius: '4px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                No separate solutions detected.
              </div>
            )}
          </div>

          {/* Scratch pad */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--header-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
              <Edit3 size={16} />
              <span>Scratchpad</span>
            </div>
            
            <textarea
              placeholder="Jot down notes, answers, or calculations here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="discord-input"
              style={{
                width: '100%',
                flexGrow: 1,
                resize: 'none',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
