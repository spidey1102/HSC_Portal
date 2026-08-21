import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CornerDownRight, Feather, Loader2, X } from 'lucide-react';

import { runAgent } from '../../utils/agentHarness';
import { buildWeakSpots } from '../../utils/practiceLadder';
import { getPaperIdentity } from '../../utils/paperIdentity';
import {
  clearConversation,
  getPaperMarginConversationScope,
  loadConversation,
  saveConversation,
} from '../../utils/agentConversation';
import { usePresence } from '../../utils/usePresence';

// AI answers may use either LaTeX delimiters (\\(...\\), \\[...\\]) or the
// dollar delimiters understood by remark-math. Normalise the former before the
// Markdown pipeline parses and renders expressions with KaTeX.
function normaliseMathDelimiters(content) {
  return String(content || '')
    .replace(/\\\[(.*?)\\\]/gs, (_, math) => `$$${math}$$`)
    .replace(/\\\((.*?)\\\)/gs, (_, math) => `$${math}$`);
}

/**
 * Suggested questions, built from this paper and this student rather than a
 * fixed list. A prompt that names your own weakest topic is worth reading; a
 * generic "summarise this document" is not.
 */
function buildPrompts({ paper, subjectName, ladderEntry, mistakes }) {
  const prompts = [];
  const weak = buildWeakSpots(mistakes.filter((entry) => entry.subjectName === subjectName), 1)[0];

  if (weak) prompts.push(`Why do I keep losing marks on ${weak.topic.toLowerCase()}?`);
  if (paper?.w === 1) prompts.push('Mark my working against the solutions');
  else prompts.push('What is this question actually testing?');

  prompts.push(`Which ${subjectName || 'course'} topics have I never been examined on?`);

  if (ladderEntry) {
    const rung = ladderEntry.rung;
    prompts.push(rung >= 4
      ? `Should I drop to −10% for the next ${subjectName} paper?`
      : `What do I need to hit to move off rung ${rung}?`);
  } else {
    prompts.push('Compare my marks across my recent sittings');
  }

  return prompts.slice(0, 4);
}

/**
 * The margin.
 *
 * Not a chat window: a column of marginalia beside the paper, in the same type
 * as the paper. One exchange at a time, the answer set as justified prose, and
 * a ruled ledger of anything the agent actually did — so an action taken on
 * your behalf is visible and undoable rather than buried in a transcript.
 */
export default function PaperMargin({
  isOpen,
  onClose,
  paper,
  subjectName,
  appContext,
  quotedText = '',
  onQuoteConsumed,
}) {
  const conversationScope = useMemo(
    () => getPaperMarginConversationScope(getPaperIdentity(paper)),
    [paper],
  );
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState(() => loadConversation(conversationScope));
  const [ledger, setLedger] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const presence = usePresence(isOpen, 260);

  const ladderEntry = useMemo(
    () => (appContext.ladder || []).find((entry) => entry.subject === subjectName) || null,
    [appContext.ladder, subjectName],
  );

  const prompts = useMemo(
    () => buildPrompts({ paper, subjectName, ladderEntry, mistakes: appContext.mistakes || [] }),
    [paper, subjectName, ladderEntry, appContext.mistakes],
  );

  useEffect(() => {
    setConversation(loadConversation(conversationScope));
    setQuestion('');
    setLedger([]);
    setErrorMessage('');
  }, [conversationScope]);

  useEffect(() => {
    saveConversation(conversationScope, conversation);
  }, [conversationScope, conversation]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Text selected on the page arrives here as the subject of the next question,
  // so "ask about this" lands with the passage already quoted.
  useEffect(() => {
    if (!isOpen || !quotedText) return;
    setQuestion((current) => (current ? current : `About this passage:\n\n“${quotedText}”\n\n`));
    onQuoteConsumed?.();
    window.setTimeout(() => {
      const field = inputRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }, 90);
  }, [isOpen, quotedText, onQuoteConsumed]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const ask = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || status === 'running') return;

    const priorConversation = conversation;
    setQuestion('');
    setConversation((current) => [...current, { role: 'user', content: trimmed }]);
    setLedger([]);
    setErrorMessage('');

    setStatus('running');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runAgent(trimmed, appContext, {
        signal: controller.signal,
        history: priorConversation,
        onStep: (step) => {
          // Only completed actions reach the ledger; thinking is not an action.
          if (step.type === 'tool_result') {
            setLedger((current) => [...current, step.label]);
          }
        },
      });
      setConversation((current) => [...current, { role: 'assistant', content: result.answer }]);
      setStatus('idle');
    } catch (error) {
      if (error.name !== 'AbortError') {
        setErrorMessage(error.message || 'The agent could not answer.');
        setStatus('idle');
      }
    } finally {
      abortRef.current = null;
    }
  }, [appContext, conversation, status]);

  const clearHistory = useCallback(() => {
    clearConversation(conversationScope);
    setConversation([]);
    setLedger([]);
    setErrorMessage('');
  }, [conversationScope]);

  if (!presence.mounted) return null;

  return (
    <aside className={`margin-drawer is-${presence.stage}`} role="complementary" aria-label="Ask AI about this paper">
      <div className="margin-head">
        <div>
          <div className="kick">In the margin</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '21px' }}>Ask AI</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-accent)', display: 'flex' }}><Feather size={15} /></span>
          {conversation.length > 0 && (
            <button type="button" className="tool-btn" onClick={clearHistory} aria-label="Clear margin conversation" title="Clear conversation">
              Clear
            </button>
          )}
          <button type="button" className="tool-btn" onClick={onClose} aria-label="Close the margin">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="margin-scroll">
        {conversation.length === 0 && (
          <p className="dim" style={{ fontSize: '13px' }}>
            {paper?.n}{subjectName ? ` · ${subjectName}` : ''}
            {ladderEntry ? ` · rung ${ladderEntry.rung} of 5, ${ladderEntry.allowance.label.toLowerCase()}` : ''}.
            {' '}The paper's own text is supplied where it can be read, so questions about a specific
            question work.
          </p>
        )}

        {conversation.map((message, index) => (
          <div key={`${message.role}-${index}`} style={{ marginBottom: message.role === 'assistant' ? '18px' : '10px' }}>
            <div className="margin-said">{message.role === 'user' ? 'You asked' : 'AI response'}</div>
            {message.role === 'assistant' ? (
              <div className="margin-prose agent-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {normaliseMathDelimiters(message.content)}
                </ReactMarkdown>
              </div>
            ) : (
              <p style={{ fontSize: '14px', margin: '4px 0 0' }}>{message.content}</p>
            )}
          </div>
        ))}

        {status === 'running' && (
          <p className="dim" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <Loader2 size={14} className="spin" />
            Reading the paper…
          </p>
        )}

        {errorMessage && (
          <p style={{ fontSize: '13px', color: 'var(--status-danger)' }}>{errorMessage}</p>
        )}

        {ledger.length > 0 && (
          <div className="margin-ledger">
            <div className="kick" style={{ marginBottom: '6px' }}>Done for you</div>
            {ledger.map((entry, index) => (
              <div key={`${entry}-${index}`} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '12.5px', padding: '3px 0' }}>
                <span style={{ color: 'var(--color-accent)', display: 'flex' }}><CornerDownRight size={13} /></span>
                <span style={{ flex: 1 }}>{entry}</span>
              </div>
            ))}
          </div>
        )}

        <div className="kick" style={{ margin: '18px 0 8px' }}>Or ask</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="btn btn-ghost margin-prompt"
              onClick={() => ask(prompt)}
              disabled={status === 'running'}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="margin-foot">
        <textarea
          ref={inputRef}
          className="input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              ask(question);
            }
          }}
          placeholder="Ask about a question, a topic, or your marks…"
          style={{ minHeight: '64px', fontSize: '13.5px' }}
          aria-label="Ask about this paper"
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 'none' }}
          onClick={() => ask(question)}
          disabled={!question.trim() || status === 'running'}
        >
          Ask
        </button>
      </div>
    </aside>
  );
}
