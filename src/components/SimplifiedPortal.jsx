import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ExternalLink,
  BookOpen,
  ArrowLeft,
  ChevronsUpDown,
  Minimize2,
  Info,
  Sun,
  Moon,
  FolderTree,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import PracticeRoom from './PracticeRoom';
import {
  readStoredArray,
  writeStoredArray,
  VIEWED_PAPERS_STORAGE_KEY,
  MAX_VIEWED_PAPERS,
  notifyStudySyncUpdate,
} from '../utils/studySync';

const CATEGORY_NAMES = {
  T: 'Trial Papers',
  A: 'Assessment Tasks',
  H: 'Official HSC Papers',
  O: 'Supplementary Resources',
};

export default function SimplifiedPortal({ onPortalLayoutChange }) {
  // Papers dataset
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active theme tracking & toggle
  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = useCallback(() => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    try {
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('hsc_theme', nextTheme);
    } catch (e) {
      console.warn('Could not persist theme preference', e);
    }
    setCurrentTheme(nextTheme);
  }, [currentTheme]);

  // Tree state: which folder node keys are expanded
  // Keys: "lvl:12", "lvl:12|subj:4", "lvl:12|subj:4|cat:T", "lvl:12|subj:4|cat:T|sch:44"
  const [expandedKeys, setExpandedKeys] = useState(() => new Set(['lvl:12']));

  // Selected node in the tree (for the detail/shelf panel)
  const [selectedNode, setSelectedNode] = useState({
    type: 'level',
    level: 12,
    title: 'Year 12 - HSC Examination Archive',
    key: 'lvl:12',
  });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', '12', '11'
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activePracticePaper, setActivePracticePaper] = useState(null);

  // Load database
  useEffect(() => {
    fetch('/papers.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load past examination archive.');
        return res.json();
      })
      .then((data) => {
        setSubjects(data.subjects || []);
        setSchools(data.schools || []);
        setPapers(data.papers || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Could not load archive database.');
        setLoading(false);
      });
  }, []);

  // Toggle tree node expansion
  const toggleNode = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set();
    all.add('lvl:12');
    all.add('lvl:11');
    subjects.forEach((_, sIdx) => {
      all.add(`lvl:12|subj:${sIdx}`);
      all.add(`lvl:11|subj:${sIdx}`);
      ['T', 'A', 'H'].forEach((cat) => {
        all.add(`lvl:12|subj:${sIdx}|cat:${cat}`);
        all.add(`lvl:11|subj:${sIdx}|cat:${cat}`);
      });
    });
    setExpandedKeys(all);
  }, [subjects]);

  const collapseAll = useCallback(() => {
    setExpandedKeys(new Set(['lvl:12']));
  }, []);

  // Open PDF directly
  const handleOpenPdf = useCallback((paper) => {
    try {
      const viewed = readStoredArray(VIEWED_PAPERS_STORAGE_KEY, []);
      const updated = [
        paper.cf || paper.n,
        ...viewed.filter((id) => id !== (paper.cf || paper.n)),
      ].slice(0, MAX_VIEWED_PAPERS);
      writeStoredArray(VIEWED_PAPERS_STORAGE_KEY, updated);
      notifyStudySyncUpdate();
    } catch (e) {
      console.warn('Could not record viewed paper', e);
    }

    if (paper.pdfUrl) {
      window.open(paper.pdfUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Launch Practice Room
  const handleLaunchPractice = useCallback((paper) => {
    try {
      const viewed = readStoredArray(VIEWED_PAPERS_STORAGE_KEY, []);
      const updated = [
        paper.cf || paper.n,
        ...viewed.filter((id) => id !== (paper.cf || paper.n)),
      ].slice(0, MAX_VIEWED_PAPERS);
      writeStoredArray(VIEWED_PAPERS_STORAGE_KEY, updated);
      notifyStudySyncUpdate();
    } catch (e) {
      console.warn('Could not record viewed paper', e);
    }
    setActivePracticePaper(paper);
  }, []);

  // Filtered papers by search & level
  const filteredPapers = useMemo(() => {
    let result = papers;
    if (levelFilter !== 'all') {
      const lvl = parseInt(levelFilter, 10);
      result = result.filter((p) => p.l === lvl);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const sName = subjects[p.s]?.toLowerCase() || '';
        const schName = schools[p.h]?.toLowerCase() || '';
        const pName = p.n?.toLowerCase() || '';
        const yStr = String(p.y);
        return pName.includes(q) || sName.includes(q) || schName.includes(q) || yStr.includes(q);
      });
    }
    return result;
  }, [papers, levelFilter, searchQuery, subjects, schools]);

  // Group papers into a hierarchical tree
  // Tree Structure: Level -> Subject -> Category -> School -> Papers
  const treeData = useMemo(() => {
    const levels = [
      { id: 12, name: 'Year 12 - HSC', subtitle: 'HSC Trials, Assessments & Official Papers' },
      { id: 11, name: 'Year 11 - Preliminary', subtitle: 'Yearly Examinations, Trials & Topic Tests' },
    ];

    return levels
      .filter((lvl) => levelFilter === 'all' || levelFilter === String(lvl.id))
      .map((lvl) => {
        const lvlPapers = filteredPapers.filter((p) => p.l === lvl.id);

        // Group by subject
        const subjectMap = new Map();
        lvlPapers.forEach((p) => {
          if (!subjectMap.has(p.s)) {
            subjectMap.set(p.s, []);
          }
          subjectMap.get(p.s).push(p);
        });

        const subjectNodes = Array.from(subjectMap.entries())
          .map(([sIdx, sPapers]) => {
            const subjectName = subjects[sIdx] || `Subject ${sIdx}`;

            // Group by category (T, A, H, O)
            const catMap = new Map();
            sPapers.forEach((p) => {
              const c = p.c || 'T';
              if (!catMap.has(c)) {
                catMap.set(c, []);
              }
              catMap.get(c).push(p);
            });

            const categoryNodes = Array.from(catMap.entries())
              .map(([catCode, cPapers]) => {
                const catName = CATEGORY_NAMES[catCode] || 'Other Papers';

                // Group by school
                const schoolMap = new Map();
                cPapers.forEach((p) => {
                  const sch = p.h;
                  if (!schoolMap.has(sch)) {
                    schoolMap.set(sch, []);
                  }
                  schoolMap.get(sch).push(p);
                });

                const schoolNodes = Array.from(schoolMap.entries())
                  .map(([schIdx, schPapers]) => {
                    const schoolName = schools[schIdx] || 'Examination Cohort';
                    // Sort papers by year desc
                    const sortedPapers = [...schPapers].sort((a, b) => b.y - a.y);
                    return {
                      key: `lvl:${lvl.id}|subj:${sIdx}|cat:${catCode}|sch:${schIdx}`,
                      type: 'school',
                      name: schoolName,
                      level: lvl.id,
                      subjectIdx: sIdx,
                      subjectName,
                      categoryCode: catCode,
                      categoryName: catName,
                      schoolIdx: schIdx,
                      papers: sortedPapers,
                      count: sortedPapers.length,
                    };
                  })
                  .sort((a, b) => a.name.localeCompare(b.name));

                return {
                  key: `lvl:${lvl.id}|subj:${sIdx}|cat:${catCode}`,
                  type: 'category',
                  name: catName,
                  code: catCode,
                  level: lvl.id,
                  subjectIdx: sIdx,
                  subjectName,
                  schools: schoolNodes,
                  papers: cPapers,
                  count: cPapers.length,
                };
              })
              .sort((a, b) => {
                const order = { T: 1, A: 2, H: 3, O: 4 };
                return (order[a.code] || 9) - (order[b.code] || 9);
              });

            return {
              key: `lvl:${lvl.id}|subj:${sIdx}`,
              type: 'subject',
              name: subjectName,
              subjectIdx: sIdx,
              level: lvl.id,
              categories: categoryNodes,
              papers: sPapers,
              count: sPapers.length,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          key: `lvl:${lvl.id}`,
          type: 'level',
          level: lvl.id,
          name: lvl.name,
          subtitle: lvl.subtitle,
          subjects: subjectNodes,
          papers: lvlPapers,
          count: lvlPapers.length,
        };
      });
  }, [filteredPapers, levelFilter, subjects, schools]);

  // If searching, auto-expand nodes that match
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const matchingKeys = new Set();
      treeData.forEach((lvlNode) => {
        matchingKeys.add(lvlNode.key);
        lvlNode.subjects.forEach((subjNode) => {
          matchingKeys.add(subjNode.key);
          subjNode.categories.forEach((catNode) => {
            matchingKeys.add(catNode.key);
          });
        });
      });
      setExpandedKeys(matchingKeys);
    }
  }, [searchQuery, treeData]);

  // Papers corresponding to the currently selected node
  const activeShelfPapers = useMemo(() => {
    if (!selectedNode) return [];
    if (selectedNode.type === 'paper') {
      return [selectedNode.paper];
    }
    return selectedNode.papers || [];
  }, [selectedNode]);

  // Statistics for selected node
  const nodeStats = useMemo(() => {
    const list = activeShelfPapers;
    const withSol = list.filter((p) => p.w === 1).length;
    const distinctSchools = new Set(list.map((p) => p.h)).size;
    const yearRange = list.length
      ? `${Math.min(...list.map((p) => p.y))} – ${Math.max(...list.map((p) => p.y))}`
      : '—';
    return {
      total: list.length,
      withSol,
      distinctSchools,
      yearRange,
    };
  }, [activeShelfPapers]);

  // If Practice Room is open
  if (activePracticePaper) {
    return (
      <div className="tree-practice-overlay">
        <div className="tree-practice-bar">
          <button
            type="button"
            onClick={() => setActivePracticePaper(null)}
            className="btn btn-secondary"
            style={{ fontSize: '13px' }}
          >
            <ArrowLeft size={16} />
            Back to Tree Directory
          </button>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', fontWeight: 600 }}>
            {activePracticePaper.n}
          </div>
          <button
            type="button"
            onClick={() => handleOpenPdf(activePracticePaper)}
            className="btn btn-secondary"
            style={{ fontSize: '12.5px' }}
          >
            <ExternalLink size={14} />
            Raw PDF
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <PracticeRoom
            paper={activePracticePaper}
            onClose={() => setActivePracticePaper(null)}
            onAsk={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tree-portal">
      {/* Masthead */}
      <header className="tree-masthead-wrapper">
        <div className="tree-masthead">
          <div className="tree-masthead-brand">
            <div className="tree-brand-icon">
              <FolderTree size={20} />
            </div>
            <div className="tree-masthead-title">
              <span className="tree-kicker">New South Wales · Preliminary &amp; HSC</span>
              <h1>Past Examination Archive</h1>
            </div>
          </div>

          <div className="tree-masthead-actions">
            {/* Workspace Selector Pill */}
            <div className="tree-workspace-toggle" title="Select portal workspace layout">
              <button
                type="button"
                className="tree-workspace-btn active"
                title="Current view: Tree Layout"
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => onPortalLayoutChange?.('new')}
                className="tree-workspace-btn"
                title="Switch to The Paper Room study workspace"
              >
                Paper Room
              </button>
              <button
                type="button"
                onClick={() => onPortalLayoutChange?.('classic')}
                className="tree-workspace-btn"
                title="Switch to Classic dashboard"
              >
                Classic
              </button>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={toggleTheme}
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} theme`}
              aria-label="Toggle visual theme"
            >
              {currentTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Guide modal button */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '13px' }}
              onClick={() => setShowGuideModal(true)}
            >
              <Info size={14} />
              Guide
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="tree-main-layout">
        {/* Intro Banner */}
        <section className="tree-intro-banner">
          <div className="tree-intro-text">
            <h2>Hierarchical File Tree</h2>
            <p>
              Direct tree directory of 5,449+ NSW school trial papers, internal assessments, and official NESA HSC examinations. Expand folders below or select any node to view its shelf.
            </p>
          </div>

          <div className="tree-stats-row">
            <span className="tag tag-neutral">
              <Layers size={13} style={{ marginRight: '5px' }} />
              {papers.length ? `${papers.length.toLocaleString()} papers indexed` : 'Loading...'}
            </span>
            <span className="tag tag-accent">
              <CheckCircle2 size={13} style={{ marginRight: '5px' }} />
              {papers.filter((p) => p.w === 1).length.toLocaleString()} with worked solutions
            </span>
          </div>
        </section>

        {/* Toolbar & Filter Bar */}
        <section className="tree-toolbar">
          <div className="tree-search-wrap">
            <Search size={16} className="tree-search-icon" />
            <input
              type="text"
              className="tree-search-input"
              placeholder="Search tree by school, subject, year or paper name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="tree-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="tree-controls-group">
            {/* Level Selector Pills */}
            <div className="tree-pill-row">
              <button
                type="button"
                className={`tree-pill-btn ${levelFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLevelFilter('all')}
              >
                All Years
              </button>
              <button
                type="button"
                className={`tree-pill-btn ${levelFilter === '12' ? 'active' : ''}`}
                onClick={() => setLevelFilter('12')}
              >
                Year 12 (HSC)
              </button>
              <button
                type="button"
                className={`tree-pill-btn ${levelFilter === '11' ? 'active' : ''}`}
                onClick={() => setLevelFilter('11')}
              >
                Year 11 (Prelim)
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              onClick={expandAll}
              title="Expand all tree branches"
            >
              <ChevronsUpDown size={13} />
              Expand All
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 10px' }}
              onClick={collapseAll}
              title="Collapse tree to root"
            >
              <Minimize2 size={13} />
              Collapse
            </button>
          </div>
        </section>

        {/* Breadcrumb Bar */}
        <section className="tree-breadcrumb-bar">
          <div className="tree-breadcrumbs">
            <button
              type="button"
              className="tree-breadcrumb-link"
              onClick={() => {
                setSelectedNode({
                  type: 'root',
                  title: 'NSW HSC Examination Archive',
                  papers: filteredPapers,
                  key: 'root',
                });
              }}
            >
              <Folder size={14} />
              archive
            </button>

            {selectedNode.level && (
              <>
                <ChevronRight size={13} className="dim" />
                <button
                  type="button"
                  className="tree-breadcrumb-link"
                  onClick={() => {
                    const node = treeData.find((l) => l.level === selectedNode.level);
                    if (node) setSelectedNode(node);
                  }}
                >
                  Year {selectedNode.level}
                </button>
              </>
            )}

            {selectedNode.subjectName && (
              <>
                <ChevronRight size={13} className="dim" />
                <span className="tree-breadcrumb-link">{selectedNode.subjectName}</span>
              </>
            )}

            {selectedNode.categoryName && (
              <>
                <ChevronRight size={13} className="dim" />
                <span className="tree-breadcrumb-link">{selectedNode.categoryName}</span>
              </>
            )}

            {selectedNode.name && selectedNode.type === 'school' && (
              <>
                <ChevronRight size={13} className="dim" />
                <span className="tree-breadcrumb-current">{selectedNode.name}</span>
              </>
            )}
          </div>

          <span className="num dim" style={{ fontSize: '12.5px' }}>
            Showing {activeShelfPapers.length} paper{activeShelfPapers.length === 1 ? '' : 's'} in selected branch
          </span>
        </section>

        {/* Loading / Error States */}
        {loading && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <p className="dim">Reading hierarchical examination archive...</p>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'var(--status-danger)', padding: '24px' }}>
            <div className="card-kicker" style={{ color: 'var(--status-danger)' }}>Error Loading Archive</div>
            <p className="card-body">{error}</p>
          </div>
        )}

        {/* The Two-Column Explorer Layout */}
        {!loading && !error && (
          <div className="tree-explorer-split">
            {/* Column 1: Tree View Directory */}
            <div className="tree-panel">
              <div className="tree-panel-header">
                <div className="tree-panel-title">
                  <FolderTree size={16} style={{ color: 'var(--color-accent)' }} />
                  Directory Hierarchy
                </div>
                <span className="tree-badge-count">
                  {filteredPapers.length.toLocaleString()} files
                </span>
              </div>

              {filteredPapers.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center' }} className="dim">
                  No examination papers match your current query "{searchQuery}".
                </div>
              ) : (
                <div className="tree-branch-container" role="tree">
                  {treeData.map((lvlNode) => {
                    const isLvlExpanded = expandedKeys.has(lvlNode.key);
                    const isLvlSelected = selectedNode?.key === lvlNode.key;

                    return (
                      <div key={lvlNode.key} className="tree-branch">
                        {/* Level Root Node */}
                        <div
                          className={`tree-row ${isLvlSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedNode(lvlNode)}
                          role="treeitem"
                          aria-expanded={isLvlExpanded}
                        >
                          <div className="tree-row-main">
                            <button
                              type="button"
                              className="tree-toggle-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNode(lvlNode.key);
                              }}
                              aria-label="Toggle folder"
                            >
                              {isLvlExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="tree-node-icon">
                              {isLvlExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                            </span>
                            <span className="tree-node-name is-root">
                              {lvlNode.name}
                            </span>
                          </div>
                          <div className="tree-node-meta">
                            <span className="tree-badge-count">{lvlNode.count} files</span>
                          </div>
                        </div>

                        {/* Subject Children */}
                        {isLvlExpanded && (
                          <div className="tree-sub-branches">
                            {lvlNode.subjects.map((subjNode) => {
                              const isSubjExpanded = expandedKeys.has(subjNode.key);
                              const isSubjSelected = selectedNode?.key === subjNode.key;

                              return (
                                <div key={subjNode.key} className="tree-branch">
                                  {/* Subject Row */}
                                  <div
                                    className={`tree-row ${isSubjSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedNode(subjNode)}
                                    role="treeitem"
                                    aria-expanded={isSubjExpanded}
                                  >
                                    <div className="tree-row-main">
                                      <button
                                        type="button"
                                        className="tree-toggle-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleNode(subjNode.key);
                                        }}
                                      >
                                        {isSubjExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                      </button>
                                      <span className="tree-node-icon">
                                        {isSubjExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                                      </span>
                                      <span className="tree-node-name is-subject">
                                        {subjNode.name}
                                      </span>
                                    </div>
                                    <div className="tree-node-meta">
                                      <span className="tree-badge-count">{subjNode.count}</span>
                                    </div>
                                  </div>

                                  {/* Category Children */}
                                  {isSubjExpanded && (
                                    <div className="tree-sub-branches">
                                      {subjNode.categories.map((catNode) => {
                                        const isCatExpanded = expandedKeys.has(catNode.key);
                                        const isCatSelected = selectedNode?.key === catNode.key;

                                        return (
                                          <div key={catNode.key} className="tree-branch">
                                            {/* Category Row */}
                                            <div
                                              className={`tree-row ${isCatSelected ? 'selected' : ''}`}
                                              onClick={() => setSelectedNode(catNode)}
                                              role="treeitem"
                                              aria-expanded={isCatExpanded}
                                            >
                                              <div className="tree-row-main">
                                                <button
                                                  type="button"
                                                  className="tree-toggle-btn"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleNode(catNode.key);
                                                  }}
                                                >
                                                  {isCatExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                </button>
                                                <span className="tree-node-icon">
                                                  {isCatExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                                                </span>
                                                <span className="tree-node-name">
                                                  {catNode.name}
                                                </span>
                                              </div>
                                              <div className="tree-node-meta">
                                                <span className="tree-badge-count">{catNode.count}</span>
                                              </div>
                                            </div>

                                            {/* School Children */}
                                            {isCatExpanded && (
                                              <div className="tree-sub-branches">
                                                {catNode.schools.map((schNode) => {
                                                  const isSchExpanded = expandedKeys.has(schNode.key);
                                                  const isSchSelected = selectedNode?.key === schNode.key;

                                                  return (
                                                    <div key={schNode.key} className="tree-branch">
                                                      {/* School Row */}
                                                      <div
                                                        className={`tree-row ${isSchSelected ? 'selected' : ''}`}
                                                        onClick={() => setSelectedNode(schNode)}
                                                        role="treeitem"
                                                        aria-expanded={isSchExpanded}
                                                      >
                                                        <div className="tree-row-main">
                                                          <button
                                                            type="button"
                                                            className="tree-toggle-btn"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              toggleNode(schNode.key);
                                                            }}
                                                          >
                                                            {isSchExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                          </button>
                                                          <span className="tree-node-icon">
                                                            {isSchExpanded ? <FolderOpen size={13} /> : <Folder size={13} />}
                                                          </span>
                                                          <span className="tree-node-name">
                                                            {schNode.name}
                                                          </span>
                                                        </div>
                                                        <div className="tree-node-meta">
                                                          <span className="tree-badge-count">{schNode.count}</span>
                                                        </div>
                                                      </div>

                                                      {/* Papers (Leaf nodes) */}
                                                      {isSchExpanded && (
                                                        <div className="tree-sub-branches">
                                                          {schNode.papers.map((p) => {
                                                            const isPaperSelected = selectedNode?.paper?.cf === p.cf;
                                                            return (
                                                              <div
                                                                key={p.cf || p.n}
                                                                className={`tree-file-node ${isPaperSelected ? 'selected' : ''}`}
                                                                onClick={() =>
                                                                  setSelectedNode({
                                                                    type: 'paper',
                                                                    paper: p,
                                                                    title: p.n,
                                                                    level: p.l,
                                                                    subjectName: subjNode.name,
                                                                    categoryName: catNode.name,
                                                                    name: schNode.name,
                                                                    key: p.cf || p.n,
                                                                  })
                                                                }
                                                              >
                                                                <div className="tree-file-info">
                                                                  <FileText size={13} style={{ color: 'var(--color-accent-700)', flexShrink: 0 }} />
                                                                  <span className="tree-file-name">{p.n}</span>
                                                                  {p.w === 1 && (
                                                                    <span className="tag tag-accent" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                                                      sol
                                                                    </span>
                                                                  )}
                                                                </div>

                                                                <div className="tree-file-actions">
                                                                  <button
                                                                    type="button"
                                                                    className="btn btn-secondary"
                                                                    style={{ fontSize: '11px', padding: '3px 7px' }}
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      handleLaunchPractice(p);
                                                                    }}
                                                                    title="Open in Practice Room"
                                                                  >
                                                                    <BookOpen size={11} />
                                                                    Practice
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    className="btn btn-secondary"
                                                                    style={{ fontSize: '11px', padding: '3px 6px' }}
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      handleOpenPdf(p);
                                                                    }}
                                                                    title="Open Raw PDF"
                                                                  >
                                                                    <ExternalLink size={11} />
                                                                  </button>
                                                                </div>
                                                              </div>
                                                            );
                                                          })}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Selected Folder / Paper Shelf Detail Card */}
            <div className="tree-detail-panel">
              <div className="tree-detail-card">
                <div>
                  <span className="tree-detail-kicker">
                    {selectedNode.type === 'paper'
                      ? 'Selected Examination Document'
                      : selectedNode.type === 'school'
                      ? 'School Collection'
                      : selectedNode.type === 'category'
                      ? 'Category Branch'
                      : selectedNode.type === 'subject'
                      ? 'Subject Branch'
                      : 'Directory Level'}
                  </span>
                  <h3 className="tree-detail-title">
                    {selectedNode.title || selectedNode.name || 'HSC Examination Collection'}
                  </h3>
                  <p className="tree-detail-desc">
                    {selectedNode.subtitle ||
                      (selectedNode.type === 'school'
                        ? `All examination files and past trial tests sat at ${selectedNode.name}.`
                        : selectedNode.type === 'category'
                        ? `Past examination papers archived under ${selectedNode.name} in ${selectedNode.subjectName}.`
                        : selectedNode.type === 'subject'
                        ? `Comprehensive folder of trial exams, internal assessments, and official NESA HSC papers for ${selectedNode.name}.`
                        : 'Explore individual examination files below with direct access to practice sessions and authentic PDFs.')}
                  </p>
                </div>

                {/* Stat Grid */}
                <div className="tree-stats-grid">
                  <div className="tree-stat-box">
                    <span className="tree-stat-val">{nodeStats.total}</span>
                    <span className="tree-stat-lbl">Papers in Branch</span>
                  </div>
                  <div className="tree-stat-box">
                    <span className="tree-stat-val">{nodeStats.withSol}</span>
                    <span className="tree-stat-lbl">With Solutions</span>
                  </div>
                  <div className="tree-stat-box">
                    <span className="tree-stat-val">{nodeStats.distinctSchools}</span>
                    <span className="tree-stat-lbl">Schools Included</span>
                  </div>
                  <div className="tree-stat-box">
                    <span className="tree-stat-val">{nodeStats.yearRange}</span>
                    <span className="tree-stat-lbl">Sitting Years</span>
                  </div>
                </div>

                {/* If a single paper is clicked */}
                {selectedNode.type === 'paper' && selectedNode.paper && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '14px',
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-divider)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="tag tag-accent">
                        {selectedNode.paper.c === 'H' ? 'Official HSC' : selectedNode.paper.c === 'A' ? 'Assessment' : 'Trial Exam'}
                      </span>
                      <span className="num dim" style={{ fontSize: '13px' }}>
                        Sitting Year: {selectedNode.paper.y}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={() => handleLaunchPractice(selectedNode.paper)}
                      >
                        <BookOpen size={15} />
                        Open in Practice Room
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleOpenPdf(selectedNode.paper)}
                      >
                        <ExternalLink size={15} />
                        View PDF
                      </button>
                    </div>
                  </div>
                )}

                {/* Paper Shelf list for selected folder */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-accent-700)', fontWeight: 600 }}>
                      File Shelf ({activeShelfPapers.length})
                    </span>
                    <span className="num dim" style={{ fontSize: '11px' }}>
                      Click Practice to begin sitting
                    </span>
                  </div>

                  <div className="tree-shelf-list">
                    {activeShelfPapers.slice(0, 40).map((paper) => (
                      <div key={paper.cf || paper.n} className="tree-shelf-item">
                        <div className="tree-shelf-item-head">
                          <h4 className="tree-shelf-item-title">{paper.n}</h4>
                          {paper.w === 1 && (
                            <span className="tag tag-accent" style={{ fontSize: '10px' }}>
                              Worked sol
                            </span>
                          )}
                        </div>

                        <div className="num dim" style={{ fontSize: '12px' }}>
                          {schools[paper.h] || 'School'} · Year {paper.y} · {paper.c === 'H' ? 'HSC' : paper.c === 'A' ? 'Assessment' : 'Trial'}
                        </div>

                        <div className="tree-shelf-item-foot">
                          <span className="tag tag-neutral" style={{ fontSize: '10.5px' }}>
                            {subjects[paper.s]}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                              onClick={() => handleLaunchPractice(paper)}
                            >
                              <BookOpen size={12} />
                              Practice
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '11.5px', padding: '4px 8px' }}
                              onClick={() => handleOpenPdf(paper)}
                              title="Direct PDF"
                            >
                              <ExternalLink size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {activeShelfPapers.length > 40 && (
                      <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '12.5px' }} className="dim">
                        Showing first 40 of {activeShelfPapers.length} papers. Use the tree hierarchy or search to narrow your selection.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setShowGuideModal(false)}>
          <div className="dialog" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <div>
                <span className="kick">HSC Archive Guide</span>
                <h3>About the Examination Tree</h3>
                <p>Authentic trial exams, assessments, and past papers</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setShowGuideModal(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="dialog-scroll" style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p>
                The Tree Layout mirrors the original NSW HSC file directory structure:
              </p>
              <div className="card" style={{ background: 'var(--color-surface)' }}>
                <div className="card-kicker">Archive Hierarchy</div>
                <div style={{ fontFamily: 'var(--font-num)', fontSize: '13px', lineHeight: 1.6 }}>
                  root /<br />
                  ├── Year 12 (HSC) /<br />
                  │   ├── Chemistry /<br />
                  │   │   ├── Trial Papers /<br />
                  │   │   │   ├── Baulkham Hills High /<br />
                  │   │   │   │   └── 2023 Trial Exam [w. sol].pdf<br />
                  │   │   │   └── James Ruse Agricultural High /<br />
                  │   │   └── Assessment Tasks /<br />
                  │   └── Mathematics Extension 1 /<br />
                  └── Year 11 (Preliminary) /
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="card">
                  <div className="card-kicker">Interactive Practice Room</div>
                  <p className="card-body">
                    Launch any paper directly into our interactive sitting room with built-in timers, marks tracking, and AI assistance.
                  </p>
                </div>
                <div className="card">
                  <div className="card-kicker">Dark &amp; Light Palettes</div>
                  <p className="card-body">
                    Click the sun/moon button in the top masthead to toggle between deep lamplight dark mode and crisp daylight paper mode.
                  </p>
                </div>
              </div>
            </div>

            <div className="dialog-foot">
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                onClick={() => setShowGuideModal(false)}
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
