import React from 'react';
import { BookOpen, GraduationCap, Calendar, Database, Library, Bookmark } from 'lucide-react';

function SidebarButton({ active, icon: Icon, label, onClick, color = 'var(--text-normal)' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sidebar-button ${active ? 'is-active' : ''}`}
      style={{ color }}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  subjects,
  selectedSubject,
  setSelectedSubject,
  selectedLevel,
  setSelectedLevel,
  viewBookmarks,
  setViewBookmarks,
  viewTextbooks,
  setViewTextbooks,
  viewCalendar,
  setViewCalendar,
  bookmarksCount,
  totalPapersCount,
  subjectCounts
}) {
  return (
    <aside className="study-sidebar">
      <div className="study-sidebar-header">
        <div className="study-brand-mark">
          <GraduationCap size={20} />
        </div>
        <div>
          <div className="study-sidebar-kicker">HSC Portal</div>
          <div className="study-sidebar-title">Study map</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">View</div>
        <div className="sidebar-button-stack">
          <SidebarButton
            active={!viewBookmarks && !viewTextbooks && !viewCalendar}
            icon={Library}
            label="Past papers"
            onClick={() => {
              setViewBookmarks(false);
              setViewTextbooks(false);
              setViewCalendar(false);
              setSelectedLevel(12);
            }}
          />
          <SidebarButton
            active={viewBookmarks}
            icon={Bookmark}
            label={`Saved papers ${bookmarksCount > 0 ? `(${bookmarksCount})` : ''}`.trim()}
            onClick={() => {
              setViewBookmarks(true);
              setViewTextbooks(false);
              setViewCalendar(false);
            }}
            color="var(--status-positive)"
          />
          <SidebarButton
            active={viewTextbooks}
            icon={BookOpen}
            label="Textbooks"
            onClick={() => {
              setViewTextbooks(true);
              setViewBookmarks(false);
              setViewCalendar(false);
            }}
          />
          <SidebarButton
            active={viewCalendar}
            icon={Calendar}
            label="Calendar"
            onClick={() => {
              setViewCalendar(true);
              setViewBookmarks(false);
              setViewTextbooks(false);
            }}
            color="var(--status-warning)"
          />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Year level</div>
        <div className="sidebar-chip-row">
          <button
            type="button"
            className={`sidebar-chip-button ${selectedLevel === 12 && !viewBookmarks && !viewCalendar ? 'is-active' : ''}`}
            onClick={() => {
              setSelectedLevel(12);
              setViewBookmarks(false);
              setViewTextbooks(false);
              setViewCalendar(false);
            }}
          >
            Year 12
          </button>
          <button
            type="button"
            className={`sidebar-chip-button ${selectedLevel === 11 && !viewBookmarks && !viewCalendar ? 'is-active' : ''}`}
            onClick={() => {
              setSelectedLevel(11);
              setViewBookmarks(false);
              setViewTextbooks(false);
              setViewCalendar(false);
            }}
          >
            Year 11
          </button>
        </div>
      </div>

      <div className="sidebar-section sidebar-scroll-section">
        <div className="sidebar-section-label">Subjects</div>
        <button
          type="button"
          className={`sidebar-subject ${selectedSubject === null || viewTextbooks ? 'is-active' : ''}`}
          onClick={() => {
            if (viewTextbooks) return;
            setSelectedSubject(null);
            setViewBookmarks(false);
          }}
        >
          <span className="sidebar-subject-name">All papers</span>
          <span className="sidebar-subject-count">{totalPapersCount.toLocaleString()}</span>
        </button>

        {!viewTextbooks && subjects.map((sub, idx) => {
          const count = subjectCounts[idx] || 0;
          if (count === 0) return null;
          const isSelected = selectedSubject === idx;

          return (
            <button
              type="button"
              key={idx}
              className={`sidebar-subject ${isSelected ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedSubject(idx);
                setViewBookmarks(false);
                setViewTextbooks(false);
              }}
            >
              <span className="sidebar-subject-name">{sub}</span>
              <span className="sidebar-subject-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="study-sidebar-footer">
        <div className="study-sidebar-stat">
          <Database size={16} />
          <div>
            <div className="study-sidebar-stat-label">Local library</div>
            <div className="study-sidebar-stat-value">{totalPapersCount.toLocaleString()} resources</div>
          </div>
        </div>
        <div className="study-sidebar-note">
          Saved notes, bookmarks, and assessments stay on this device for now.
        </div>
      </div>
    </aside>
  );
}
