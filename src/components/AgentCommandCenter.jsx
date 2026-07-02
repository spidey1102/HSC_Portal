import { useState, useRef, useEffect, useCallback } from 'react';
import { runAgent } from '../utils/agentHarness.js';

// ─── Icons (inline SVG to avoid extra dependencies) ───────────────────────────

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
  </svg>
);

const IconStop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const IconSparkle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
  </svg>
);

const IconClear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Step type configs ─────────────────────────────────────────────────────────

const STEP_CONFIG = {
  thinking: { icon: '🧠', className: 'agent-step-thinking' },
  tool_call: { icon: '⚡', className: 'agent-step-tool-call' },
  tool_result: { icon: '✓', className: 'agent-step-tool-result' },
  answer: { icon: '💬', className: 'agent-step-answer' },
  error: { icon: '⚠', className: 'agent-step-error' },
};

// ─── Step Component ────────────────────────────────────────────────────────────

function AgentStep({ step, isLast }) {
  const config = STEP_CONFIG[step.type] || { icon: '•', className: '' };
  return (
    <div className={`agent-step ${config.className} ${isLast && step.type === 'thinking' ? 'agent-step-pulse' : ''}`}>
      <span className="agent-step-icon">{config.icon}</span>
      <span className="agent-step-label">{step.label}</span>
    </div>
  );
}

// ─── Suggestion Pills ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Find 2023 Chemistry trials with solutions',
  'Show my bookmarks',
  'Add a Physics study session for next Monday',
  'What are my study stats?',
  'Find recent Maths Ext 2 papers',
];

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * AgentCommandCenter
 *
 * A premium chat-style interface for the agentic AI harness.
 * Props:
 *   - appContext: { papers, subjects, schools, bookmarks, toggleBookmark, addCalendarEvent, selectedLevel }
 *   - isOpen: boolean
 *   - onClose: function
 */
export default function AgentCommandCenter({ appContext, isOpen, onClose }) {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [steps, setSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  // Auto-scroll to latest step
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (query) => {
    const trimmed = (query || input).trim();
    if (!trimmed || isRunning) return;

    setConversation((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setSteps([{ type: 'thinking', label: 'Starting agent…' }]);
    setIsRunning(true);
    setHasRun(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runAgent(trimmed, appContext, {
        signal: controller.signal,
        onStep: (step) => {
          setSteps((prev) => {
            // Replace the last "thinking" step if this is a non-thinking step (avoid doubles)
            const last = prev[prev.length - 1];
            if (last?.type === 'thinking' && step.type !== 'thinking') {
              return [...prev.slice(0, -1), step];
            }
            // Replace the last "thinking" step with the new one (only show one at a time)
            if (last?.type === 'thinking' && step.type === 'thinking') {
              return [...prev.slice(0, -1), step];
            }
            return [...prev, step];
          });
        },
      });

      setConversation((prev) => [...prev, { role: 'assistant', content: result.answer }]);
      setSteps([]);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setConversation((prev) => [...prev, { role: 'error', content: err.message || 'Something went wrong.' }]);
        setSteps((prev) => [
          ...prev.filter((s) => s.type !== 'thinking'),
          { type: 'error', label: err.message || 'Something went wrong.' },
        ]);
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [input, isRunning, appContext]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setSteps((prev) => [
      ...prev.filter((s) => s.type !== 'thinking'),
      { type: 'error', label: 'Stopped by user.' },
    ]);
  };

  const handleClear = () => {
    setConversation([]);
    setSteps([]);
    setHasRun(false);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  const hasError = steps.some((s) => s.type === 'error');
  const lastStepIdx = steps.length - 1;
  const hasConversation = conversation.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="agent-backdrop"
        onClick={onClose}
        aria-label="Close Agent"
        role="button"
        tabIndex={-1}
      />

      {/* Panel */}
      <div className="agent-panel" role="dialog" aria-modal="true" aria-label="AI Agent Command Center">
        {/* Header */}
        <div className="agent-header">
          <div className="agent-header-title">
            <span className="agent-sparkle-icon"><IconSparkle /></span>
            <div>
              <div className="agent-title">AI Agent</div>
              <div className="agent-subtitle">Ask me to search, bookmark, or schedule</div>
            </div>
          </div>
          <div className="agent-header-actions">
            {hasRun && (
              <button className="agent-action-btn" onClick={handleClear} title="Clear conversation" aria-label="Clear">
                <IconClear />
                <span>Clear</span>
              </button>
            )}
            <button className="agent-close-btn" onClick={onClose} aria-label="Close">
              <IconClear />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="agent-body">
          {/* Conversation History */}
          {hasConversation ? (
            <div className="agent-log" ref={logRef}>
              <div className="agent-chat-history">
                {conversation.map((message, idx) => (
                  <div
                    key={`${message.role}-${idx}`}
                    className={`agent-message agent-message-${message.role}`}
                  >
                    <div className="agent-message-label">
                      {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI Agent' : 'Error'}
                    </div>
                    <div className="agent-message-bubble">
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>

              {isRunning && steps.length > 0 && (
                <div className="agent-log-steps">
                  {steps.map((step, idx) => (
                    <AgentStep
                      key={idx}
                      step={step}
                      isLast={idx === lastStepIdx}
                    />
                  ))}
                </div>
              )}

              {hasError && !isRunning && (
                <div className="agent-error-notice">
                  <span>⚠</span>
                  <span>{steps.find(s => s.type === 'error')?.label}</span>
                </div>
              )}
            </div>
          ) : (
            /* Empty state — suggestions */
            <div className="agent-empty">
              <div className="agent-empty-icon"><IconSparkle /></div>
              <p className="agent-empty-title">What can I help with?</p>
              <p className="agent-empty-sub">I can search papers, manage bookmarks, and add calendar events.</p>
              <div className="agent-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="agent-suggestion-pill"
                    onClick={() => handleSubmit(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="agent-input-area">
          <textarea
            ref={inputRef}
            id="agent-command-input"
            className="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything…"
            rows={1}
            disabled={isRunning}
            aria-label="Agent command input"
          />
          <div className="agent-input-actions">
            {isRunning ? (
              <button
                className="agent-stop-btn"
                onClick={handleStop}
                title="Stop agent"
                aria-label="Stop"
              >
                <IconStop />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="agent-send-btn"
                onClick={() => handleSubmit()}
                disabled={!input.trim()}
                title="Send"
                aria-label="Send"
              >
                <IconSend />
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="agent-footer-note">
          Powered by OpenRouter · Actions run locally in your browser
        </div>
      </div>
    </>
  );
}
