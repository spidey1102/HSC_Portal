import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Check, ChevronDown, CircleAlert, Database, FileSearch, LockKeyhole, Play, Search, ShieldCheck, Square, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getDaily } from '../utils/dailyApi';
import { analysePaperMetadata, getPaperMetadata } from '../utils/paperMetadata';
import { getPaperIdentity } from '../utils/paperIdentity';
import { normalisePaperCategories } from '../utils/normalisePaperCategory';
import './OwnerAdminPanel.css';

const PAGE_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const CATEGORY_LABELS = { T: 'Trial', A: 'Assessment', H: 'HSC', O: 'Resource' };
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function paperKey(paper) {
  return getPaperIdentity(paper);
}

function paperTitle(paper) {
  return paper.n || 'Untitled paper';
}

export default function OwnerAdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [papers, setPapers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(() => new Set());
  const [runItems, setRunItems] = useState({});
  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [runNotice, setRunNotice] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    let active = true;
    setRole(null);
    setRoleChecked(false);
    if (!user) {
      setRoleChecked(!authLoading);
      return () => { active = false; };
    }
    getDaily(user, '?scope=identity')
      .then((identity) => {
        if (active) setRole(identity?.role || null);
      })
      .catch(() => {
        if (active) setRole(null);
      })
      .finally(() => {
        if (active) setRoleChecked(true);
      });
    return () => { active = false; };
  }, [user, authLoading]);

  useEffect(() => {
    if (!open || role !== 'owner' || papers.length) return undefined;
    let active = true;
    setPaperLoading(true);
    setPaperError('');
    fetch('/papers.json')
      .then((response) => {
        if (!response.ok) throw new Error('The paper library could not be loaded.');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setPapers(normalisePaperCategories(data.papers || []));
        setSubjects(data.subjects || []);
        setSchools(data.schools || []);
      })
      .catch((error) => {
        if (active) setPaperError(error.message || 'The paper library could not be loaded.');
      })
      .finally(() => {
        if (active) setPaperLoading(false);
      });
    return () => { active = false; };
  }, [open, role, papers.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !running) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, running]);

  const pdfPapers = useMemo(() => papers.filter((paper) => Boolean(paper.cf)), [papers]);
  const years = useMemo(() => [...new Set(pdfPapers.map((paper) => String(paper.y || '')).filter(Boolean))].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })), [pdfPapers]);
  const filteredPapers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pdfPapers.filter((paper) => {
      const subject = subjects[paper.s] || '';
      const school = schools[paper.h] || '';
      if (subjectFilter !== 'all' && subject !== subjectFilter) return false;
      if (yearFilter !== 'all' && String(paper.y || '') !== yearFilter) return false;
      if (categoryFilter !== 'all' && paper.c !== categoryFilter) return false;
      if (!query) return true;
      return [paper.n, school, subject, paper.y, paper.c].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [pdfPapers, search, subjectFilter, yearFilter, categoryFilter, subjects, schools]);
  const visiblePapers = filteredPapers.slice(0, visibleCount);
  const completedCount = Object.values(runItems).filter((item) => ['complete', 'skipped'].includes(item.status)).length;
  const failedCount = Object.values(runItems).filter((item) => item.status === 'error').length;

  const updateRunItem = useCallback((key, item) => {
    setRunItems((current) => ({ ...current, [key]: { ...current[key], ...item } }));
  }, []);

  const toggleSelection = (key) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < MAX_BATCH_SIZE) next.add(key);
      return next;
    });
  };

  const selectVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      for (const paper of visiblePapers) {
        if (next.size >= MAX_BATCH_SIZE) break;
        next.add(paperKey(paper));
      }
      return next;
    });
  };

  async function waitForReady(paper, key) {
    const deadline = Date.now() + 6 * 60 * 1000;
    while (Date.now() < deadline) {
      if (stopRef.current) return 'stopped';
      await wait(4000);
      if (stopRef.current) return 'stopped';
      const metadata = await getPaperMetadata(paper);
      if (metadata.status === 'ready') return 'ready';
      if (metadata.status === 'error') throw new Error(metadata.error || 'Analysis failed.');
      updateRunItem(key, { status: 'running', detail: 'Analysing…' });
    }
    throw new Error('This paper is still analysing. It may finish in the background; check again shortly.');
  }

  async function startBatch() {
    const batch = pdfPapers.filter((paper) => selected.has(paperKey(paper)));
    if (!batch.length || running) return;
    stopRef.current = false;
    setStopRequested(false);
    setRunning(true);
    setRunNotice('');
    setRunItems(Object.fromEntries(batch.map((paper) => [paperKey(paper), { status: 'queued', detail: 'Waiting' }])));
    let stopped = false;
    let failed = 0;

    try {
      for (const paper of batch) {
        const key = paperKey(paper);
        if (stopRef.current) { stopped = true; break; }
        updateRunItem(key, { status: 'running', detail: 'Checking current analysis…' });
        try {
          const existing = await getPaperMetadata(paper);
          if (existing.status === 'ready') {
            updateRunItem(key, { status: 'skipped', detail: 'Already analysed' });
            continue;
          }
          if (existing.status === 'analysing') {
            const state = await waitForReady(paper, key);
            if (state === 'stopped') { updateRunItem(key, { status: 'finishing', detail: 'Analysis continues in the background' }); stopped = true; break; }
            updateRunItem(key, { status: 'complete', detail: 'Analysis complete' });
            continue;
          }

          const token = await user.getIdToken();
          const started = await analysePaperMetadata(paper, token, { adminBatch: true });
          if (started.status === 'ready') {
            updateRunItem(key, { status: 'skipped', detail: 'Already analysed' });
            continue;
          }
          if (started.status === 'error') throw new Error(started.error || 'Analysis failed to start.');
          const state = await waitForReady(paper, key);
          if (state === 'stopped') { updateRunItem(key, { status: 'finishing', detail: 'Analysis continues in the background' }); stopped = true; break; }
          updateRunItem(key, { status: 'complete', detail: 'Analysis complete' });
        } catch (error) {
          failed += 1;
          updateRunItem(key, { status: 'error', detail: error.message || 'Analysis failed.' });
        }
      }
      setRunNotice(stopped
        ? 'Stopped after the current paper. Any analysis already started will finish in the background.'
        : `Batch finished. ${batch.length} selected paper${batch.length === 1 ? '' : 's'} processed; ${failed} failed.`);
    } finally {
      setRunning(false);
      setStopRequested(false);
      stopRef.current = false;
    }
  }

  if (!roleChecked || role !== 'owner' || !user) return null;

  return (
    <>
      <button type="button" className="owner-admin-launch" onClick={() => setOpen(true)} aria-label="Open owner admin panel">
        <ShieldCheck size={16} /> Admin
      </button>

      {open && <div className="owner-admin-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !running) setOpen(false); }}>
        <section className="owner-admin-panel" role="dialog" aria-modal="true" aria-labelledby="owner-admin-title">
          <header className="owner-admin-header">
            <div>
              <span className="owner-admin-eyebrow"><LockKeyhole size={13} /> Owner access</span>
              <h1 id="owner-admin-title">Admin workspace</h1>
              <p>Manage the paper library and build its shared question maps.</p>
            </div>
            <button type="button" className="owner-admin-close" onClick={() => setOpen(false)} disabled={running} aria-label="Close admin panel"><X size={19} /></button>
          </header>

          <div className="owner-admin-stats">
            <div><Database size={17} /><span><strong>{papers.length.toLocaleString()}</strong><small>Library papers</small></span></div>
            <div><FileSearch size={17} /><span><strong>{pdfPapers.length.toLocaleString()}</strong><small>With PDF sources</small></span></div>
            <div><Check size={17} /><span><strong>{selected.size}</strong><small>Selected · max {MAX_BATCH_SIZE}</small></span></div>
            <div><Activity size={17} /><span><strong>{completedCount}{failedCount ? ` / ${failedCount} failed` : ''}</strong><small>Batch progress</small></span></div>
          </div>

          <div className="owner-admin-workspace">
            <div className="owner-admin-library">
              <div className="owner-admin-tools">
                <label className="owner-admin-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search papers, schools or subjects" /></label>
                <div className="owner-admin-filters">
                  <label>Subject<select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select><ChevronDown size={14} /></label>
                  <label>Year<select value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={14} /></label>
                  <label>Type<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All types</option>{Object.entries(CATEGORY_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={14} /></label>
                </div>
                <div className="owner-admin-selection-tools">
                  <span>{filteredPapers.length.toLocaleString()} papers match</span>
                  <div><button type="button" onClick={selectVisible} disabled={running || !visiblePapers.length}>Select visible</button><button type="button" onClick={() => setSelected(new Set())} disabled={running || !selected.size}>Clear selection</button></div>
                </div>
              </div>

              {paperError && <p className="owner-admin-error" role="alert"><CircleAlert size={16} />{paperError}</p>}
              {paperLoading ? <div className="owner-admin-empty">Loading the paper library…</div> : !paperError && <div className="owner-admin-list">
                {visiblePapers.map((paper) => {
                  const key = paperKey(paper);
                  const item = runItems[key];
                  const isSelected = selected.has(key);
                  return <label key={key} className={`owner-admin-row${isSelected ? ' is-selected' : ''}`}>
                    <input type="checkbox" checked={isSelected} disabled={running || (!isSelected && selected.size >= MAX_BATCH_SIZE)} onChange={() => toggleSelection(key)} />
                    <span className="owner-admin-check" aria-hidden="true">{isSelected ? <Check size={13} /> : <Square size={13} />}</span>
                    <span className="owner-admin-paper-copy"><strong>{paperTitle(paper)}</strong><small>{subjects[paper.s] || 'Unknown subject'} · {schools[paper.h] || 'Other source'} · {CATEGORY_LABELS[paper.c] || 'Paper'} · Year {paper.l || '—'}{paper.y ? ` · ${paper.y}` : ''}</small></span>
                    <span className={`owner-admin-status status-${item?.status || 'idle'}`}>{item?.detail || 'PDF ready'}</span>
                  </label>;
                })}
                {!filteredPapers.length && <div className="owner-admin-empty">No PDF papers match these filters.</div>}
                {filteredPapers.length > visibleCount && <button type="button" className="owner-admin-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show next {Math.min(PAGE_SIZE, filteredPapers.length - visibleCount)} papers</button>}
              </div>}
            </div>

            <aside className="owner-admin-run">
              <h2>Batch analysis</h2>
              <p>Select up to {MAX_BATCH_SIZE} papers. Complete question maps are left as they are; missing maps and failed analyses can be processed.</p>
              <div className="owner-admin-run-note">Analysis runs one paper at a time using your configured analysis service.</div>
              {runNotice && <p className="owner-admin-run-notice" role="status">{runNotice}</p>}
              {running
                ? <button type="button" className="owner-admin-run-button is-stop" onClick={() => { stopRef.current = true; setStopRequested(true); }} disabled={stopRequested}>{stopRequested ? 'Finishing current paper…' : 'Stop after current paper'}</button>
                : <button type="button" className="owner-admin-run-button" onClick={startBatch} disabled={!selected.size || paperLoading}><Play size={15} /> Analyse {selected.size || ''} selected</button>}
              <div className="owner-admin-run-foot">Signed in as {user.displayName || user.email || 'owner'} · Owner</div>
            </aside>
          </div>
        </section>
      </div>}
    </>
  );
}
