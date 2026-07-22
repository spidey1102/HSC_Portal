import React from 'react';
import { Star, FileText, CheckCircle2, Share2 } from 'lucide-react';

export default function PaperCard({
  paper,
  subjectName,
  schoolName,
  isBookmarked,
  toggleBookmark,
  sharePaper,
  onSelectPaper,
  matchReasons = []
}) {
  const getCategoryDetails = (code) => {
    switch (code) {
      case 'H':
        return { label: 'Official HSC', color: 'var(--brand-experiment)', tint: 'rgba(53,91,79,0.08)' };
      case 'T':
        return { label: 'School trial', color: '#617d73', tint: 'rgba(97,125,115,0.12)' };
      case 'A':
        return { label: 'Assessment task', color: '#8c7560', tint: 'rgba(140,117,96,0.12)' };
      default:
        return { label: 'Other resource', color: 'var(--header-secondary)', tint: 'rgba(84,97,92,0.08)' };
    }
  };

  const cat = getCategoryDetails(paper.c);

  return (
    <div
      className="paper-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderTop: `4px solid ${cat.color}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <span className="pill" style={{ backgroundColor: cat.tint, color: cat.color, borderColor: 'transparent', padding: '6px 10px' }}>
            {cat.label}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                sharePaper();
              }}
              className="btn-secondary"
              style={{
                padding: '8px 10px',
                minWidth: '40px',
                justifyContent: 'center',
              }}
              title="Share test link"
            >
              <Share2 size={16} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark();
              }}
              className="btn-secondary"
              style={{
                padding: '8px 10px',
                minWidth: '40px',
                justifyContent: 'center',
                color: isBookmarked ? 'var(--status-warning)' : 'var(--interactive-muted)'
              }}
              title={isBookmarked ? 'Remove bookmark' : 'Save paper'}
            >
              <Star size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <h3
          style={{
            fontSize: '17px',
            lineHeight: 1.35,
            fontWeight: 700,
            color: 'var(--header-primary)',
            minHeight: '3.2em'
          }}
          title={paper.n}
        >
          {paper.n}
        </h3>

        {paper.w === 1 && (
          <div
            className="pill"
            style={{ width: 'fit-content', backgroundColor: 'rgba(62,111,89,0.1)', color: 'var(--status-positive)', borderColor: 'rgba(62,111,89,0.14)' }}
            title="Solutions available"
          >
            <CheckCircle2 size={14} />
            <span>Solutions</span>
          </div>
        )}

        {matchReasons.length > 0 && (
          <div className="match-reason-row" aria-label="Agent match reasons">
            {matchReasons.map((reason) => (
              <span key={reason} className="match-reason-chip">{reason}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text-normal)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: 'var(--header-secondary)' }}>Subject</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{subjectName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: 'var(--header-secondary)' }}>School</span>
            <span style={{ textAlign: 'right', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={schoolName}>
              {schoolName}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: 'var(--header-secondary)' }}>Year</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>
              {paper.y} - Year {paper.l}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <button
          onClick={() => onSelectPaper(paper)}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <FileText size={16} />
          <span>Practice</span>
        </button>
      </div>
    </div>
  );
}
