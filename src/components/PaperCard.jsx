import React from 'react';
import { Star, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

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
        return { label: 'Official HSC', bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' };
      case 'T':
        return { label: 'School Trial', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'A':
        return { label: 'Internal Task', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { label: 'Other Resource', bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' };
    }
  };

  const cat = getCategoryDetails(paper.c);

  return (
    <div
      className="glass animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        position: 'relative',
        transition: 'var(--transition-normal)',
        background: 'var(--card-bg)',
        height: '100%',
        justifyContent: 'space-between'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3), rgba(99, 102, 241, 0.05) 0px 0px 20px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header Info */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          {/* Category Badge */}
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: cat.bg,
            color: cat.color,
            border: `1px solid ${cat.border}`,
            padding: '4px 8px',
            borderRadius: '6px'
          }}>
            {cat.label}
          </span>
          
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
              color: isBookmarked ? '#fbbf24' : 'var(--text-muted)',
              transition: 'var(--transition-fast)',
              padding: '4px'
            }}
            title={isBookmarked ? "Remove Bookmark" : "Save Paper"}
          >
            <Star size={18} fill={isBookmarked ? "#fbbf24" : "transparent"} />
          </button>
        </div>

        {/* Paper Name / Label */}
        <h3 style={{
          fontSize: '1.05rem',
          lineHeight: '1.4',
          marginBottom: '16px',
          fontWeight: '600',
          color: 'white',
          height: '48px',
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
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subject:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{subjectName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>School:</span>
            <span style={{
              fontWeight: '600',
              color: 'var(--text-primary)',
              maxWidth: '130px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }} title={schoolName}>
              {schoolName}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Year / Level:</span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {paper.y} (Y{paper.l})
            </span>
          </div>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => onSelectPaper(paper)}
            className="btn-primary"
            style={{
              width: '100%',
              fontSize: '0.85rem',
              padding: '10px 14px',
              justifyContent: 'center',
              borderRadius: '10px',
              boxShadow: 'none',
              background: cat.color === '#fbbf24' ? 'var(--cyan-gradient)' : 'var(--accent-gradient)'
            }}
          >
            <FileText size={16} />
            <span>Practice Exam</span>
            <ChevronRight size={14} />
          </button>
          
          {paper.w === 1 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--success-glow)',
                color: 'var(--success)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                width: '38px',
                height: '38px',
                flexShrink: 0
              }}
              title="Worked Solutions Available!"
            >
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
