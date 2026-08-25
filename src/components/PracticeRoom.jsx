import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ClipboardCheck,
  Download,
  Feather,
  ListChecks,
  PanelBottomOpen,
  Share2,
  Sparkles,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

import { getPaperIdentity } from '../utils/paperIdentity';
import { useAuth } from './AuthContext';
import PracticeReviewModal from './PracticeReviewModal';
import PdfDocument from './pdf/PdfDocument';
import AnnotationToolbar from './pdf/AnnotationToolbar';
import ExamTimerBar from './pdf/ExamTimerBar';
import PaperMargin from './pdf/PaperMargin';
import { analysePaperMetadata, createEmptyPaperMetadata, getPaperMetadata } from '../utils/paperMetadata';
import {
  DEFAULT_ANNOTATION_COLOR,
  HIGHLIGHT_DEFAULT_COLOR,
  loadAnnotations,
  saveAnnotations,
} from '../utils/annotations';
import { useAnnotationHistory } from '../utils/useAnnotationHistory';
import {
  createExamTimer,
  formatClock,
  readTimer,
  setDuration,
  setReadingTime,
  totalSeconds as timerTotal,
} from '../utils/examTimer';
import { usePdfZoom } from '../utils/usePdfZoom';
import { usePresence } from '../utils/usePresence';
import { parsePaperTiming, describeTiming } from '../utils/paperTiming';
import { isPrimaryModifier } from '../utils/platformShortcuts';
import {
  challengeLevelLabel,
  challengeQuestionLabel,
  challengeReasonLabel,
  getChallengeRecommendations,
} from '../utils/challengeRecommendations';

const TIMER_STORAGE_KEY = 'hsc_timer_duration_secs';
const SCALE_STEP = 1.2;
const METADATA_POLL_ATTEMPTS = 80;
const METADATA_POLL_MIN_SECONDS = 4;
const CACHED_QUESTION_TARGET_STORAGE_KEY = 'hsc_cached_question_target';

function formatAnalysisElapsed(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

/** Data sheets NESA supplies in the exam room, mirrored here for the same courses. */
function getFormulaSheet(subject) {
  if (!subject) return null;
  const name = subject.toLowerCase();
  if (name.includes('physics')) return '/sheets/physics-data-sheet.pdf';
  if (name.includes('chemistry')) return '/sheets/chemistry-data-sheet.pdf';
  if (name.includes('earth') || name.includes('environmental')) return '/sheets/earth-env-science-sheet.pdf';
  if (name.includes('math')) {
    return name.includes('standard')
      ? '/sheets/maths-standard-reference.pdf'
      : '/sheets/mathematics-reference.pdf';
  }
  return null;
}

function paperDownloadName({ paper, subjectName, schoolName }) {
  const safePart = (value) => String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = [safePart(subjectName), safePart(schoolName || paper?.n), safePart(paper?.y)].filter(Boolean);
  const name = parts.join(' — ').slice(0, 160) || 'HSC Portal paper';
  return `${name}.pdf`;
}

/**
 * The practice room.
 *
 * The paper is rendered by the portal rather than handed to the browser's PDF
 * plug-in, so it can carry annotations, obey one zoom control, and sit on the
 * paper ground. Two bars float over it: the exam timer, and the annotation
 * toolbar — both ported from the Millennium reader and reset in this type.
 */
export default function PracticeRoom({
  paper,
  subjectName,
  schoolName,
  onClose,
  onSharePaper,
  allPapers = [],
  onSelectPaper,
  agentContext = {},
}) {
  const paperKey = getPaperIdentity(paper);
  const { user } = useAuth();

  // ── Timer ────────────────────────────────────────────────────────────────
  const [timer, setTimer] = useState(() => {
    // The allowance chosen when the sitting was begun is written here by the
    // library and Today, so the room opens on the clock the ladder earned.
    const stored = parseInt(localStorage.getItem(TIMER_STORAGE_KEY) || '', 10);
    return createExamTimer(Number.isFinite(stored) && stored >= 300 ? stored : 3 * 3600);
  });

  const elapsedSeconds = readTimer(timer, Date.now()).elapsedSeconds;

  // ── Annotations ──────────────────────────────────────────────────────────
  const [annotations, setAnnotations] = useState(() => loadAnnotations(paper));
  const [tool, setTool] = useState('select');
  // Ink and highlighter are different pens and remember different colours; a
  // highlighter loaded with near-black ink is just a grey smear.
  const [color, setColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_DEFAULT_COLOR);
  const isHighlighting = tool === 'highlight';
  const activeColor = isHighlighting ? highlightColor : color;
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selectedId, setSelectedId] = useState(null);
  const [toolsHidden, setToolsHidden] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const [widestPage, setWidestPage] = useState(0);
  const [detectedTiming, setDetectedTiming] = useState(null);

  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const zoom = usePdfZoom(viewportRef, contentRef, 1);
  const toolbar = usePresence(!toolsHidden, 220);
  const reveal = usePresence(toolsHidden, 180);

  useEffect(() => {
    setAnnotations(loadAnnotations(paper));
    setSelectedId(null);
    setFocusedQuestionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperKey]);

  const applyAnnotations = useCallback((next) => {
    setAnnotations(next);
    saveAnnotations(paper, next);
  }, [paper]);

  const history = useAnnotationHistory(paperKey, annotations, applyAnnotations);

  const selectedAnnotation = annotations.find((item) => item.id === selectedId) || null;
  const textEditRef = useRef(null);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    history.commit(annotations.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }, [annotations, history, selectedId]);

  // Delete removes the selected mark, Escape drops the selection. Ignored while
  // a field has focus, so typing a note never deletes it.
  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key === 'Escape') { setSelectedId(null); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedId) return;
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeSelected, selectedId]);

  // Tool letters and the standard zoom shortcuts. Skipped while a field has
  // focus, so typing a note never re-arms the eraser.
  useEffect(() => {
    const SHORTCUTS = { v: 'select', h: 'hand', d: 'draw', g: 'highlight', l: 'line', a: 'arrow', t: 'text', e: 'eraser' };

    const handleKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (isPrimaryModifier(event)) {
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom.zoomBy(SCALE_STEP); }
        else if (event.key === '-') { event.preventDefault(); zoom.zoomBy(1 / SCALE_STEP); }
        else if (event.key === '0') { event.preventDefault(); zoom.fitToWidth(widestPage); }
        else if (event.key === '.') { event.preventDefault(); setToolsHidden((hidden) => !hidden); }
        else if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) history.redo(); else history.undo();
        }
        return;
      }

      const next = SHORTCUTS[event.key?.toLowerCase()];
      if (next) { event.preventDefault(); setTool(next); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, widestPage, zoom]);

  // ── Paper context and structure ──────────────────────────────────────────
  const [paperContext, setPaperContext] = useState({
    status: 'loading', text: '', pagesExtracted: 0, pageStart: 0, pageEnd: 0, totalPages: 0, reason: '',
  });
  const [paperMetadata, setPaperMetadata] = useState(() => createEmptyPaperMetadata());
  const [metadataClock, setMetadataClock] = useState(() => Date.now());
  const [isRequestingMetadata, setIsRequestingMetadata] = useState(false);
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [isQuestionMapOpen, setIsQuestionMapOpen] = useState(false);
  const [focusedQuestionId, setFocusedQuestionId] = useState(null);
  const [openChallengeWhenReady, setOpenChallengeWhenReady] = useState(false);
  const [challengePage, setChallengePage] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [mobileTab, setMobileTab] = useState('paper');
  const actionTimerRef = useRef(null);

  const sheetUrl = getFormulaSheet(subjectName);

  const [pendingQuestion, setPendingQuestion] = useState('');

  /**
   * The paper states its own reading and working allowance on the first page.
   * When it does, and the student has not already started, the timer adopts it —
   * a detected time beats both the default and the ladder's generic guess.
   */
  const handleDocumentLoaded = useCallback(({ widestPage: widest, firstPageText }) => {
    setWidestPage(widest);
    zoom.setScale(1);

    const timing = parsePaperTiming(firstPageText);
    if (timing.source !== 'document') return;
    setDetectedTiming(timing);

    setTimer((current) => {
      if (current.status !== 'idle') return current;
      let next = current;
      if (timing.workingMinutes) next = setDuration(next, timing.workingMinutes * 60);
      if (timing.readingMinutes) next = setReadingTime(next, timing.readingMinutes * 60);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom.setScale]);

  const flash = useCallback((message, duration = 2200) => {
    setActionMessage(message);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => setActionMessage(''), duration);
  }, []);

  useEffect(() => () => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPaperContext({ status: 'loading', text: '', pagesExtracted: 0, pageStart: 0, pageEnd: 0, totalPages: 0, reason: '' });

    fetch(`/api/agent/paper-context?paperId=${encodeURIComponent(paper.v)}&paperName=${encodeURIComponent(paper.n)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'The complete paper could not be prepared.');
        return payload;
      })
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
        setPaperContext({
          status: 'unavailable', text: '', pagesExtracted: 0, pageStart: 0, pageEnd: 0, totalPages: 0,
          reason: error.message || 'The complete paper could not be prepared.',
        });
      });

    return () => controller.abort();
  }, [paper.v, paper.n, paperKey]);

  useEffect(() => {
    let isActive = true;
    setPaperMetadata(createEmptyPaperMetadata());

    getPaperMetadata(paper)
      .then((metadata) => { if (isActive) setPaperMetadata(metadata); })
      .catch((error) => {
        if (isActive) setPaperMetadata({ ...createEmptyPaperMetadata('missing'), error: error.message || 'Paper structure could not be loaded.' });
      });

    return () => { isActive = false; };
  }, [paperKey, paper]);

  const metadataElapsedSeconds = paperMetadata.status === 'analysing' && paperMetadata.analysisStartedAtMillis
    ? Math.max(0, Math.floor((metadataClock - paperMetadata.analysisStartedAtMillis) / 1000))
    : 0;

  // Keep the elapsed label alive even while the browser polls in the background.
  useEffect(() => {
    if (paperMetadata.status !== 'analysing') return undefined;
    setMetadataClock(Date.now());
    const timer = setInterval(() => setMetadataClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paperMetadata.analysisStartedAtMillis, paperMetadata.status]);

  // An analysis claimed by this or another reader finishes on the server. Poll the
  // shared cache until it lands instead of asking the student to press Refresh.
  useEffect(() => {
    if (paperMetadata.status !== 'analysing') return undefined;

    let isActive = true;
    let attempts = 0;
    const delayMs = Math.max(paperMetadata.retryAfterSeconds || 10, METADATA_POLL_MIN_SECONDS) * 1000;

    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > METADATA_POLL_ATTEMPTS) {
        clearInterval(timer);
        return;
      }

      getPaperMetadata(paper)
        .then((metadata) => {
          if (!isActive || metadata.status === 'analysing') return;
          clearInterval(timer);
          setPaperMetadata(metadata);
          if (metadata.status === 'ready') flash('Question structure is ready');
        })
        .catch(() => {
          // A single failed poll is not fatal; the next tick tries again.
        });
    }, delayMs);

    return () => { isActive = false; clearInterval(timer); };
  }, [paperMetadata.status, paperMetadata.retryAfterSeconds, paper, flash]);

  const challengeRecommendations = useMemo(
    () => getChallengeRecommendations(paperMetadata.questions),
    [paperMetadata.questions],
  );
  const hasFallbackRecommendation = challengeRecommendations[0]?.isFallback === true;

  useEffect(() => {
    if (!openChallengeWhenReady || paperMetadata.status !== 'ready') return;
    setOpenChallengeWhenReady(false);
    setIsChallengeOpen(true);
    flash(challengeRecommendations.length
      ? hasFallbackRecommendation ? 'A suggested question is ready' : 'Recommended challenges are ready'
      : 'Question pages could not be prepared for this paper');
  }, [challengeRecommendations.length, flash, hasFallbackRecommendation, openChallengeWhenReady, paperMetadata.status]);

  const handleAnalysePaperMetadata = async ({ refresh = false } = {}) => {
    if (paperMetadata.status === 'analysing') {
      setIsRequestingMetadata(true);
      try {
        const metadata = await getPaperMetadata(paper);
        setPaperMetadata(metadata);
        flash(metadata.status === 'ready' ? 'Question structure is ready' : 'Analysis is still running. Try again shortly.');
      } catch (error) {
        flash('Could not refresh the analysis');
      } finally {
        setIsRequestingMetadata(false);
      }
      return;
    }

    if (!user) {
      flash('Sign in to analyse and save this paper structure');
      return;
    }

    setIsRequestingMetadata(true);
    setPaperMetadata((current) => ({ ...current, status: 'analysing', error: '' }));
    try {
      const token = await user.getIdToken();
      const metadata = await analysePaperMetadata(paper, token, { refresh });
      setPaperMetadata(metadata);
      flash(metadata.status === 'analysing'
        ? refresh ? 'Question Map refresh has started. Check again shortly.' : 'Analysis has started. Check again shortly.'
        : 'Question structure is ready');
    } catch (error) {
      setPaperMetadata(refresh
        ? paperMetadata
        : { ...createEmptyPaperMetadata('missing'), error: error.message || 'Paper structure could not be analysed.' });
      flash(refresh
        ? error.message || 'Could not refresh this Question Map'
        : 'Could not analyse this paper');
    } finally {
      setIsRequestingMetadata(false);
    }
  };

  const handleQuestionMap = () => {
    if (paperMetadata.status === 'ready') {
      setIsQuestionMapOpen(true);
      return;
    }

    handleAnalysePaperMetadata();
  };

  const handleRefreshQuestionMap = () => {
    if (!paperMetadata.refresh?.eligible) {
      flash(paperMetadata.refresh?.reason || 'This Question Map is already complete enough to keep.');
      return;
    }
    if (!user) {
      flash('Sign in to refresh and improve this shared Question Map');
      return;
    }
    setIsQuestionMapOpen(false);
    handleAnalysePaperMetadata({ refresh: true });
  };

  const handleRecommendChallenge = () => {
    if (paperMetadata.status === 'ready') {
      setIsChallengeOpen(true);
      if (!challengeRecommendations.length) flash('Question pages could not be prepared for this paper');
      return;
    }

    if (!user) {
      flash('Sign in to analyse and save this paper structure');
      return;
    }

    setOpenChallengeWhenReady(true);
    if (paperMetadata.status === 'analysing') {
      flash('Question analysis is still running — recommendations will open when it finishes');
      return;
    }
    handleAnalysePaperMetadata();
  };

  const handleOpenQuestion = (question, subpart = null) => {
    const page = Number(subpart?.page ?? question?.targetPage ?? question?.page);
    if (!Number.isInteger(page) || page < 1) {
      flash('This recommendation does not have a page number yet');
      return;
    }
    const subpartId = String(subpart?.id || '').trim();
    const label = subpartId
      ? `Question ${String(question?.id || '').trim()}(${subpartId})`
      : challengeQuestionLabel(question);
    setChallengePage(page);
    setIsChallengeOpen(false);
    setFocusedQuestionId(null);
    setIsQuestionMapOpen(false);
    flash(`${label} — page ${page}`);
  };

  const handleOpenCachedQuestion = (result) => {
    const page = Number(result?.question?.page);
    const targetPaper = allPapers.find((candidate) => (
      getPaperIdentity(candidate) === String(result?.paperIdentity || '')
    ));
    if (!targetPaper || !Number.isInteger(page) || page < 1) {
      flash('This cached question can no longer be opened');
      return;
    }

    const label = `Question ${String(result.question.id || '').trim()}`;
    if (getPaperIdentity(targetPaper) === paperKey) {
      handleOpenQuestion({ ...result.question, id: result.question.id });
      return;
    }
    if (typeof onSelectPaper !== 'function') {
      flash('Paper navigation is not available here');
      return;
    }

    try {
      sessionStorage.setItem(CACHED_QUESTION_TARGET_STORAGE_KEY, JSON.stringify({
        paperIdentity: getPaperIdentity(targetPaper),
        page,
        label,
      }));
    } catch {
      // The destination still opens if browser storage is unavailable.
    }
    onSelectPaper(targetPaper);
  };

  useEffect(() => {
    try {
      const target = JSON.parse(sessionStorage.getItem(CACHED_QUESTION_TARGET_STORAGE_KEY) || 'null');
      if (!target || target.paperIdentity !== paperKey) return;
      sessionStorage.removeItem(CACHED_QUESTION_TARGET_STORAGE_KEY);
      const page = Number(target.page);
      if (!Number.isInteger(page) || page < 1) return;
      setChallengePage(page);
      flash(`${target.label || 'Question'} — page ${page}`);
    } catch {
      // A malformed or unavailable stored target must not block opening a paper.
    }
  }, [paperKey, flash]);

  // Record that this paper was opened.
  useEffect(() => {
    try {
      const key = 'hsc_viewed_papers';
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const entry = { key: paperKey, v: paper.v, n: paper.n, s: paper.s, h: paper.h, y: paper.y, dateViewed: Date.now() };
      const filtered = (stored || []).filter((item) => String(item.key || item.v) !== paperKey);
      localStorage.setItem(key, JSON.stringify([entry, ...filtered].slice(0, 200)));
      window.dispatchEvent(new CustomEvent('hsc:history-updated'));
    } catch (error) {
      // History is a convenience; storage failures must not block the sitting.
    }
  }, [paperKey, paper]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hsc_completed_papers') || '[]') || [];
      setIsCompleted(stored.some((item) => (
        String(item.paperId || item.paperIdLegacy || item.v) === paperKey
        || String(item.paperId || item.paperIdLegacy || item.v) === String(paper.v)
      )));
    } catch (error) {
      setIsCompleted(false);
    }
  }, [paperKey, paper.v]);

  const handleMarkCompleted = () => {
    try {
      const key = 'hsc_completed_papers';
      const stored = JSON.parse(localStorage.getItem(key) || '[]') || [];
      const entry = {
        id: `${paperKey}_${Date.now()}`,
        paperId: paperKey,
        paperIdLegacy: paper.v,
        paperName: paper.n,
        subjectName,
        schoolName,
        dateCompleted: Date.now(),
        timeSpent: elapsedSeconds,
        status: 'Completed',
      };
      const index = stored.findIndex((item) => (
        String(item.paperId || item.paperIdLegacy || item.v) === paperKey
        || String(item.paperId || item.paperIdLegacy || item.v) === String(paper.v)
      ));
      if (index >= 0) stored[index] = { ...stored[index], ...entry };
      else stored.unshift(entry);

      localStorage.setItem(key, JSON.stringify(stored.slice(0, 500)));
      setIsCompleted(true);
      setIsReviewOpen(true);
      window.dispatchEvent(new CustomEvent('hsc:history-updated'));
      flash('Marked complete — add your review', 1800);
    } catch (error) {
      flash('Could not mark this paper complete', 1800);
    }
  };

  const handleUnmarkCompleted = () => {
    try {
      const key = 'hsc_completed_papers';
      const stored = (JSON.parse(localStorage.getItem(key) || '[]') || []).filter((item) => (
        String(item.paperId || item.paperIdLegacy || item.v) !== paperKey
        && String(item.paperId || item.paperIdLegacy || item.v) !== String(paper.v)
      ));
      localStorage.setItem(key, JSON.stringify(stored));
      setIsCompleted(false);
      window.dispatchEvent(new CustomEvent('hsc:history-updated'));
      flash('Marked incomplete', 1800);
    } catch (error) {
      flash('Could not update this paper', 1800);
    }
  };

  // ── The paper source ─────────────────────────────────────────────────────
  // Papers with a Cloudflare path are real PDFs and render in the portal's own
  // viewer. Anything else only exists behind the legacy viewer page, which is
  // HTML — it stays in a frame rather than being passed to pdf.js as a PDF.
  const pdfUrl = paper?.cf ? `https://hscportal.pages.dev/${encodeURI(paper.cf)}` : null;
  const legacyUrl = `https://thsconline.github.io/s/viewer.html?field=${encodeURIComponent(paper?.n ?? '')}&base=${paper?.v ?? ''}`;

  const handleDownloadPaper = useCallback(async () => {
    if (!pdfUrl || isDownloading) return;

    setIsDownloading(true);
    flash('Preparing your paper download…', 12000);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`The PDF server returned ${response.status}.`);

      const file = await response.blob();
      if (!file.size) throw new Error('The PDF was empty.');

      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = paperDownloadName({ paper, subjectName, schoolName });
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      flash('Download started. Check your device downloads.', 3500);
    } catch (error) {
      // A few browser/privacy configurations do not permit an in-page blob
      // download from the paper host. Keep the student moving with the original
      // PDF in a new tab rather than failing silently.
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      flash('Could not save automatically — the original PDF opened in a new tab.', 5000);
    } finally {
      setIsDownloading(false);
    }
  }, [flash, isDownloading, paper, pdfUrl, schoolName, subjectName]);

  const paperCategory = paper.c === 'H' ? 'Official HSC'
    : paper.c === 'T' ? 'School trial'
      : paper.c === 'A' ? 'Assessment task' : 'Resource';

  const marginContext = useMemo(() => ({
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
      structure: {
        status: paperMetadata.status,
        questionCount: paperMetadata.questionCount,
        totalMarks: paperMetadata.totalMarks,
        questions: paperMetadata.questions,
      },
    },
  }), [agentContext, paper, subjectName, schoolName, paperCategory, paperContext, paperMetadata]);

  const ladderEntry = (agentContext.ladder || []).find((entry) => entry.subject === subjectName) || null;
  const focusedQuestion = paperMetadata.questions.find((question) => question.id === focusedQuestionId) || null;

  return (
    <div className="reader">
      <header className="reader-head">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          <ArrowLeft size={14} />
          Library
        </button>

        <div className="reader-title">
          <div className="kick">
            {subjectName} · {paperCategory}{paper.w === 1 ? ' · Solutions' : ''}
          </div>
          <div className="reader-name">{schoolName || paper.n} {paper.y}</div>
        </div>

        <div className="reader-actions">
          {pdfUrl && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadPaper}
              disabled={isDownloading}
              aria-busy={isDownloading}
              title="Download this paper as a PDF"
            >
              <Download size={14} />
              {isDownloading ? 'Preparing download…' : 'Download'}
            </button>
          )}

          {sheetUrl && (
            <button
              type="button"
              className={`btn ${showFormula ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFormula((open) => !open)}
              title="Show the data sheet beside the paper"
            >
              <BookOpen size={14} />
              Data sheet
            </button>
          )}

          <button
            type="button"
            className={`btn ${isMarginOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsMarginOpen((open) => !open)}
            title="Ask about this paper"
          >
            <Feather size={14} />
            Margin
          </button>

          <button
            type="button"
            className={`btn ${isChallengeOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleRecommendChallenge}
            disabled={isRequestingMetadata}
            title={paperMetadata.status === 'ready'
              ? 'Find an unusual or challenging question in this paper'
              : paperMetadata.error || 'Analyse this paper once, then find a recommended challenge'}
          >
            <Sparkles size={14} />
            {paperMetadata.status === 'ready' ? 'Recommended challenge' : 'Find a challenge'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleQuestionMap}
            disabled={isRequestingMetadata}
            title={paperMetadata.status === 'ready'
              ? 'Open the saved question topics, skills, marks, and page map'
              : paperMetadata.error || 'Read the questions, topics, and marks out of this paper once'}
          >
            <ListChecks size={14} />
            {paperMetadata.status === 'ready'
              ? `Question map · ${paperMetadata.questionCount}`
              : isRequestingMetadata ? 'Starting analysis…'
                : paperMetadata.status === 'analysing' ? `Analysing ${formatAnalysisElapsed(metadataElapsedSeconds)}`
                  : paperMetadata.error ? 'Retry structure'
                    : 'Read structure'}
          </button>

          {onSharePaper && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={onSharePaper} title="Share this paper" aria-label="Share this paper">
              <Share2 size={14} />
            </button>
          )}

          <button type="button" className="btn btn-secondary" onClick={() => setIsReviewOpen(true)} title="Review this sitting">
            <ClipboardCheck size={14} />
            Review
          </button>

          {isCompleted ? (
            <button type="button" className="btn btn-secondary" onClick={handleUnmarkCompleted}>
              <X size={14} />
              Sat
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleMarkCompleted}>
              <Check size={14} />
              Mark sat
            </button>
          )}
        </div>
      </header>

      {actionMessage && <div className="reader-notice">{actionMessage}</div>}

      {isQuestionMapOpen && (
        <section className="reader-question-map" aria-label="Question topic map" aria-live="polite">
          <div className="reader-challenge-head">
            <div>
              <div className="kick"><ListChecks size={12} /> Question map</div>
              <p className="dim" style={{ margin: '3px 0 0', fontSize: '12.5px' }}>
                Topics, skills, command verbs, marks, and pages are cached once for every student.
              </p>
            </div>
            <div className="reader-question-map-actions">
              {paperMetadata.refresh?.needsRefresh && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRefreshQuestionMap}
                  disabled={isRequestingMetadata || !paperMetadata.refresh?.eligible}
                  title={paperMetadata.refresh.reason || 'Refresh this incomplete shared Question Map'}
                >
                  <RotateCcw size={13} />
                  {paperMetadata.refresh?.eligible ? 'Refresh map' : 'Refresh later'}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => { setFocusedQuestionId(null); setIsQuestionMapOpen(false); }} aria-label="Close question map" title="Close">
                <X size={14} />
              </button>
            </div>
          </div>
          {!focusedQuestion && (
            <div className="reader-question-map-list">
              {paperMetadata.questions.map((question) => {
                const page = Number(question?.page);
                const hasPage = Number.isInteger(page) && page >= 1;
                const subparts = Array.isArray(question?.subparts) ? question.subparts : [];
                const detail = [
                  question.commandVerb ? `${question.commandVerb[0].toUpperCase()}${question.commandVerb.slice(1)}` : '',
                  question.skill,
                ].filter(Boolean).join(' · ');

                return (
                  <article key={question.id} className="reader-question-map-card">
                    <button
                      type="button"
                      className="question-map-primary"
                      disabled={!hasPage}
                      onClick={() => handleOpenQuestion(question)}
                      title={hasPage ? `Go to Question ${question.id} on page ${page}` : 'This question does not have a reliable page number'}
                    >
                      <span className="question-map-title">
                        <strong>{challengeQuestionLabel(question)}</strong>
                        <span className="num dim">{question.marks !== null && question.marks !== undefined ? `${question.marks} marks` : 'Marks not stated'}{hasPage ? ` · Page ${page}` : ''}</span>
                      </span>
                      {question.topics.length > 0 && (
                        <span className="question-topic-tags">
                          {question.topics.map((topic) => <span key={topic}>{topic}</span>)}
                        </span>
                      )}
                      {detail && <span className="question-map-skill">{detail}</span>}
                      {hasPage && <span className="challenge-go">Open full question →</span>}
                    </button>

                    {subparts.length > 0 && (
                      <button
                        type="button"
                        className="question-map-subparts-toggle"
                        onClick={() => setFocusedQuestionId(question.id)}
                        aria-haspopup="dialog"
                      >
                        <span>{`View ${subparts.length} ${subparts.length === 1 ? 'part' : 'parts'}`}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {focusedQuestion && (() => {
            const page = Number(focusedQuestion?.page);
            const hasPage = Number.isInteger(page) && page >= 1;
            const subparts = Array.isArray(focusedQuestion?.subparts) ? focusedQuestion.subparts : [];
            const detail = [
              focusedQuestion.commandVerb ? `${focusedQuestion.commandVerb[0].toUpperCase()}${focusedQuestion.commandVerb.slice(1)}` : '',
              focusedQuestion.skill,
            ].filter(Boolean).join(' · ');
            return (
              <section className="question-map-focus" role="dialog" aria-modal="true" aria-labelledby="focused-question-title">
                <div className="question-map-focus-card">
                  <div className="question-map-focus-head">
                    <div>
                      <span className="kick">Question details</span>
                      <h2 id="focused-question-title">{challengeQuestionLabel(focusedQuestion)}</h2>
                    </div>
                    <button type="button" className="btn btn-secondary btn-icon" onClick={() => setFocusedQuestionId(null)} aria-label="Return to all questions" title="Close question details">
                      <X size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="question-map-focus-primary"
                    disabled={!hasPage}
                    onClick={() => handleOpenQuestion(focusedQuestion)}
                    title={hasPage ? `Go to Question ${focusedQuestion.id} on page ${page}` : 'This question does not have a reliable page number'}
                  >
                    <span className="question-map-title">
                      <strong>{challengeQuestionLabel(focusedQuestion)}</strong>
                      <span className="num dim">{focusedQuestion.marks !== null && focusedQuestion.marks !== undefined ? `${focusedQuestion.marks} marks` : 'Marks not stated'}{hasPage ? ` · Page ${page}` : ''}</span>
                    </span>
                    {focusedQuestion.topics.length > 0 && (
                      <span className="question-topic-tags">
                        {focusedQuestion.topics.map((topic) => <span key={topic}>{topic}</span>)}
                      </span>
                    )}
                    {detail && <span className="question-map-skill">{detail}</span>}
                    {hasPage && <span className="challenge-go">Open full question →</span>}
                  </button>

                  <div className="question-map-subparts question-map-focus-subparts" aria-label={`Parts of Question ${focusedQuestion.id}`}>
                    <span className="question-map-subparts-label">Parts</span>
                    {subparts.map((subpart) => {
                      const subpartPage = Number(subpart?.page ?? page);
                      const subpartHasPage = Number.isInteger(subpartPage) && subpartPage >= 1;
                      const subpartDetail = [
                        subpart.commandVerb ? `${subpart.commandVerb[0].toUpperCase()}${subpart.commandVerb.slice(1)}` : '',
                        subpart.skill,
                      ].filter(Boolean).join(' · ');
                      return (
                        <button
                          key={`${focusedQuestion.id}-${subpart.id}`}
                          type="button"
                          className="question-map-subpart"
                          disabled={!subpartHasPage}
                          onClick={() => handleOpenQuestion(focusedQuestion, { ...subpart, page: subpartPage })}
                          title={subpartHasPage ? `Go to Question ${focusedQuestion.id}(${subpart.id}) on page ${subpartPage}` : `Question ${focusedQuestion.id}(${subpart.id}) does not have a reliable page number`}
                        >
                          <span className="question-map-subpart-main">
                            <span className="question-map-subpart-heading">
                              <strong>{focusedQuestion.id}({subpart.id})</strong>
                              <span className="question-map-subpart-meta">{subpart.marks !== null && subpart.marks !== undefined ? `${subpart.marks} marks` : 'Marks not stated'}{subpartHasPage ? ` · Page ${subpartPage}` : ''}</span>
                            </span>
                            {subpart.topics.length > 0 && (
                              <span className="question-subpart-topic-tags">
                                {subpart.topics.map((topic) => <span key={topic}>{topic}</span>)}
                              </span>
                            )}
                            {subpartDetail && <span className="question-map-subpart-skill">{subpartDetail}</span>}
                          </span>
                          {subpartHasPage && <em>Take me there →</em>}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="btn btn-secondary question-map-focus-return" onClick={() => setFocusedQuestionId(null)}>
                    <ArrowLeft size={14} />
                    All questions
                  </button>
                </div>
              </section>
            );
          })()}
        </section>
      )}

      {isChallengeOpen && (
        <section className="reader-challenge" aria-label="Recommended challenges" aria-live="polite">
          <div className="reader-challenge-head">
            <div>
              <div className="kick"><Sparkles size={12} /> Recommended challenge</div>
              <p className="dim" style={{ margin: '3px 0 0', fontSize: '12.5px' }}>
                {challengeRecommendations.length
                  ? hasFallbackRecommendation
                    ? 'This is the paper’s most substantial question. Try it carefully, then continue with the rest of the paper.'
                    : 'These questions are tagged for unusual context, careful reasoning, or non-routine exam skills.'
                  : 'The paper structure is ready, but no page-addressable questions could be prepared.'}
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setIsChallengeOpen(false)} aria-label="Close recommended challenges" title="Close">
              <X size={14} />
            </button>
          </div>

          {challengeRecommendations.length > 0 ? (
            <div className="reader-challenge-list">
              {challengeRecommendations.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  className="reader-challenge-card"
                  onClick={() => handleOpenQuestion(question)}
                >
                  <span className={`challenge-level is-${question.challenge.level}`}>{question.isFallback ? 'Suggested' : challengeLevelLabel(question.challenge.level)}</span>
                  <strong>{challengeQuestionLabel(question)}</strong>
                  <span className="num dim">{question.targetMarks !== null && question.targetMarks !== undefined ? `${question.targetMarks} marks` : 'Marks not stated'} · Page {question.targetPage}</span>
                  <span className="challenge-reason">{challengeReasonLabel(question)}</span>
                  <span className="challenge-go">Take me there →</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="reader-challenge-empty">Try reopening the paper once its question pages are available, or use Margin to ask about a section you find difficult.</div>
          )}
        </section>
      )}

      <div className="reader-body">
        <div className={`reader-panes ${showFormula && sheetUrl ? 'is-split' : ''}`}>
          <div className={`reader-pane ${mobileTab === 'paper' ? 'is-active' : ''}`}>
            {pdfUrl ? (
              <PdfDocument
                url={pdfUrl}
                zoom={zoom}
                tool={tool}
                color={activeColor}
                strokeWidth={strokeWidth}
                annotations={annotations}
                onCommit={history.commit}
                onDirectChange={applyAnnotations}
                selectedId={selectedId}
                onSelectedIdChange={setSelectedId}
                onDocumentLoaded={handleDocumentLoaded}
                onSelectionChange={setSelectionText}
                viewportRef={viewportRef}
                contentRef={contentRef}
                targetPage={challengePage}
              />
            ) : (
              <iframe className="reader-frame" src={legacyUrl} title="Exam paper" />
            )}

            {toolbar.mounted && (
            <div className={`reader-bars is-${toolbar.stage} ${isMarginOpen ? 'is-shifted' : ''}`}>
              {selectionText && (
                <div className="selection-bar">
                  <span className="kick">Selected</span>
                  <span className="selection-quote">“{selectionText.slice(0, 90)}{selectionText.length > 90 ? '…' : ''}”</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setPendingQuestion(selectionText); setIsMarginOpen(true); }}
                  >
                    <Feather size={14} />
                    Ask AI about this
                  </button>
                </div>
              )}

              {selectedAnnotation && (
                <div className="mark-editor">
                  {selectedAnnotation.kind === 'text' ? (
                    <input
                      ref={textEditRef}
                      className="input"
                      value={selectedAnnotation.text || ''}
                      aria-label="Annotation text"
                      placeholder="Note"
                      onChange={(event) => {
                        const next = annotations.map((item) => (
                          item.id === selectedId ? { ...item, text: event.target.value } : item
                        ));
                        // One history entry for the whole edit, not one per keystroke.
                        if (textEditRef.current === document.activeElement) applyAnnotations(next);
                        else history.commit(next);
                      }}
                    />
                  ) : (
                    <span className="dim" style={{ fontSize: '12.5px' }}>
                      {selectedAnnotation.kind} selected
                    </span>
                  )}
                  <button type="button" className="tool-btn" onClick={removeSelected} title="Delete this mark" aria-label="Delete this mark">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}

              <ExamTimerBar
                state={timer}
                onStateChange={setTimer}
                durationSource={detectedTiming ? 'document' : ladderEntry ? 'ladder' : 'manual'}
                sourceDetail={detectedTiming ? describeTiming(detectedTiming) : null}
                suggestedReadingMinutes={detectedTiming?.readingMinutes || 0}
                onFinished={() => flash('Pens down. Open the review while it is fresh.', 6000)}
              />

              {pdfUrl && (
                <AnnotationToolbar
                  tool={tool}
                  onToolChange={setTool}
                  color={activeColor}
                  onColorChange={isHighlighting ? setHighlightColor : setColor}
                  palette={isHighlighting ? 'highlight' : 'ink'}
                  strokeWidth={strokeWidth}
                  onStrokeWidthChange={setStrokeWidth}
                  scale={zoom.liveScale}
                  minScale={zoom.minScale}
                  maxScale={zoom.maxScale}
                  isRasterStale={zoom.isRasterStale}
                  onZoom={(direction) => zoom.zoomBy(direction > 0 ? SCALE_STEP : 1 / SCALE_STEP)}
                  onFitWidth={() => zoom.fitToWidth(widestPage)}
                  canUndo={history.canUndo}
                  canRedo={history.canRedo}
                  onUndo={history.undo}
                  onRedo={history.redo}
                  onHide={() => setToolsHidden(true)}
                />
              )}
            </div>
            )}

            {reveal.mounted && (
              <button
                type="button"
                className={`reader-reveal is-${reveal.stage}`}
                onClick={() => setToolsHidden(false)}
                aria-label="Show the tools"
                title="Show the tools"
              >
                <PanelBottomOpen size={16} />
                <span className="num">{formatClock(readTimer(timer, Date.now()).phaseRemainingSeconds)}</span>
              </button>
            )}
          </div>

          {showFormula && sheetUrl && (
            <div className={`reader-pane reader-pane-sheet ${mobileTab === 'formula' ? 'is-active' : ''}`}>
              <iframe className="reader-frame" src={sheetUrl} title="Data sheet" />
            </div>
          )}
        </div>

        {showFormula && sheetUrl && (
          <div className="reader-tabs">
            <div className="seg">
              {[{ id: 'paper', label: 'Paper' }, { id: 'formula', label: 'Data sheet' }].map((entry) => (
                <label key={entry.id} className="seg-opt">
                  <input
                    type="radio"
                    name="reader-pane"
                    checked={mobileTab === entry.id}
                    onChange={() => setMobileTab(entry.id)}
                  />
                  <span>{entry.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <PaperMargin
        isOpen={isMarginOpen}
        onClose={() => setIsMarginOpen(false)}
        paper={paper}
        subjectName={subjectName}
        appContext={marginContext}
        quotedText={pendingQuestion}
        onQuoteConsumed={() => setPendingQuestion('')}
        onOpenCachedQuestion={handleOpenCachedQuestion}
      />

      {isReviewOpen && (
        <PracticeReviewModal
          paper={paper}
          subjectName={subjectName}
          schoolName={schoolName}
          metadata={paperMetadata}
          timeSpent={elapsedSeconds}
          allowanceLabel={ladderEntry ? ladderEntry.allowance.label.toLowerCase() : formatClock(timerTotal(timer))}
          onClose={() => setIsReviewOpen(false)}
          onSaved={(_, mistakeCount) => {
            flash(mistakeCount
              ? `Review saved with ${mistakeCount} mistake${mistakeCount === 1 ? '' : 's'}`
              : 'Review saved');
          }}
        />
      )}
    </div>
  );
}
