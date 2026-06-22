import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, FileText, Globe, Loader2, Maximize2, PanelRightClose, Send, Sparkles, Trash2, Wrench } from 'lucide-react';

const STORAGE_KEY = 'hsc_global_agent_chats_v1';
const SIZE_KEY = 'hsc_global_agent_size_v1';

const starter = { id: 'welcome', role: 'assistant', content: 'Ask me about past papers, revision choices, or the paper you are viewing. I can inspect the site paper list, use current paper context, and request web search when useful.', tools: [] };

export default function GlobalStudyAgent({ papers = [], subjects = [], schools = [], currentPaper = null, currentNotes = '' }) {
  const [open, setOpen] = useState(() => localStorage.getItem('hsc_global_agent_open') !== 'false');
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [starter]; } catch { return [starter]; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [size, setSize] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SIZE_KEY)) || { width: 420, height: 600 }; } catch { return { width: 420, height: 600 }; }
  });
  const resizeRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80))); }, [messages]);
  useEffect(() => { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); }, [size]);
  useEffect(() => { localStorage.setItem('hsc_global_agent_open', String(open)); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading, open]);

  const paperSummary = useMemo(() => papers.slice(0, 1200).map((p) => ({ id: p.v, name: p.n, subject: subjects[p.s], school: schools[p.h], year: p.y, level: p.l, type: p.c, solved: p.w === 1 })), [papers, subjects, schools]);

  const difficulty = (text) => {
    const t = text.toLowerCase();
    let score = text.length > 180 ? 1 : 0;
    if (/compare|best|recommend|rank|strategy|explain|analyse|analyze|web|latest|current|hard|difficult/.test(t)) score += 1;
    if (/paper|papers|trial|hsc|marking|solution/.test(t)) score += 1;
    return score >= 2 ? 'deep' : 'quick';
  };

  const send = async (override) => {
    const text = String(override || input).trim();
    if (!text || loading) return;
    const userMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setLoading(true);
    setStatus(difficulty(text) === 'deep' ? 'Thinking through paper metadata and deciding tools' : 'Generating');
    try {
      const res = await fetch('/api/openrouter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'agent', prompt: text, messages: [...messages, userMessage].slice(-12),
          context: JSON.stringify({ currentPaper, currentNotes, papers: paperSummary, subjects, schools }).slice(0, 30000),
          max_tokens: 1100, temperature: 0.35,
        }),
      });
      const raw = await res.text();
      const payload = JSON.parse(raw || '{}');
      if (!res.ok) throw new Error(payload.error || raw || 'Agent request failed.');
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: payload.answer, tools: payload.tools || [], thinking: payload.thinking || '' }]);
    } catch (error) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: error?.message || 'The agent could not respond.', tools: [] }]);
    } finally {
      setLoading(false); setStatus('');
    }
  };

  const startResize = (event) => {
    resizeRef.current = { x: event.clientX, y: event.clientY, width: size.width, height: size.height };
    const move = (e) => {
      const start = resizeRef.current;
      if (!start) return;
      setSize({ width: Math.min(760, Math.max(340, start.width - (e.clientX - start.x))), height: Math.min(window.innerHeight - 40, Math.max(420, start.height - (e.clientY - start.y))) });
    };
    const up = () => { resizeRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  if (!open) return <button className="global-agent-bubble" onClick={() => setOpen(true)}><Sparkles size={18} /><span>AI</span></button>;

  return (
    <section className="global-agent-panel animate-slide-up" style={{ width: size.width, height: size.height }}>
      <button className="agent-resize-handle" onPointerDown={startResize} title="Resize"><Maximize2 size={13} /></button>
      <header className="global-agent-header">
        <div className="agent-avatar"><Bot size={18} /></div><div><strong>HSC Agent</strong><span>Global paper assistant</span></div>
        <button onClick={() => setMessages([starter])} title="Clear chat"><Trash2 size={15} /></button>
        <button onClick={() => setOpen(false)} title="Collapse"><PanelRightClose size={16} /></button>
      </header>
      <div className="agent-tool-rail"><span><FileText size={13} /> Paper reader</span><span><Wrench size={13} /> Site index</span><span><Globe size={13} /> Web search</span></div>
      <div className="global-agent-messages">
        {messages.map((m) => <div key={m.id} className={`agent-message ${m.role}`}>
          {m.thinking && <details className="agent-thinking"><summary><ChevronDown size={13} /> Thinking</summary>{m.thinking}</details>}
          {m.tools?.length > 0 && <div className="agent-tool-calls">{m.tools.map((t, i) => <span key={i}><Wrench size={12} /> {t}</span>)}</div>}
          <div>{m.content}</div>
        </div>)}
        {loading && <div className="agent-message assistant is-loading"><div className="shine-line" /><Loader2 className="spin" size={15} /> {status || 'Generating'}</div>}
        <div ref={bottomRef} />
      </div>
      <div className="agent-quick-row"><button onClick={() => send('Which papers should I practise next and why?')}>Recommend</button><button onClick={() => send('Find papers with solutions for my current subject.')}>Find solved</button></div>
      <form className="global-agent-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about papers, difficulty, or this exam..." rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button disabled={loading || !input.trim()}><Send size={16} /></button>
      </form>
    </section>
  );
}
