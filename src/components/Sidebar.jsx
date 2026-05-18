import React from 'react';
import { BookOpen, Star, GraduationCap, Award, Database } from 'lucide-react';

export default function Sidebar({
  subjects,
  selectedSubject,
  setSelectedSubject,
  selectedLevel,
  setSelectedLevel,
  viewBookmarks,
  setViewBookmarks,
  bookmarksCount,
  totalPapersCount,
  subjectCounts
}) {
  return (
    <aside className="sidebar glass-panel">
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          background: 'var(--accent-gradient)',
          padding: '10px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--glow-shadow)'
        }}>
          <GraduationCap size={24} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', lineHeight: '1.2' }} className="gradient-text">HSC Portal</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Ultimate Prep Center
          </span>
        </div>
      </div>

      <hr style={{ border: 'none', height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

      {/* Level Selectors */}
      <div>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Course Level
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => { setSelectedLevel(12); setViewBookmarks(false); }}
            className={`btn-secondary ${selectedLevel === 12 && !viewBookmarks ? 'active' : ''}`}
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              background: selectedLevel === 12 && !viewBookmarks ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
              color: selectedLevel === 12 && !viewBookmarks ? 'white' : 'var(--text-primary)',
              borderColor: selectedLevel === 12 && !viewBookmarks ? 'transparent' : 'var(--border-color)',
              padding: '12px 16px'
            }}
          >
            <Award size={18} />
            <span>Year 12 (HSC)</span>
          </button>
          <button
            onClick={() => { setSelectedLevel(11); setViewBookmarks(false); }}
            className={`btn-secondary ${selectedLevel === 11 && !viewBookmarks ? 'active' : ''}`}
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              background: selectedLevel === 11 && !viewBookmarks ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
              color: selectedLevel === 11 && !viewBookmarks ? 'white' : 'var(--text-primary)',
              borderColor: selectedLevel === 11 && !viewBookmarks ? 'transparent' : 'var(--border-color)',
              padding: '12px 16px'
            }}
          >
            <BookOpen size={18} />
            <span>Year 11 (Prelim)</span>
          </button>
        </div>
      </div>

      {/* Bookmarks Toggle */}
      <div>
        <button
          onClick={() => setViewBookmarks(true)}
          className={`btn-secondary ${viewBookmarks ? 'active' : ''}`}
          style={{
            justifyContent: 'space-between',
            width: '100%',
            background: viewBookmarks ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' : 'rgba(255,255,255,0.02)',
            color: 'white',
            borderColor: viewBookmarks ? 'transparent' : 'var(--border-color)',
            padding: '12px 16px',
            boxShadow: viewBookmarks ? '0 4px 15px rgba(225, 29, 72, 0.3)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} fill={viewBookmarks ? "white" : "transparent"} color="white" />
            <span>Bookmarks</span>
          </div>
          <span style={{
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 8px',
            borderRadius: '20px',
            fontWeight: '600'
          }}>
            {bookmarksCount}
          </span>
        </button>
      </div>

      <hr style={{ border: 'none', height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

      {/* Subjects list */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Subjects ({subjects.length})
        </h4>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
          paddingRight: '4px',
          flexGrow: 1
        }}>
          {/* "All Subjects" select card */}
          <button
            onClick={() => { setSelectedSubject(null); setViewBookmarks(false); }}
            className="btn-secondary"
            style={{
              justifyContent: 'space-between',
              width: '100%',
              background: selectedSubject === null ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              borderColor: selectedSubject === null ? 'var(--accent-indigo)' : 'transparent',
              color: selectedSubject === null ? 'white' : 'var(--text-secondary)',
              padding: '8px 12px',
              fontSize: '0.9rem',
              borderRadius: '8px'
            }}
          >
            <span>All Subjects</span>
          </button>
          
          {subjects.map((sub, idx) => {
            const isSelected = selectedSubject === idx;
            const count = subjectCounts[idx] || 0;
            
            if (count === 0) return null; // Only show subjects that have papers for the active level
            
            return (
              <button
                key={idx}
                onClick={() => { setSelectedSubject(idx); setViewBookmarks(false); }}
                className="btn-secondary"
                style={{
                  justifyContent: 'space-between',
                  width: '100%',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  borderColor: isSelected ? 'var(--accent-indigo)' : 'transparent',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  maxWidth: '180px'
                }}>
                  {sub}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  background: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)',
                  color: isSelected ? 'white' : 'var(--text-muted)',
                  padding: '2px 6px',
                  borderRadius: '6px'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Library Stats Footer */}
      <div className="glass" style={{ padding: '16px', borderRadius: '12px', marginTop: 'auto', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Database size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Local Database Stats</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Total Papers:</span>
          <span style={{ fontWeight: '700', color: 'white' }}>{totalPapersCount.toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
}
