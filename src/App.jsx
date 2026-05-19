import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Filters from './components/Filters';
import PaperCard from './components/PaperCard';
import PracticeRoom from './components/PracticeRoom';
import TextbooksView from './components/TextbooksView';
import { Sparkles, Library, RefreshCw, Star, Trash2, Book } from 'lucide-react';
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

  // Textbooks State
  const [viewTextbooks, setViewTextbooks] = useState(false);

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
    viewBookmarks,
    viewTextbooks
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
    viewTextbooks,
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
        bookmarksCount={bookmarks.size}
        totalPapersCount={papers.length}
        subjectCounts={subjectCounts}
      />

      {/* Main Panel Area */}
      <main className="main-content">
        
        {/* Discord-style Top Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid var(--bg-tertiary)',
          background: 'var(--bg-primary)',
          boxShadow: 'var(--elevation-low)',
          zIndex: 2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {viewTextbooks ? <Book size={24} color="var(--text-muted)" /> : <Library size={24} color="var(--text-muted)" />}
            <h1 style={{ fontSize: '16px', color: 'var(--header-primary)', margin: 0, fontWeight: 600 }}>
              {viewTextbooks ? 'textbooks' : viewBookmarks ? 'saved-library' : 'hsc-past-papers'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Action buttons (e.g., Clear Bookmarks) */}
            {viewBookmarks && bookmarks.size > 0 && (
              <button
                onClick={clearAllBookmarks}
                className="btn-secondary"
                style={{
                  color: 'var(--status-danger)',
                  background: 'transparent',
                  padding: '4px 8px'
                }}
                title="Clear All Bookmarks"
              >
                <Trash2 size={18} />
              </button>
            )}
            
            {/* The Filters Search bar can sit up here or right below */}
            {!viewTextbooks && (
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
            )}
          </div>
        </div>

        {/* Scrollable Chat/Content Area */}
        <div className="scrollable-content">
          
          {viewTextbooks ? (
            <TextbooksView />
          ) : (
            <>
              {/* Welcome Message (Discord style start of channel) */}
              <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              background: 'var(--bg-secondary)',
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Library size={40} color="var(--header-primary)" />
            </div>
            <h1 style={{ fontSize: '32px', color: 'var(--header-primary)', marginBottom: '8px' }}>
              Welcome to #{viewBookmarks ? 'saved-library' : 'hsc-past-papers'}!
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {viewBookmarks 
                ? `This is the start of your saved library. You have ${bookmarks.size} papers ready for practice.`
                : `This is the start of the ultimate prep center. Search through 7,200+ official NESA past papers and school trial exams.`}
            </p>
          </div>

          {/* Dynamic loading view */}
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              gap: '16px'
            }}>
              <RefreshCw size={32} color="var(--text-muted)" style={{ animation: 'spin 2s linear infinite' }} />
              <h3 style={{ color: 'var(--text-normal)' }}>Loading resources...</h3>
            </div>
          ) : error ? (
            <div style={{ padding: '24px', background: 'var(--status-danger)', borderRadius: '4px', color: 'white' }}>
              <h3 style={{ marginBottom: '8px', color: 'white' }}>Load Error</h3>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Results Counters */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', fontWeight: 600 }}>
                <span>
                  Found {filteredPapers.length.toLocaleString()} matches
                  {selectedSubject !== null && ` in ${subjects[selectedSubject]}`}
                </span>
                <span>
                  Showing {Math.min(renderLimit, filteredPapers.length).toLocaleString()}
                </span>
              </div>

              {/* Papers Grid */}
              {filteredPapers.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '16px'
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
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  <h3 style={{ color: 'var(--header-primary)', marginBottom: '8px' }}>No matches found</h3>
                  <p style={{ marginBottom: '16px' }}>
                    Try resetting your filters or searching for different terms.
                  </p>
                  <button onClick={resetFilters} className="btn-primary">
                    Reset Filters
                  </button>
                </div>
              )}

              {/* Pagination Show More */}
              {filteredPapers.length > renderLimit && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 64px 0' }}>
                  <button
                    onClick={() => setRenderLimit(prev => prev + 40)}
                    className="btn-secondary"
                  >
                    Load More Messages
                  </button>
                </div>
              )}
            </>
          )}
            </>
          )}

        </div>
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

