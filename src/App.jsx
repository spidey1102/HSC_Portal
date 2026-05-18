import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Filters from './components/Filters';
import PaperCard from './components/PaperCard';
import PracticeRoom from './components/PracticeRoom';
import { Sparkles, Library, RefreshCw, Star, Trash2 } from 'lucide-react';
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

  // Bookmarks State
  const [viewBookmarks, setViewBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('hsc_bookmarks');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // active Paper for practice room
  const [activePaper, setActivePaper] = useState(null);

  // Pagination Limit
  const [renderLimit, setRenderLimit] = useState(40);

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

  // Reset pagination limit when filters change
  useEffect(() => {
    setRenderLimit(40);
  }, [
    selectedSubject,
    selectedLevel,
    selectedCategory,
    selectedSchool,
    selectedYear,
    solutionsOnly,
    searchQuery,
    viewBookmarks
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

  const hasActiveFilters = 
    selectedSubject !== null || 
    selectedCategory !== null || 
    selectedSchool !== null || 
    selectedYear !== null || 
    solutionsOnly || 
    searchQuery !== '';

  const resetFilters = () => {
    setSelectedSubject(null);
    setSelectedCategory(null);
    setSelectedSchool(null);
    setSelectedYear(null);
    setSolutionsOnly(false);
    setSearchQuery('');
  };

  const paginatedPapers = filteredPapers.slice(0, renderLimit);

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <Sidebar
        subjects={subjects}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
        selectedLevel={selectedLevel}
        setSelectedLevel={setSelectedLevel}
        viewBookmarks={viewBookmarks}
        setViewBookmarks={setViewBookmarks}
        bookmarksCount={bookmarks.size}
        totalPapersCount={papers.length}
        subjectCounts={subjectCounts}
      />

      {/* Main Panel Area */}
      <main className="main-content">
        
        {/* Header Title Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Library size={18} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HSC Past Papers Portal
              </span>
            </div>
            <h1 style={{ fontSize: '2.5rem', lineHeight: '1.1' }}>
              {viewBookmarks ? (
                <span className="gradient-text">Saved Library</span>
              ) : (
                <>
                  Practice for <span className="gradient-text">Success</span>
                </>
              )}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem' }}>
              {viewBookmarks 
                ? `You have saved ${bookmarks.size} papers for practice.`
                : `Instant search & filter over 45,500+ official NESA past papers and school trial exams.`}
            </p>
          </div>

          {/* Bookmarks Quick Clear Action */}
          {viewBookmarks && bookmarks.size > 0 && (
            <button
              onClick={clearAllBookmarks}
              className="btn-secondary"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.05)',
                gap: '8px'
              }}
            >
              <Trash2 size={16} />
              <span>Clear All Bookmarks</span>
            </button>
          )}
        </div>

        {/* Dynamic loading view */}
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            minHeight: '400px',
            gap: '16px'
          }}>
            <RefreshCw size={48} className="pulse-glow" color="var(--accent-indigo)" style={{ animation: 'spin 2s linear infinite' }} />
            <h3 style={{ fontWeight: '500' }}>Assembling resource indexing database...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Optimizing 45,000+ trial documents for client-side search</p>
          </div>
        ) : error ? (
          <div className="glass" style={{ padding: '32px', textAlign: 'center', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h2>Database Load Error</h2>
            <p style={{ marginTop: '12px' }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Filters panel bar */}
            <Filters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedSchool={selectedSchool}
              setSelectedSchool={setSelectedSchool}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              solutionsOnly={solutionsOnly}
              setSolutionsOnly={setSolutionsOnly}
              schools={schools}
              years={activeYears}
              resetFilters={resetFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* Results Counters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>
                Found <strong style={{ color: 'white' }}>{filteredPapers.length.toLocaleString()}</strong> matches
                {selectedSubject !== null && ` for ${subjects[selectedSubject]}`}
              </span>
              <span>
                Showing first {Math.min(renderLimit, filteredPapers.length).toLocaleString()}
              </span>
            </div>

            {/* Papers Grid */}
            {filteredPapers.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px'
              }}>
                {paginatedPapers.map((paper, idx) => (
                  <PaperCard
                    key={`${paper.v}-${idx}`}
                    paper={paper}
                    subjectName={subjects[paper.s]}
                    schoolName={schools[paper.h]}
                    isBookmarked={bookmarks.has(paper.v + '_' + paper.n)}
                    toggleBookmark={() => toggleBookmark(paper.v + '_' + paper.n)}
                    onSelectPaper={setActivePaper}
                  />
                ))}
              </div>
            ) : (
              <div className="glass" style={{
                padding: '48px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.01)'
              }}>
                <h2>No Papers Found Matching Filters</h2>
                <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                  Try resetting some filters or searching for broad terms (e.g. "Maths", "2022", or "Abbotsleigh").
                </p>
                <button
                  onClick={resetFilters}
                  className="btn-primary"
                  style={{ marginTop: '20px' }}
                >
                  Clear Active Filters
                </button>
              </div>
            )}

            {/* Pagination Show More */}
            {filteredPapers.length > renderLimit && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 48px 0' }}>
                <button
                  onClick={() => setRenderLimit(prev => prev + 40)}
                  className="btn-secondary"
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    borderColor: 'var(--border-color)',
                    fontSize: '0.95rem'
                  }}
                >
                  Load More Documents (+40)
                </button>
              </div>
            )}
          </>
        )}

      </main>

      {/* Practice Exam split viewer portal Overlay */}
      {activePaper && (
        <PracticeRoom
          paper={activePaper}
          subjectName={subjects[activePaper.s]}
          schoolName={schools[activePaper.h]}
          onClose={() => setActivePaper(null)}
          allPapers={papers}
          subjects={subjects}
          schools={schools}
          onSelectPaper={setActivePaper}
        />
      )}

    </div>
  );
}
