import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Filters from './components/Filters';
import PaperCard from './components/PaperCard';
import PracticeRoom from './components/PracticeRoom';
import TextbooksView from './components/TextbooksView';
import ExamCountdown from './components/ExamCountdown';
import CustomCalendar from './components/CustomCalendar';
import AgenticPaperFinder from './components/AgenticPaperFinder';
import { Library, RefreshCw, Trash2, Book, Menu, Calendar, Moon, Sun, Clock } from 'lucide-react';
import PaperHistory from './components/PaperHistory';
import { Analytics } from '@vercel/analytics/react';
import { findAgenticPaperMatchesAsync } from './utils/agenticPaperSearch';
import { findPaperByIdentifier, getPaperRouteId } from './utils/paperIdentity';
import './App.css';

export default function App() {
  // DB States
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(12); // Year 12 (HSC) by default
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [solutionsOnly, setSolutionsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearSort, setYearSort] = useState('desc'); // desc = newest first, asc = oldest first, none = default order
  const [agentQuery, setAgentQuery] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState({
    intent: {},
    papers: [],
    total: 0,
    applied: false,
    summary: '',
    isAiAssisted: false,
  });

  // Bookmarks State
  const [viewBookmarks, setViewBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('hsc_bookmarks');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Textbooks State
  const [viewTextbooks, setViewTextbooks] = useState(false);

  // History State
  const [viewHistory, setViewHistory] = useState(false);

  // Calendar State
  const [viewCalendar, setViewCalendar] = useState(false);

  // active Paper for practice room
  const [activePaperId, setActivePaperId] = useState(() => {
    const pathMatch = window.location.pathname.match(/^\/paper\/([^/]+)\/?$/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

    const params = new URLSearchParams(window.location.search);
    return params.get('paper');
  });
  const [locationSnapshot, setLocationSnapshot] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  }));

  // Mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('hsc_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      // ignore
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Pagination Limit
  const [renderLimit, setRenderLimit] = useState(40);
  const [shareNotice, setShareNotice] = useState('');
  const shareNoticeTimer = useRef(null);
  const paperReturnToRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('hsc_theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

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
    const pathMatch = location.pathname.match(/^\/paper\/([^/]+)\/?$/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

    const params = new URLSearchParams(location.search || '');
    return params.get('paper');
  };

  const getPaperPath = (paper) => `/paper/${getPaperRouteId(paper)}/`;

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
        // Filter out HSC category ('H') because HSC papers currently do not open
        const nonHscPapers = (data.papers || []).filter(p => p.c !== 'H');
        setPapers(nonHscPapers);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Async Agentic Search Trigger
  useEffect(() => {
    let active = true;
    const query = agentQuery.trim();

    if (!query) {
      setAgentResult({
        intent: {},
        papers: [],
        total: 0,
        applied: false,
        summary: '',
        isAiAssisted: false,
      });
      setAgentLoading(false);
      return;
    }

    setAgentLoading(true);
    findAgenticPaperMatchesAsync(query, papers, subjects, schools, { defaultLevel: selectedLevel })
      .then((res) => {
        if (!active) return;
        setAgentResult(res);
        setAgentLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Agentic search error:', err);
        setAgentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [agentQuery, papers, subjects, schools, selectedLevel]);

  // Save Bookmarks to localStorage
  const toggleBookmark = (viewno) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(viewno)) {
        next.delete(viewno);
      } else {
        next.add(viewno);
      }
      localStorage.setItem('hsc_bookmarks', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const clearAllBookmarks = () => {
    if (window.confirm("Are you sure you want to clear all your bookmarks?")) {
      setBookmarks(new Set());
      localStorage.removeItem('hsc_bookmarks');
    }
  };

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
    return new URL(getPaperPath(paper), window.location.origin).toString();
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
    const nextLocation = returnTo || { pathname: '/', search: '', hash: '' };
    window.history.replaceState({}, '', `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`);
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

  useEffect(() => {
    if (!paperRouteId) return;

    const canonicalPath = `/paper/${encodeURIComponent(String(paperRouteId))}/`;
    if (locationSnapshot.pathname !== canonicalPath || locationSnapshot.search || locationSnapshot.hash) {
      window.history.replaceState({}, '', canonicalPath);
      setLocationSnapshot(readLocation());
    }
  }, [paperRouteId, locationSnapshot.pathname, locationSnapshot.search, locationSnapshot.hash]);

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

    // check path-based subject: e.g. /physics
    const path = locationSnapshot.pathname || '/';
    const seg = path.replace(/^\//, '').replace(/\/$/, '');
    if (seg) {
      const idx = subjects.findIndex(s => slugify(s) === seg);
      if (idx !== -1) setSelectedSubject(idx);
      return;
    }

    setSelectedSubject(null);
  }, [subjects, locationSnapshot.pathname, locationSnapshot.search]);

  // Update pathname when selectedSubject changes so URL reflects current subject
  useEffect(() => {
    if (paperRouteId) return;

    const url = new URL(window.location.href);
    const currentPath = url.pathname || '/';
    if (selectedSubject === null) {
      // revert to root
      if (currentPath !== '/') {
        window.history.replaceState({}, '', '/');
        setLocationSnapshot(readLocation());
      }
      return;
    }
    const subjName = subjects[selectedSubject];
    if (!subjName) return;
    const slug = slugify(subjName);
    const desiredPath = `/${slug}/`;
    if (currentPath !== desiredPath) {
      // preserve existing search (e.g., ?paper=123)
      const search = url.search || '';
      window.history.replaceState({}, '', `${desiredPath}${search}${url.hash}`);
      setLocationSnapshot(readLocation());
    }
  }, [selectedSubject, subjects, paperRouteId]);

  // Reset pagination limit when filters change
  useEffect(() => {
    setRenderLimit(40);
  }, [
    selectedSubject,
    selectedLevel,
    selectedCategory,
    selectedSchool,
    selectedYear,
    yearSort,
    solutionsOnly,
    searchQuery,
    agentQuery,
    viewBookmarks,
    viewTextbooks,
    viewHistory,
    viewCalendar
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

  // Extract unique active years for select box (descending order)
  const activeYears = useMemo(() => {
    const yearsSet = new Set();
    papers.forEach(p => {
      if (p.l === selectedLevel && p.y !== "Other") {
        yearsSet.add(p.y.toString());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [papers, selectedLevel]);

  // Filter papers array
  const filteredPapers = useMemo(() => {
    return papers.filter(p => {
      // 1. Level filter (Prelim vs HSC) - ignore if viewing bookmarks
      if (!viewBookmarks && p.l !== selectedLevel) return false;
      
      // 2. Bookmarked filter
      if (viewBookmarks && !bookmarks.has(p.v + '_' + p.n)) return false;
      
      // 3. Subject filter
      if (selectedSubject !== null && p.s !== selectedSubject) return false;
      
      // 4. Category filter
      if (selectedCategory !== null && p.c !== selectedCategory) return false;
      
      // 5. School filter
      if (selectedSchool !== null && p.h !== selectedSchool) return false;
      
      // 6. Year filter
      if (selectedYear !== null && p.y.toString() !== selectedYear) return false;
      
      // 7. Solutions filter
      if (solutionsOnly && p.w !== 1) return false;
      
      // 8. Search Query match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const sName = subjects[p.s]?.toLowerCase() || '';
        const hName = schools[p.h]?.toLowerCase() || '';
        const pName = p.n.toLowerCase();
        const yVal = p.y.toString();
        
        const matchesQuery = pName.includes(query) || 
                             sName.includes(query) || 
                             hName.includes(query) || 
                             yVal.includes(query);
                             
        if (!matchesQuery) return false;
      }
      
      return true;
    });
  }, [
    papers,
    subjects,
    schools,
    selectedSubject,
    selectedLevel,
    selectedCategory,
    selectedSchool,
    selectedYear,
    solutionsOnly,
    searchQuery,
    viewBookmarks,
    bookmarks
  ]);

  const getYearSortValue = (year) => {
    const n = parseInt(String(year), 10);
    return Number.isFinite(n) ? n : -1;
  };

  const sortedPapers = useMemo(() => {
    if (yearSort === 'none') return filteredPapers;
    const list = [...filteredPapers];
    list.sort((a, b) => {
      const ya = getYearSortValue(a.y);
      const yb = getYearSortValue(b.y);
      return yearSort === 'desc' ? yb - ya : ya - yb;
    });
    return list;
  }, [filteredPapers, yearSort]);

  const agentSearchActive = agentResult.applied;

  const visiblePaperRows = useMemo(() => {
    if (agentSearchActive) {
      return agentResult.papers.map((item) => ({
        paper: item.paper,
        matchReasons: item.reasons,
      }));
    }

    return sortedPapers.map((paper) => ({
      paper,
      matchReasons: [],
    }));
  }, [agentResult, agentSearchActive, sortedPapers]);

  const hasActiveFilters = 
    selectedSubject !== null || 
    selectedCategory !== null || 
    selectedSchool !== null || 
    selectedYear !== null || 
    yearSort !== 'desc' ||
    solutionsOnly || 
    searchQuery !== '' ||
    agentQuery.trim() !== '';

  const resetFilters = () => {
    setSelectedSubject(null);
    setSelectedCategory(null);
    setSelectedSchool(null);
    setSelectedYear(null);
    setYearSort('desc');
    setSolutionsOnly(false);
    setSearchQuery('');
    setAgentQuery('');
  };

  const paginatedPaperRows = visiblePaperRows.slice(0, renderLimit);
  const currentViewLabel = viewCalendar
    ? 'Assessment calendar'
    : viewTextbooks
      ? 'Textbooks'
      : viewBookmarks
        ? 'Saved library'
        : viewHistory
          ? 'Paper History'
          : 'HSC past papers';

  const currentViewDescription = viewCalendar
    ? 'Track assessment dates and keep the term visible at a glance.'
    : viewTextbooks
      ? 'Open subject texts and reference material from one quiet library.'
      : viewBookmarks
        ? 'Return to the papers you have saved for practice.'
        : viewHistory
          ? 'Papers you opened and those you marked complete.'
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
        />
    );
  }

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-visible' : ''}`}>
      
      {/* Sidebar Navigation (Server List & Channel List) */}
      <Sidebar
        subjects={subjects}
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
        bookmarksCount={bookmarks.size}
        totalPapersCount={papers.length}
        subjectCounts={subjectCounts}
      />

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
            ) : (
              <Library size={20} color="var(--brand-experiment)" />
            )}
            <div style={{ minWidth: 0 }}>
              <div className="topbar-subtitle">HSC Portal</div>
              <h1>{currentViewLabel}</h1>
            </div>
          </div>

          <div className="control-group">
            {shareNotice && (
              <span className="pill subtle" style={{ padding: '8px 12px' }}>{shareNotice}</span>
            )}

            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
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
                }
              }}
              className="btn-secondary"
              style={{ padding: '10px 12px' }}
              title="Open Paper History"
            >
              <Clock size={16} />
              <span>History</span>
            </button>
          </div>
        </div>

        <div className="scrollable-content">
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
                  {!viewBookmarks && (
                    <AgenticPaperFinder
                      value={agentQuery}
                      onSearch={(query) => setAgentQuery(query.trim())}
                      onClear={() => setAgentQuery('')}
                      result={agentResult}
                      disabled={loading || agentLoading}
                      loading={agentLoading}
                    />
                  )}

                  <div className="tool-strip" style={{ marginBottom: '14px' }}>
                    <div>
                      <div className="eyebrow">Filters</div>
                      <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                        Narrow by type, year, school, and solution status.
                      </p>
                    </div>
                    {!viewTextbooks && !viewCalendar && (
                      <Filters
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        selectedSchool={selectedSchool}
                        setSelectedSchool={setSelectedSchool}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                        yearSort={yearSort}
                        setYearSort={setYearSort}
                        solutionsOnly={solutionsOnly}
                        setSolutionsOnly={setSolutionsOnly}
                        schools={schools}
                        years={activeYears}
                        resetFilters={resetFilters}
                        hasActiveFilters={hasActiveFilters}
                      />
                    )}
                  </div>

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
                          {!agentSearchActive && selectedSubject !== null && ` in ${subjects[selectedSubject]}`}
                          {agentSearchActive && ' ranked by agent finder'}
                        </span>
                        <span>Showing {Math.min(renderLimit, visiblePaperRows.length).toLocaleString()}</span>
                      </div>

                      {visiblePaperRows.length > 0 ? (
                        <div className="papers-grid">
                          {paginatedPaperRows.map(({ paper, matchReasons }, idx) => (
                            <PaperCard
                              key={`${paper.v}-${idx}`}
                              paper={paper}
                              subjectName={subjects[paper.s]}
                              schoolName={schools[paper.h]}
                              isBookmarked={bookmarks.has(paper.v + '_' + paper.n)}
                              toggleBookmark={() => toggleBookmark(paper.v + '_' + paper.n)}
                              sharePaper={() => sharePaper(paper)}
                              onSelectPaper={openPaper}
                              matchReasons={matchReasons}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <h3 style={{ color: 'var(--header-primary)', marginBottom: '8px' }}>
                            {agentSearchActive ? 'Agent couldn\'t find matches' : 'No matches found'}
                          </h3>
                          <p style={{ marginBottom: '16px' }}>
                            {agentSearchActive
                              ? `No papers matched "${agentQuery}". Try rephrasing or use the normal filters.`
                              : 'Try resetting your filters or searching for different terms.'}
                          </p>
                          <button onClick={resetFilters} className="btn-primary">
                            Reset filters
                          </button>
                        </div>
                      )}

                      {visiblePaperRows.length > renderLimit && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '28px 0 48px' }}>
                          <button
                            onClick={() => setRenderLimit((prev) => prev + 40)}
                            className="btn-secondary"
                          >
                            Load more papers
                          </button>
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

    </div>
  );
}
