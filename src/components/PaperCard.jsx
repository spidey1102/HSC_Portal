import React from 'react';
import { Star, FileText, CheckCircle2 } from 'lucide-react';

export default function PaperCard({
  paper,
  subjectName,
  schoolName,
  isBookmarked,
  toggleBookmark,
  onSelectPaper
}) {
  
  const getCategoryDetails = (code) => {
    switch (code) {
      case 'H':
        return { label: 'Official HSC', color: '#eb459e' }; // Discord pink
      case 'T':
        return { label: 'School Trial', color: '#5865F2' }; // Discord blurple
      case 'A':
        return { label: 'Internal Task', color: '#fdb462' }; // Discord yellow
      default:
        return { label: 'Other Resource', color: '#949ba4' }; // Discord grey
    }
  };

  const cat = getCategoryDetails(paper.c);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '4px',
        borderLeft: `4px solid ${cat.color}`,
        padding: '12px 16px',
        position: 'relative',
        height: '100%',
        justifyContent: 'space-between'
      }}
    >
      {/* Header Info */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--header-secondary)'
            }}>
              {cat.label}
            </span>
            {/* Solutions indicator inline */}
            {paper.w === 1 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', backgroundColor: 'rgba(35, 165, 89, 0.15)', color: 'var(--status-positive)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                <CheckCircle2 size={10} /> SOLVED
              </span>
            )}
          </div>
          
          {/* Bookmark Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isBookmarked ? '#f0b232' : 'var(--interactive-muted)',
              transition: 'var(--transition-fast)',
              padding: '2px'
            }}
            onMouseEnter={(e) => {
              if (!isBookmarked) e.currentTarget.style.color = 'var(--interactive-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isBookmarked) e.currentTarget.style.color = 'var(--interactive-muted)';
            }}
            title={isBookmarked ? "Remove Bookmark" : "Save Paper"}
          >
            <Star size={16} fill={isBookmarked ? "#f0b232" : "transparent"} />
          </button>
        </div>

        {/* Paper Name / Label */}
        <h3 style={{
          fontSize: '16px',
          lineHeight: '1.3',
          marginBottom: '12px',
          fontWeight: 600,
          color: 'var(--header-primary)',
          height: '42px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }} title={paper.n}>
          {paper.n}
        </h3>
      </div>

      {/* Meta details footer */}
      <div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: '12px',
          rowGap: '4px',
          fontSize: '13px',
          color: 'var(--text-normal)',
          marginBottom: '16px'
        }}>
          <span style={{ color: 'var(--header-secondary)' }}>Subject:</span>
          <span style={{ fontWeight: 500 }}>{subjectName}</span>
          
          <span style={{ color: 'var(--header-secondary)' }}>School:</span>
          <span style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }} title={schoolName}>
            {schoolName}
          </span>
          
          <span style={{ color: 'var(--header-secondary)' }}>Year:</span>
          <span style={{ fontWeight: 500 }}>
            {paper.y} (Year {paper.l})
          </span>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onSelectPaper(paper)}
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-modifier-accent)',
              color: 'var(--text-normal)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--brand-experiment)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-modifier-accent)';
              e.currentTarget.style.color = 'var(--text-normal)';
            }}
          >
            <FileText size={16} />
            <span>Practice</span>
          </button>
        </div>
      </div>

    </div>
  );
}
