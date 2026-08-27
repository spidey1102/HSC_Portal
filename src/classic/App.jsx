import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import PaperCard from './components/PaperCard';
import PracticeRoom from './components/PracticeRoom';
import TextbooksView from './components/TextbooksView';
import ExamCountdown from './components/ExamCountdown';
import CustomCalendar from './components/CustomCalendar';
import PaperSearch from './components/PaperSearch';
import AdaptiveRecommendations from './components/AdaptiveRecommendations';
import AgentCommandCenter from './components/AgentCommandCenter';
import CustomizationMenu from './components/CustomizationMenu';
import { Library, RefreshCw, Trash2, Book, Menu, Calendar, Moon, Sun, Clock, BotMessageSquare, Palette, BookOpenCheck } from 'lucide-react';
import PaperHistory from './components/PaperHistory';
import StudyNotebook from './components/StudyNotebook';
import { Analytics } from '@vercel/analytics/react';
import { findPaperByIdentifier, getPaperRouteId } from './utils/paperIdentity';
import { loadMySubjects } from './utils/mySubjects';
import { getAdaptiveRecommendations, loadRecommendationHistory } from './utils/adaptiveRecommendations';
import {
  COMPLETED_PAPERS_STORAGE_KEY,
  mergeCompletedPapers,
  mergeMySubjects,
  mergeViewedPapers,
  MY_SUBJECTS_STORAGE_KEY,
  notifyStudySyncUpdate,
  readStoredArray,
  sameSerializedValue,
  VIEWED_PAPERS_STORAGE_KEY,
  writeStoredArray,
} from './utils/studySync';
import { loadOpenRouterSettings, saveOpenRouterSettings } from './utils/openRouterKeySettings';
import {
  loadMistakeLog,
  loadPracticeReviews,
  mergeMistakeLog,
  mergePracticeReviews,
  MISTAKE_LOG_STORAGE_KEY,
  notifyPracticeRecordsUpdated,
  PRACTICE_REVIEWS_STORAGE_KEY,
} from './utils/practiceRecords';
import {
  ACCENT_OPTIONS,
  APPEARANCE_DEFAULTS,
  APPEARANCE_PRESETS,
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_VARIABLE_KEYS,
  getAppearanceVars,
  loadAppearanceSettings,
} from './utils/appearancePresets';
import './App.css';
import { useSync } from './components/SyncContext';
import { useAuth } from './components/AuthContext';
import UserButton from './components/UserButton';

const PAPER_PAGE_SIZE = 40;
const PAPER_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'school', label: 'School A–Z' },
];

export default function App({ onPortalLayoutChange }) {
  const { data, updateRemote, updateRemoteFields } = useSync();
  const { user } = useAuth();

  // DB States
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(12); // Year 12 (HSC) by default
  const [mySubjects, setMySubjects] = useState(() => loadMySubjects());
  const [paperSearchQuery, setPaperSearchQuery] = useState('');
  const [paperSort, setPaperSort] = useState(() => {
    const storedSort = localStorage.getItem('hsc_paper_sort');
    return PAPER_SORT_OPTIONS.some((option) => option.value === storedSort) ? storedSort : 'newest';
  });
  const [recommendationHistory, setRecommendationHistory] = useState(() => loadRecommendationHistory());
  const [recommendationPaperType, setRecommendationPaperType] = useState(() => localStorage.getItem('hsc_recommendation_paper_type') || 'all');

  // Bookmarks State
  const [viewBookmarks, setViewBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('hsc_bookmarks');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    if (data && data.bookmarks) {
      setBookmarks(new Set(data.bookmarks));
      localStorage.setItem('hsc_bookmarks', JSON.stringify(data.bookmarks));
    }
  }, [data?.bookmarks]);

  const hasRestoredStudySyncRef = useRef(false);

  useEffect(() => {
    const syncMySubjects = () => setMySubjects(loadMySubjects());
    const handleStorage = (event) => {
      if (event.key === 'hsc_my_subjects') {
        syncMySubjects();
      }
    };

    window.addEventListener('hsc:my-subjects-updated', syncMySubjects);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('hsc:my-subjects-updated', syncMySubjects);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!user || !data) return;

    if (hasRestoredStudySyncRef.current) {
      const remoteSubjects = mergeMySubjects(data.mySubjects, []);
      const remoteViewed = mergeViewedPapers(data.viewedPapers, []);
      const remoteCompleted = mergeCompletedPapers(data.completedPapers, []);
      const remoteReviews = mergePracticeReviews(data.practiceReviews, []);
      const remoteMistakes = mergeMistakeLog(data.mistakeLog, []);
      let didRestoreLocalData = false;

      if (!sameSerializedValue(loadMySubjects(), remoteSubjects)) {
        localStorage.setItem(MY_SUBJECTS_STORAGE_KEY, JSON.stringify(remoteSubjects));
        setMySubjects(remoteSubjects);
        didRestoreLocalData = true;
      }
      if (!sameSerializedValue(readStoredArray(VIEWED_PAPERS_STORAGE_KEY), remoteViewed)) {
        writeStoredArray(VIEWED_PAPERS_STORAGE_KEY, remoteViewed);
        didRestoreLocalData = true;
      }
      if (!sameSerializedValue(readStoredArray(COMPLETED_PAPERS_STORAGE_KEY), remoteCompleted)) {
        writeStoredArray(COMPLETED_PAPERS_STORAGE_KEY, remoteCompleted);
        didRestoreLocalData = true;
      }
      if (!sameSerializedValue(loadPracticeReviews(), remoteReviews)) {
        writeStoredArray(PRACTICE_REVIEWS_STORAGE_KEY, remoteReviews);
        didRestoreLocalData = true;
      }
      if (!sameSerializedValue(loadMistakeLog(), remoteMistakes)) {
        writeStoredArray(MISTAKE_LOG_STORAGE_KEY, remoteMistakes);
        didRestoreLocalData = true;
      }
      if (didRestoreLocalData) {
        notifyStudySyncUpdate();
        notifyPracticeRecordsUpdated();
      }
      return;
    }

    const localSubjects = loadMySubjects();
    const localViewed = readStoredArray(VIEWED_PAPERS_STORAGE_KEY);
    const localCompleted = readStoredArray(COMPLETED_PAPERS_STORAGE_KEY);
    const localReviews = loadPracticeReviews();
    const localMistakes = loadMistakeLog();
    const mergedSubjects = mergeMySubjects(data.mySubjects, localSubjects);
    const mergedViewed = mergeViewedPapers(data.viewedPapers, localViewed);
    const mergedCompleted = mergeCompletedPapers(data.completedPapers, localCompleted);
    const mergedReviews = mergePracticeReviews(data.practiceReviews, localReviews);
    const mergedMistakes = mergeMistakeLog(data.mistakeLog, localMistakes);

    hasRestoredStudySyncRef.current = true;

    if (!sameSerializedValue(localSubjects, mergedSubjects)) {
      localStorage.setItem(MY_SUBJECTS_STORAGE_KEY, JSON.stringify(mergedSubjects));
      setMySubjects(mergedSubjects);
    }
    if (!sameSerializedValue(localViewed, mergedViewed)) writeStoredArray(VIEWED_PAPERS_STORAGE_KEY, mergedViewed);
    if (!sameSerializedValue(localCompleted, mergedCompleted)) writeStoredArray(COMPLETED_PAPERS_STORAGE_KEY, mergedCompleted);
    if (!sameSerializedValue(localReviews, mergedReviews)) writeStoredArray(PRACTICE_REVIEWS_STORAGE_KEY, mergedReviews);
    if (!sameSerializedValue(localMistakes, mergedMistakes)) writeStoredArray(MISTAKE_LOG_STORAGE_KEY, mergedMistakes);
    notifyStudySyncUpdate();
    notifyPracticeRecordsUpdated();

    const remotePatch = {};
    if (!sameSerializedValue(data.mySubjects || [], mergedSubjects)) remotePatch.mySubjects = mergedSubjects;
    if (!sameSerializedValue(data.viewedPapers || [], mergedViewed)) remotePatch.viewedPapers = mergedViewed;
    if (!sameSerializedValue(data.completedPapers || [], mergedCompleted)) remotePatch.completedPapers = mergedCompleted;
    if (!sameSerializedValue(data.practiceReviews || [], mergedReviews)) remotePatch.practiceReviews = mergedReviews;
    if (!sameSerializedValue(data.mistakeLog || [], mergedMistakes)) remotePatch.mistakeLog = mergedMistakes;
    updateRemoteFields(remotePatch);
  }, [data, updateRemoteFields, user]);

  useEffect(() => {
    if (!user) return undefined;

    const syncSubjects = () => updateRemote('mySubjects', loadMySubjects());
    const syncHistory = () => updateRemoteFields({
      viewedPapers: readStoredArray(VIEWED_PAPERS_STORAGE_KEY),
      completedPapers: readStoredArray(COMPLETED_PAPERS_STORAGE_KEY),
    });
    const syncPracticeRecords = () => updateRemoteFields({
      practiceReviews: loadPracticeReviews(),
      mistakeLog: loadMistakeLog(),
    });

    window.addEventListener('hsc:my-subjects-updated', syncSubjects);
    window.addEventListener('hsc:history-updated', syncHistory);
    window.addEventListener('hsc:study-records-updated', syncPracticeRecords);
    return () => {
      window.removeEventListener('hsc:my-subjects-updated', syncSubjects);
      window.removeEventListener('hsc:history-updated', syncHistory);
      window.removeEventListener('hsc:study-records-updated', syncPracticeRecords);
    };
  }, [updateRemote, updateRemoteFields, user]);

  useEffect(() => {
    if (!user) hasRestoredStudySyncRef.current = false;
  }, [user]);

  useEffect(() => {
    localStorage.setItem('hsc_recommendation_paper_type', recommendationPaperType);
  }, [recommendationPaperType]);

  useEffect(() => {
    localStorage.setItem('hsc_paper_sort', paperSort);
  }, [paperSort]);

  useEffect(() => {
    const refreshRecommendationHistory = () => setRecommendationHistory(loadRecommendationHistory());
    const handleHistoryStorage = (event) => {
      if (event.key === 'hsc_viewed_papers' || event.key === 'hsc_completed_papers') refreshRecommendationHistory();
    };

    window.addEventListener('hsc:history-updated', refreshRecommendationHistory);
    window.addEventListener('storage', handleHistoryStorage);
    return () => {
      window.removeEventListener('hsc:history-updated', refreshRecommendationHistory);
      window.removeEventListener('storage', handleHistoryStorage);
    };
  }, []);

  useEffect(() => {
    if (selectedSubject === null) return;
    if (!subjects[selectedSubject]) return;
    if (mySubjects.length === 0) return;
    if (mySubjects.includes(subjects[selectedSubject])) return;
    setSelectedSubject(null);
  }, [mySubjects, selectedSubject, subjects]);

  // Restore selectedSubject from Firestore (only when URL doesn't already specify a subject)
  const hasRestoredSubject = useRef(false);
  useEffect(() => {
    if (!data || hasRestoredSubject.current) return;
    // Check if URL already specifies a subject — if so, don't override it
    const params = new URLSearchParams(window.location.search || '');
    const hasUrlSubject = params.has('subject');
    if (!hasUrlSubject) {
      if (typeof data.selectedSubject === 'number' || data.selectedSubject === null) {
        setSelectedSubject(data.selectedSubject);
      }
      if (typeof data.selectedLevel === 'number') {
        setSelectedLevel(data.selectedLevel);
      }
    }
    hasRestoredSubject.current = true;
  }, [data]);

  // Reset restoration flag when user logs out so next login restores again
  useEffect(() => {
    if (!user) hasRestoredSubject.current = false;
  }, [user]);

  // Textbooks State
  const [viewTextbooks, setViewTextbooks] = useState(false);

  // History State
  const [viewHistory, setViewHistory] = useState(false);
  const [viewNotebook, setViewNotebook] = useState(false);

  // Calendar State
  const [viewCalendar, setViewCalendar] = useState(false);

  // active Paper for practice room
  const [activePaperId, setActivePaperId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('paper');
  });
  const [locationSnapshot, setLocationSnapshot] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  }));

  // Sidebar controls
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => (
    localStorage.getItem('hsc_sidebar_collapsed') === 'true'
  ));

  useEffect(() => {
    localStorage.setItem('hsc_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Appearance state
  const [appearance, setAppearance] = useState(loadAppearanceSettings);

  useEffect(() => {
    if (data && data.appearance && Object.keys(data.appearance).length > 0) {
      setAppearance(data.appearance);
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(data.appearance));
    }
  }, [data?.appearance]);

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => (
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  ));
  const theme = appearance.mode === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : appearance.mode;
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);

  // Agent Command Center state
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  // Personal API keys are held in browser session storage only; they never enter Firestore.
  const [openRouterSettings, setOpenRouterSettings] = useState(loadOpenRouterSettings);

  // Pagination / continuous loading state
  const [renderLimit, setRenderLimit] = useState(PAPER_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const paperLoadSentinelRef = useRef(null);
  const scrollableContentRef = useRef(null);
  const loadMoreLockRef = useRef(false);
  const loadMoreTimerRef = useRef(null);
  const [shareNotice, setShareNotice] = useState('');
  const shareNoticeTimer = useRef(null);
  const paperReturnToRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const updateSystemPreference = (event) => {
      setSystemPrefersDark(event.matches);
    };

    if (mediaQuery) {
      setSystemPrefersDark(mediaQuery.matches);
      mediaQuery.addEventListener('change', updateSystemPreference);
    }

    return () => {
      if (mediaQuery) {
        mediaQuery.removeEventListener('change', updateSystemPreference);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const presetVars = getAppearanceVars(appearance.preset, theme);
    const accent = ACCENT_OPTIONS[appearance.accent] || ACCENT_OPTIONS[APPEARANCE_DEFAULTS.accent];

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-palette', appearance.preset);
    root.setAttribute('data-density', appearance.density);
    root.setAttribute('data-layout', appearance.layout);

    APPEARANCE_VARIABLE_KEYS.forEach((key) => root.style.removeProperty(key));
    Object.entries(presetVars || {}).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.style.setProperty('--accent-brand', accent.accent);
    root.style.setProperty('--brand-experiment', accent.accent);
    root.style.setProperty('--brand-experiment-hover', accent.hover);
    root.style.setProperty('--brand-experiment-active', accent.active);
    root.style.setProperty('--status-positive', accent.positive);
    root.style.setProperty('--status-positive-background', accent.positive);

    try {
      localStorage.setItem('hsc_theme', theme);
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    } catch (e) {
      // ignore
    }
  }, [appearance, theme]);

  const updateAppearance = useCallback((patch) => {
    setAppearance((current) => {
      const next = { ...current, ...patch };
      updateRemote('appearance', next);
      return next;
    });
    if (patch.portalLayout) onPortalLayoutChange?.(patch.portalLayout);
  }, [onPortalLayoutChange, updateRemote]);


  const updateOpenRouterSettings = useCallback((patch) => {
    setOpenRouterSettings((current) => {
      const next = { ...current, ...patch };
      saveOpenRouterSettings(next);
      return next;
    });
  }, []);

  // Persist selectedSubject to Firestore whenever it changes (after initial restore)
  const prevSelectedSubjectRef = useRef(undefined);
  useEffect(() => {
    if (!user) return;
    if (!hasRestoredSubject.current) return; // don't save before restore completes
    if (prevSelectedSubjectRef.current === selectedSubject) return;
    prevSelectedSubjectRef.current = selectedSubject;
    updateRemote('selectedSubject', selectedSubject);
  }, [selectedSubject, user, updateRemote]);

  // Persist selectedLevel to Firestore whenever it changes
  const prevSelectedLevelRef = useRef(undefined);
  useEffect(() => {
    if (!user) return;
    if (!hasRestoredSubject.current) return;
    if (prevSelectedLevelRef.current === selectedLevel) return;
    prevSelectedLevelRef.current = selectedLevel;
    updateRemote('selectedLevel', selectedLevel);
  }, [selectedLevel, user, updateRemote]);

  useEffect(() => {
    return () => {
      if (shareNoticeTimer.current) clearTimeout(shareNoticeTimer.current);
    };
  }, []);

  const readLocation = () => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  });

  const getPaperIdFromLocation = (location = locationSnapshot) => {
    const params = new URLSearchParams(location.search || '');
    return params.get('paper');
  };

  const getPaperPath = (paper) => {
    const params = new URLSearchParams(window.location.search);
    params.set('paper', getPaperRouteId(paper));
    return `/?${params.toString()}`;
  };

  useEffect(() => {
    const handlePopState = () => {
      setLocationSnapshot(readLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch compiled database
  useEffect(() => {
    fetch('/papers.json')
      .then(res => {
        if (!res.ok) throw new Error("Failed to load paper indexes.");
        return res.json();
      })
      .then(data => {
        setSubjects(data.subjects || []);
        setSchools(data.schools || []);
        setPapers(data.papers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Save Bookmarks to localStorage
  const toggleBookmark = (viewno) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(viewno)) {
        next.delete(viewno);
      } else {
        next.add(viewno);
      }
      const arr = Array.from(next);
      localStorage.setItem('hsc_bookmarks', JSON.stringify(arr));
      updateRemote('bookmarks', arr);
      return next;
    });
  };

  const clearAllBookmarks = () => {
    if (window.confirm("Are you sure you want to clear all your bookmarks?")) {
      setBookmarks(new Set());
      localStorage.removeItem('hsc_bookmarks');
      updateRemote('bookmarks', []);
    }
  };

  /**
   * addCalendarEvent — bridges the agent harness into CustomCalendar's localStorage format.
   * The agent provides { title, date, description, color }; we map to { subject, day, period, topics, weight }.
   */
  const addCalendarEvent = useCallback(({ title, date, description = '', color = 'blue' }) => {
    try {
      const saved = JSON.parse(localStorage.getItem('hsc_assessments') || '[]');
      const newEvent = {
        id: Date.now(),
        subject: title,
        day: date.split('T')[0], // store date-only part
        period: description || 'Agent-scheduled',
        topics: description || title,
        weight: '',
        agentColor: color,
      };
      const next = [...saved, newEvent];
      localStorage.setItem('hsc_assessments', JSON.stringify(next));
      updateRemote('assessments', next);
    } catch (e) {
      console.warn('addCalendarEvent failed:', e);
    }
  }, [updateRemote]);

  const flashShareNotice = (message) => {
    setShareNotice(message);
    if (shareNoticeTimer.current) clearTimeout(shareNoticeTimer.current);
    shareNoticeTimer.current = setTimeout(() => setShareNotice(''), 1800);
  };

  const copyText = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const success = document.execCommand('copy');
    document.body.removeChild(input);
    return success;
  };

  const buildPaperShareUrl = (paper) => {
    const paperId = getPaperRouteId(paper);
    const url = new URL(window.location.origin);
    url.searchParams.set('paper', paperId);
    return url.toString();
  };

  const openPaper = (paper, { replace = false } = {}) => {
    paperReturnToRef.current = readLocation();
    const nextPath = getPaperPath(paper);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
    setLocationSnapshot(readLocation());
    setActivePaperId(getPaperRouteId(paper));
  };

  const closePaper = () => {
    const returnTo = paperReturnToRef.current;
    let nextLocation = returnTo || { pathname: '/', search: '', hash: '' };
    const params = new URLSearchParams(nextLocation.search);
    if (params.has('paper')) params.delete('paper');
    const searchString = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState({}, '', `/${searchString}${nextLocation.hash}`);
    setLocationSnapshot(readLocation());
    setActivePaperId(null);
    paperReturnToRef.current = null;
  };

  const sharePaper = async (paper) => {
    const shareUrl = buildPaperShareUrl(paper);
    const shareData = {
      title: paper.n,
      text: `Open this HSC paper in HSC Portal`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        flashShareNotice('Share sheet opened');
        return;
      }

      await copyText(shareUrl);
      flashShareNotice('Share link copied');
    } catch (e) {
      try {
        await copyText(shareUrl);
        flashShareNotice('Share link copied');
      } catch (copyErr) {
        window.prompt('Copy this share link', shareUrl);
      }
    }
  };

  const paperRouteId = getPaperIdFromLocation(locationSnapshot);

  useEffect(() => {
    if (paperRouteId !== activePaperId) {
      setActivePaperId(paperRouteId);
    }
  }, [paperRouteId, activePaperId]);



  const activePaper = useMemo(() => {
    if (!activePaperId) return null;
    return findPaperByIdentifier(papers, activePaperId);
  }, [papers, activePaperId]);

  // Helper: slugify subject names for path matching
  const slugify = (s) => {
    if (!s) return '';
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Restore selected subject from URL (query param `subject` or path `/slug`)
  useEffect(() => {
    if (!subjects || !subjects.length) return;
    const params = new URLSearchParams(locationSnapshot.search || '');
    const subjectParam = params.get('subject');
    if (subjectParam) {
      const idx = subjects.findIndex(s => slugify(s) === subjectParam);
      if (idx !== -1) setSelectedSubject(idx);
      return;
    }

    setSelectedSubject(null);
  }, [subjects, locationSnapshot.search]);

  // Update query string when selectedSubject changes
  useEffect(() => {
    if (paperRouteId) return;

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    
    if (selectedSubject === null) {
      if (params.has('subject')) {
        params.delete('subject');
        const searchString = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState({}, '', `/${searchString}${url.hash}`);
        setLocationSnapshot(readLocation());
      }
      return;
    }
    const subjName = subjects[selectedSubject];
    if (!subjName) return;
    const slug = slugify(subjName);
    if (params.get('subject') !== slug) {
      params.set('subject', slug);
      const searchString = params.toString() ? `?${params.toString()}` : '';
      window.history.replaceState({}, '', `/${searchString}${url.hash}`);
      setLocationSnapshot(readLocation());
    }
  }, [selectedSubject, subjects, paperRouteId]);

  // Reset the visible result window whenever the home-screen view changes.
  useEffect(() => {
    setRenderLimit(PAPER_PAGE_SIZE);
    setIsLoadingMore(false);
    loadMoreLockRef.current = false;
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
  }, [
    selectedSubject,
    selectedLevel,
    paperSearchQuery,
    paperSort,
    viewBookmarks,
    viewTextbooks,
    viewHistory,
    viewCalendar,
    isAgentOpen
  ]);

  // Compute subject counts based on current level dynamically
  const subjectCounts = useMemo(() => {
    const counts = {};
    papers.forEach(p => {
      if (p.l === selectedLevel) {
        counts[p.s] = (counts[p.s] || 0) + 1;
      }
    });
    return counts;
  }, [papers, selectedLevel]);

  const subjectFilterIds = useMemo(() => {
    if (!subjects.length) return new Set();
    if (selectedSubject !== null && mySubjects.includes(subjects[selectedSubject])) {
      return new Set([selectedSubject]);
    }

    return new Set(
      mySubjects
        .map((name) => subjects.indexOf(name))
        .filter((idx) => idx !== -1)
    );
  }, [mySubjects, selectedSubject, subjects]);

  const matchesSubjectFilter = useCallback((paper) => {
    if (subjectFilterIds.size === 0) return true;
    return subjectFilterIds.has(paper.s);
  }, [subjectFilterIds]);

  // Filter papers array
  const filteredPapers = useMemo(() => {
    const searchTerms = paperSearchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return papers.filter((p) => {
      // 1. Level filter (Prelim vs HSC) - ignore if viewing bookmarks
      if (!viewBookmarks && p.l !== selectedLevel) return false;

      // 2. Bookmarked filter
      if (viewBookmarks && !bookmarks.has(p.v + '_' + p.n)) return false;

      // 3. Subject filter
      if (!matchesSubjectFilter(p)) return false;

      // 4. Standard search: match every typed term against the paper metadata.
      if (searchTerms.length > 0) {
        const category = p.c === 'H'
          ? 'official hsc'
          : p.c === 'T'
            ? 'trial exam'
            : p.c === 'A'
              ? 'assessment task'
              : '';
        const searchable = [
          p.n,
          subjects[p.s],
          schools[p.h],
          p.y,
          category,
          p.w === 1 ? 'solutions answers' : '',
        ].join(' ').toLowerCase();

        if (!searchTerms.every((term) => searchable.includes(term))) return false;
      }

      return true;
    });
  }, [
    papers,
    selectedSubject,
    selectedLevel,
    viewBookmarks,
    bookmarks,
    paperSearchQuery,
    subjects,
    schools,
    matchesSubjectFilter
  ]);

  const sortedPapers = useMemo(() => {
    const list = [...filteredPapers];
    const compareText = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    const compareNewest = (a, b) => {
      const yearDelta = (parseInt(String(b.y), 10) || -1) - (parseInt(String(a.y), 10) || -1);
      return yearDelta || compareText(a.n, b.n) || compareText(a.v, b.v);
    };

    list.sort((a, b) => {
      if (paperSort === 'oldest') return -compareNewest(a, b);
      if (paperSort === 'title') return compareText(a.n, b.n) || compareNewest(a, b);
      if (paperSort === 'school') return compareText(schools[a.h], schools[b.h]) || compareText(a.n, b.n) || compareNewest(a, b);
      return compareNewest(a, b);
    });
    return list;
  }, [filteredPapers, paperSort, schools]);

  const visiblePaperRows = useMemo(() => (
    sortedPapers.map((paper) => ({ paper, matchReasons: [] }))
  ), [sortedPapers]);

  const hasRecommendationSubjectScope = selectedSubject !== null || mySubjects.length > 0;
  const recommendationSubjectScopeLabel = selectedSubject !== null
    ? subjects[selectedSubject] || 'your selected subject'
    : mySubjects.length === 1
      ? mySubjects[0]
      : `${mySubjects.length} selected subjects`;

  const adaptiveRecommendations = useMemo(() => getAdaptiveRecommendations({
    papers,
    subjects,
    selectedLevel,
    selectedSubject,
    mySubjects,
    bookmarks,
    viewed: recommendationHistory.viewed,
    completed: recommendationHistory.completed,
    paperType: recommendationPaperType,
    requireSubjectScope: true,
    limit: 3,
  }), [
    papers,
    subjects,
    selectedLevel,
    selectedSubject,
    mySubjects,
    bookmarks,
    recommendationHistory,
    recommendationPaperType,
  ]);

  const resetFilters = () => {
    setSelectedSubject(null);
    setPaperSearchQuery('');
  };

  const paginatedPaperRows = visiblePaperRows.slice(0, renderLimit);
  const hasMorePaperRows = renderLimit < visiblePaperRows.length;

  const loadNextPaperPage = useCallback(() => {
    if (!hasMorePaperRows || loadMoreLockRef.current) return;

    loadMoreLockRef.current = true;
    setIsLoadingMore(true);
    setRenderLimit((current) => Math.min(current + PAPER_PAGE_SIZE, visiblePaperRows.length));

    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    loadMoreTimerRef.current = setTimeout(() => {
      setIsLoadingMore(false);
      loadMoreLockRef.current = false;
    }, 180);
  }, [hasMorePaperRows, visiblePaperRows.length]);

  useEffect(() => {
    const target = paperLoadSentinelRef.current;
    const scrollRoot = scrollableContentRef.current;
    const canObserve = typeof window !== 'undefined' && 'IntersectionObserver' in window;
    const isHomePaperView = !loading && !error && !viewCalendar && !viewTextbooks && !viewHistory && !viewNotebook;

    if (!target || !scrollRoot || !canObserve || !isHomePaperView || !hasMorePaperRows) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadNextPaperPage();
      },
      { root: scrollRoot, rootMargin: '360px 0px', threshold: 0.01 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, error, viewCalendar, viewTextbooks, viewHistory, viewNotebook, hasMorePaperRows, loadNextPaperPage]);

  useEffect(() => () => {
    if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
  }, []);

  const currentViewLabel = viewCalendar
    ? 'Assessment calendar'
    : viewTextbooks
      ? 'Textbooks'
      : viewBookmarks
        ? 'Saved library'
        : viewHistory
          ? 'Paper History'
          : viewNotebook
            ? 'Mistake Notebook'
            : 'HSC past papers';

  const currentViewDescription = viewCalendar
    ? 'Track assessment dates and keep the term visible at a glance.'
    : viewTextbooks
      ? 'Open subject texts and reference material from one quiet library.'
      : viewBookmarks
        ? 'Return to the papers you have saved for practice.'
        : viewHistory
          ? 'Papers you opened and those you marked complete.'
          : viewNotebook
            ? 'Review your practice, capture useful mistakes, and turn them into next steps.'
            : 'Browse official papers, trial exams, and resources without the clutter.';

  if (paperRouteId) {
    if (loading) {
        return (
          <div className="practice-surface animate-fade-in" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
            <div className="surface-card" style={{ padding: '24px', textAlign: 'center' }}>
              <RefreshCw size={28} color="var(--text-muted)" className="spin" />
              <h3 style={{ marginTop: '12px', color: 'var(--header-primary)' }}>Loading paper</h3>
            </div>
            <Analytics />
          </div>
        );
    }

    if (error) {
        return (
          <div className="practice-surface animate-fade-in" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
            <div className="surface-card" style={{ padding: '24px', maxWidth: '640px', width: '100%' }}>
              <h3 style={{ marginBottom: '8px', color: 'var(--status-danger)' }}>Could not open this paper</h3>
              <p>{error}</p>
              <button type="button" className="btn-primary" style={{ marginTop: '16px' }} onClick={closePaper}>
                Back to home
              </button>
            </div>
            <Analytics />
          </div>
        );
    }

    if (!activePaper) {
        return (
          <div className="practice-surface animate-fade-in" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
            <div className="surface-card" style={{ padding: '24px', maxWidth: '640px', width: '100%' }}>
              <h3 style={{ marginBottom: '8px', color: 'var(--header-primary)' }}>Paper not found</h3>
              <p>This paper link does not match a resource in the library.</p>
              <button type="button" className="btn-primary" style={{ marginTop: '16px' }} onClick={closePaper}>
                Back to home
              </button>
            </div>
            <Analytics />
          </div>
        );
    }

    return (
      <>
        <PracticeRoom
          paper={activePaper}
          subjectName={subjects[activePaper.s]}
          schoolName={schools[activePaper.h]}
          onClose={closePaper}
          allPapers={papers}
          subjects={subjects}
          schools={schools}
          onSharePaper={() => sharePaper(activePaper)}
          onSelectPaper={openPaper}
          agentContext={{
            papers,
            subjects,
            schools,
            bookmarks,
            toggleBookmark,
            addCalendarEvent,
            selectedLevel,
            openRouterSettings,
          }}
        />
      </>
    );
  }

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-visible' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`app-sidebar ${isSidebarOpen ? 'sidebar-visible' : ''}`}>
        <Sidebar
          subjects={subjects}
          mySubjects={mySubjects}
          selectedSubject={selectedSubject}
          setSelectedSubject={setSelectedSubject}
          selectedLevel={selectedLevel}
          setSelectedLevel={setSelectedLevel}
          viewBookmarks={viewBookmarks}
          setViewBookmarks={setViewBookmarks}
          viewTextbooks={viewTextbooks}
          setViewTextbooks={setViewTextbooks}
          viewCalendar={viewCalendar}
          setViewCalendar={setViewCalendar}
          viewNotebook={viewNotebook}
          setViewNotebook={setViewNotebook}
          bookmarksCount={bookmarks.size}
          totalPapersCount={papers.length}
          subjectCounts={subjectCounts}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          onCloseMobile={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Panel Area */}
      <main
        className="main-content"
        onClick={() => { if (isSidebarOpen && window.innerWidth <= 768) setIsSidebarOpen(false); }}
      >
        <div className="topbar">
          <div className="topbar-title">
            <button
              className="mobile-menu-btn"
              onClick={() => setIsSidebarOpen((s) => !s)}
              aria-label="Toggle menu"
            >
              <Menu size={18} />
            </button>
            {viewCalendar ? (
              <Calendar size={20} color="var(--brand-experiment)" />
            ) : viewTextbooks ? (
              <Book size={20} color="var(--brand-experiment)" />
            ) : viewNotebook ? (
              <BookOpenCheck size={20} color="var(--brand-experiment)" />
            ) : (
              <Library size={20} color="var(--brand-experiment)" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="topbar-subtitle">HSC Portal</div>
              <h1>{currentViewLabel}</h1>
            </div>
          </div>

          <div className="control-group">
            <UserButton />
            {shareNotice && (
              <span className="pill subtle" style={{ padding: '8px 12px' }}>{shareNotice}</span>
            )}

            <button
              type="button"
              onClick={() => setIsAgentOpen(true)}
              className="btn-secondary"
              id="agent-command-center-trigger"
              style={{ padding: '10px 12px', color: 'var(--brand-experiment)' }}
              title="Open AI Agent"
            >
              <BotMessageSquare size={16} />
              <span>AI Agent</span>
            </button>
            <button
              type="button"
              onClick={() => updateAppearance({ mode: theme === 'dark' ? 'light' : 'dark' })}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizationOpen(true)}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title="Open customisation menu"
            >
              <Palette size={16} />
              <span>Customise</span>
            </button>
            {viewBookmarks && bookmarks.size > 0 && (
              <button
                onClick={clearAllBookmarks}
                className="btn-secondary"
                style={{ padding: '10px 12px', color: 'var(--status-danger)' }}
                title="Clear all bookmarks"
              >
                <Trash2 size={16} />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setViewHistory((v) => !v);
                // close other special views when opening history
                if (!viewHistory) {
                  setViewTextbooks(false);
                  setViewCalendar(false);
                  setViewBookmarks(false);
                  setViewNotebook(false);
                }
              }}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title="Open Paper History"
            >
              <Clock size={16} />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewNotebook((isOpen) => !isOpen);
                if (!viewNotebook) {
                  setViewHistory(false);
                  setViewTextbooks(false);
                  setViewCalendar(false);
                  setViewBookmarks(false);
                }
              }}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title="Open Mistake Notebook"
            >
              <BookOpenCheck size={16} />
              <span>Notebook</span>
            </button>
          </div>
        </div>

        <CustomizationMenu
          isOpen={isCustomizationOpen}
          settings={appearance}
          onChange={updateAppearance}
          aiSettings={openRouterSettings}
          onAiSettingsChange={updateOpenRouterSettings}
          onClose={() => setIsCustomizationOpen(false)}
        />

        <div className="scrollable-content" ref={scrollableContentRef}>
          <div className="content-stack">
            {viewCalendar ? (
              <CustomCalendar />
            ) : viewTextbooks ? (
              <TextbooksView />
            ) : viewHistory ? (
              <PaperHistory
                allPapers={papers}
                subjects={subjects}
                schools={schools}
                onSelectPaper={openPaper}
              />
            ) : viewNotebook ? (
              <StudyNotebook onSelectPaper={(paperId) => {
                const matchingPaper = findPaperByIdentifier(papers, paperId);
                if (matchingPaper) openPaper(matchingPaper);
              }} />
            ) : (
              <>
                <section className="hero-band">
                  <div className="hero-stack">
                    <div className="hero-title">
                      <div className="eyebrow">{viewBookmarks ? 'Saved library' : 'Study workspace'}</div>
                       {viewBookmarks && (
                        <h2 className="page-title">
                          Your saved papers, ready when you are.
                        </h2>
                      )}
                      <p className="page-copy">
                        {viewBookmarks
                          ? `You have ${bookmarks.size.toLocaleString()} saved paper${bookmarks.size === 1 ? '' : 's'}.`
                          : currentViewDescription}
                      </p>
                    </div>

                    <div className="metric-grid">
                      <div className="metric-card">
                        <div className="metric-label">Resources</div>
                        <div className="metric-value">{papers.length.toLocaleString()}</div>
                        <div className="metric-note">Official papers, trials, and tasks</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Bookmarked</div>
                        <div className="metric-value">{bookmarks.size.toLocaleString()}</div>
                        <div className="metric-note">Saved for quick return</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Current view</div>
                        <div className="metric-value" style={{ fontSize: '18px', lineHeight: 1.2, marginTop: '14px' }}>
                          {currentViewLabel}
                        </div>
                        <div className="metric-note">Switch subjects or modes from the left rail</div>
                      </div>
                    </div>

                    {!viewBookmarks && !viewTextbooks && selectedLevel === 12 && (
                      <ExamCountdown
                        subjectName={selectedSubject !== null ? subjects[selectedSubject] : null}
                        portalSubjects={subjects}
                      />
                    )}
                  </div>
                </section>

                <section className="content-band">
                  {!viewBookmarks && appearance.showRecommendations && !paperSearchQuery.trim() && !loading && !error && (
                    <AdaptiveRecommendations
                      recommendations={adaptiveRecommendations}
                      subjects={subjects}
                      schools={schools}
                      bookmarks={bookmarks}
                      paperType={recommendationPaperType}
                      subjectScopeLabel={recommendationSubjectScopeLabel}
                      hasSubjectScope={hasRecommendationSubjectScope}
                      onPaperTypeChange={setRecommendationPaperType}
                      onToggleBookmark={(paper) => toggleBookmark(paper.v + '_' + paper.n)}
                      onOpenPaper={openPaper}
                    />
                  )}

                  <PaperSearch
                    value={paperSearchQuery}
                    onChange={setPaperSearchQuery}
                    sortBy={paperSort}
                    onSortChange={setPaperSort}
                    sortOptions={PAPER_SORT_OPTIONS}
                    disabled={loading}
                  />

                  {loading ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 0',
                      gap: '16px'
                    }}>
                      <RefreshCw size={28} color="var(--text-muted)" className="spin" />
                      <h3 style={{ color: 'var(--text-normal)' }}>Loading resources</h3>
                    </div>
                  ) : error ? (
                    <div style={{ padding: '24px', background: 'rgba(163,61,61,0.08)', borderRadius: '16px', color: 'var(--header-primary)', border: '1px solid rgba(163,61,61,0.16)' }}>
                      <h3 style={{ marginBottom: '8px', color: 'var(--status-danger)' }}>Load error</h3>
                      <p>{error}</p>
                    </div>
                  ) : (
                    <>
                      <div className="results-header">
                        <span>
                          {visiblePaperRows.length.toLocaleString()} matches
                          {selectedSubject !== null && ` in ${subjects[selectedSubject]}`}
                          {paperSearchQuery.trim() && ` for “${paperSearchQuery.trim()}”`}
                        </span>
                        <span>Showing {Math.min(renderLimit, visiblePaperRows.length).toLocaleString()}</span>
                      </div>

                      {visiblePaperRows.length > 0 ? (
                        <div className="papers-grid">
                          {paginatedPaperRows.map(({ paper }, idx) => (
                            <PaperCard
                              key={`${paper.v}-${idx}`}
                              paper={paper}
                              subjectName={subjects[paper.s]}
                              schoolName={schools[paper.h]}
                              isBookmarked={bookmarks.has(paper.v + '_' + paper.n)}
                              toggleBookmark={() => toggleBookmark(paper.v + '_' + paper.n)}
                              sharePaper={() => sharePaper(paper)}
                              onSelectPaper={openPaper}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <h3 style={{ color: 'var(--header-primary)', marginBottom: '8px' }}>
                            No matching papers
                          </h3>
                          <p style={{ marginBottom: '16px' }}>
                            {paperSearchQuery.trim()
                              ? `No papers match “${paperSearchQuery.trim()}”. Try a shorter search or clear your filters.`
                              : 'Try resetting your filters or choosing a different subject.'}
                          </p>
                          <button onClick={resetFilters} className="btn-primary">
                            Reset filters
                          </button>
                        </div>
                      )}

                      {visiblePaperRows.length > 0 && (
                        <div
                          ref={paperLoadSentinelRef}
                          aria-live="polite"
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', margin: '28px 0 48px', minHeight: '44px', color: 'var(--text-muted)', fontSize: '13px' }}
                        >
                          {hasMorePaperRows ? (
                            <>
                              {isLoadingMore ? (
                                <>
                                  <RefreshCw size={16} className="spin" aria-hidden="true" />
                                  <span>Loading more papers…</span>
                                </>
                              ) : (
                                <span>Keep scrolling to load more papers</span>
                              )}
                              <button
                                type="button"
                                onClick={loadNextPaperPage}
                                className="btn-secondary"
                                disabled={isLoadingMore}
                                style={{ padding: '8px 12px', fontSize: '12px' }}
                              >
                                Load next {Math.min(PAPER_PAGE_SIZE, visiblePaperRows.length - renderLimit).toLocaleString()} papers
                              </button>
                            </>
                          ) : (
                            <span>All {visiblePaperRows.length.toLocaleString()} matching papers are loaded.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </main>

            {/* Vercel Web Analytics */}
      <Analytics />

      {/* AI Agent Command Center */}
      <AgentCommandCenter
        isOpen={isAgentOpen}
        onClose={() => setIsAgentOpen(false)}
        appContext={{
          papers,
          subjects,
          schools,
          bookmarks,
          toggleBookmark,
          addCalendarEvent,
          selectedLevel,
          openRouterSettings,
        }}
      />

    </div>
  );
}
