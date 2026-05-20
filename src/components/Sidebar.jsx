import React from 'react';
import { BookOpen, Star, GraduationCap, Award, Database, Hash } from 'lucide-react';

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
  bookmarksCount,
  totalPapersCount,
  subjectCounts
}) {
  return (
    <aside className="app-sidebar">
      
      {/* Server List (Far Left Bar) */}
      <div className="server-list" style={{
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px',
        zIndex: 10
      }}>
        {/* App Icon (Home) */}
        <div 
          onClick={() => { setViewBookmarks(false); setViewTextbooks(false); setSelectedLevel(12); }}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: 'var(--brand-experiment)',
            borderRadius: '16px', // Slightly squarish for Home
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-radius 0.2s ease-out, background-color 0.2s ease-out',
            marginBottom: '8px'
          }}
        >
          <GraduationCap size={28} color="white" />
        </div>

        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--bg-modifier-accent)', borderRadius: '1px', marginBottom: '8px' }} />

        {/* Level 12 (Server 1) */}
        <div 
          onClick={() => { setSelectedLevel(12); setViewBookmarks(false); setViewTextbooks(false); }}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: selectedLevel === 12 && !viewBookmarks ? 'var(--brand-experiment)' : 'var(--bg-primary)',
            borderRadius: selectedLevel === 12 && !viewBookmarks ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            position: 'relative',
            color: selectedLevel === 12 && !viewBookmarks ? 'white' : 'var(--text-normal)'
          }}
          onMouseEnter={(e) => {
            if (selectedLevel !== 12 || viewBookmarks) {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = 'var(--brand-experiment)';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedLevel !== 12 || viewBookmarks) {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-normal)';
            }
          }}
          title="Year 12 (HSC)"
        >
          {/* Active indicator pip */}
          {selectedLevel === 12 && !viewBookmarks && (
            <div style={{ position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '40px', backgroundColor: 'white', borderRadius: '0 4px 4px 0' }} />
          )}
          <Award size={24} />
        </div>

        {/* Level 11 (Server 2) */}
        <div 
          onClick={() => { setSelectedLevel(11); setViewBookmarks(false); setViewTextbooks(false); }}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: selectedLevel === 11 && !viewBookmarks ? 'var(--brand-experiment)' : 'var(--bg-primary)',
            borderRadius: selectedLevel === 11 && !viewBookmarks ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            position: 'relative',
            color: selectedLevel === 11 && !viewBookmarks ? 'white' : 'var(--text-normal)'
          }}
          onMouseEnter={(e) => {
            if (selectedLevel !== 11 || viewBookmarks) {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = 'var(--brand-experiment)';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedLevel !== 11 || viewBookmarks) {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-normal)';
            }
          }}
          title="Year 11 (Prelim)"
        >
          {/* Active indicator pip */}
          {selectedLevel === 11 && !viewBookmarks && (
            <div style={{ position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '40px', backgroundColor: 'white', borderRadius: '0 4px 4px 0' }} />
          )}
          <BookOpen size={24} />
        </div>

        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--bg-modifier-accent)', borderRadius: '1px', margin: '8px 0' }} />

        {/* Bookmarks (DM/Special) */}
        <div 
          onClick={() => { setViewBookmarks(true); setViewTextbooks(false); }}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: viewBookmarks ? 'var(--status-positive)' : 'var(--bg-primary)',
            borderRadius: viewBookmarks ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            position: 'relative',
            color: viewBookmarks ? 'white' : 'var(--status-positive)',
            marginBottom: '8px'
          }}
          onMouseEnter={(e) => {
            if (!viewBookmarks) {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = 'var(--status-positive)';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (!viewBookmarks) {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--status-positive)';
            }
          }}
          title="Bookmarks"
        >
          {viewBookmarks && (
            <div style={{ position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '40px', backgroundColor: 'white', borderRadius: '0 4px 4px 0' }} />
          )}
          <Star size={24} fill={viewBookmarks ? "white" : "currentColor"} />
          
          {/* Notification Badge */}
          {bookmarksCount > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              backgroundColor: 'var(--status-danger)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 800,
              padding: '0 4px',
              minWidth: '20px',
              height: '20px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--bg-tertiary)'
            }}>
              {bookmarksCount}
            </div>
          )}
        </div>

        {/* Textbooks Server */}
        <div 
          onClick={() => { setViewTextbooks(true); setViewBookmarks(false); }}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: viewTextbooks ? '#10b981' : 'var(--bg-primary)', // Emereald color
            borderRadius: viewTextbooks ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            position: 'relative',
            color: viewTextbooks ? 'white' : '#10b981'
          }}
          onMouseEnter={(e) => {
            if (!viewTextbooks) {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            if (!viewTextbooks) {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
              e.currentTarget.style.color = '#10b981';
            }
          }}
          title="Textbooks Library"
        >
          {viewTextbooks && (
            <div style={{ position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)', width: '8px', height: '40px', backgroundColor: 'white', borderRadius: '0 4px 4px 0' }} />
          )}
          <BookOpen size={24} />
        </div>

      </div>

      {/* Channel List (Inner Sidebar) */}
      <div className="channel-panel" style={{
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
        {/* Server Header */}
        <div style={{
          height: '48px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--bg-modifier-accent)',
          boxShadow: 'var(--elevation-low)',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          fontWeight: 600,
          color: 'var(--header-primary)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-modifier-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          HSC Portal Server
        </div>

        {/* Channels scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            marginBottom: '4px',
            color: 'var(--header-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
          }}>
            {viewTextbooks ? 'Categories' : 'Subjects (Channels)'}
          </div>

          {/* All Subjects (General channel) */}
          <div
            onClick={() => { 
              if (viewTextbooks) return; // No filter actions for textbooks yet
              setSelectedSubject(null); 
              setViewBookmarks(false); 
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '2px',
              backgroundColor: (selectedSubject === null || viewTextbooks) ? 'var(--bg-modifier-selected)' : 'transparent',
              color: (selectedSubject === null || viewTextbooks) ? 'var(--interactive-active)' : 'var(--interactive-normal)',
            }}
            onMouseEnter={(e) => {
              if (selectedSubject !== null && !viewTextbooks) {
                e.currentTarget.style.backgroundColor = 'var(--bg-modifier-hover)';
                e.currentTarget.style.color = 'var(--interactive-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSubject !== null && !viewTextbooks) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--interactive-normal)';
              }
            }}
          >
            <Hash size={20} color="var(--interactive-muted)" style={{ marginRight: '6px' }} />
            <span style={{ fontSize: '15px', fontWeight: 500 }}>general</span>
          </div>

          {!viewTextbooks && subjects.map((sub, idx) => {
            const isSelected = selectedSubject === idx;
            const count = subjectCounts[idx] || 0;
            
            if (count === 0) return null;
            
            // Format subject name for discord channel (lowercase, spaces to hyphens)
            const channelName = sub.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            return (
              <div
                key={idx}
                onClick={() => { setSelectedSubject(idx); setViewBookmarks(false); setViewTextbooks(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  backgroundColor: isSelected ? 'var(--bg-modifier-selected)' : 'transparent',
                  color: isSelected ? 'var(--interactive-active)' : 'var(--interactive-normal)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-modifier-hover)';
                    e.currentTarget.style.color = 'var(--interactive-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--interactive-normal)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  <Hash size={20} color="var(--interactive-muted)" style={{ marginRight: '6px', flexShrink: 0 }} />
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: 500,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}>
                    {channelName}
                  </span>
                </div>
                {/* Count badge */}
                {!isSelected && (
                  <span style={{
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-primary)',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    color: 'var(--text-muted)'
                  }}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* User Panel (Bottom left) */}
        <div style={{
          backgroundColor: '#232428', /* Discord's user panel color */
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'var(--bg-modifier-accent)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database size={16} color="var(--text-normal)" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--header-primary)' }}>
              Local DB
            </div>
            <div style={{ fontSize: '11px', color: 'var(--header-secondary)' }}>
              {totalPapersCount.toLocaleString()} resources
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
