import React from 'react';
import { Search, RotateCcw, Check, Sparkles } from 'lucide-react';

export default function Filters({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedSchool,
  setSelectedSchool,
  selectedYear,
  setSelectedYear,
  solutionsOnly,
  setSolutionsOnly,
  schools,
  years,
  resetFilters,
  hasActiveFilters
}) {
  return (
    <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Search & Reset */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{
          position: 'relative',
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search style={{
            position: 'absolute',
            left: '16px',
            color: 'var(--text-muted)'
          }} size={20} />
          <input
            type="text"
            placeholder="Search 7,200+ past papers, schools, subjects or years..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px 16px 14px 48px',
              fontSize: '1rem',
              color: 'white',
              outline: 'none',
              transition: 'var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-indigo)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
        
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="btn-secondary"
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              gap: '6px'
            }}
            title="Reset All Filters"
          >
            <RotateCcw size={16} />
            <span style={{ fontSize: '0.95rem' }}>Reset</span>
          </button>
        )}
      </div>

      {/* Category Tabs & Quick Toggles */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Category Selector Cards */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-color)',
          padding: '4px',
          borderRadius: '10px',
          gap: '2px'
        }}>
          {[
            { id: null, label: 'All Resources' },
            { id: 'H', label: 'HSC Papers' },
            { id: 'T', label: 'Trial Exams' },
            { id: 'A', label: 'Internal Tasks' }
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.label}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  background: isSelected ? 'var(--accent-indigo)' : 'transparent',
                  color: isSelected ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Worked Solutions Toggle Card */}
        <button
          onClick={() => setSolutionsOnly(!solutionsOnly)}
          className="btn-secondary"
          style={{
            background: solutionsOnly ? 'var(--success-glow)' : 'transparent',
            borderColor: solutionsOnly ? 'var(--success)' : 'var(--border-color)',
            color: solutionsOnly ? '#ffffff' : 'var(--text-secondary)',
            borderRadius: '10px',
            padding: '8px 16px',
            gap: '8px'
          }}
        >
          {solutionsOnly ? (
            <div style={{
              background: 'var(--success)',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Check size={12} color="white" />
            </div>
          ) : (
            <Sparkles size={16} color="var(--accent-cyan)" />
          )}
          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Worked Solutions Only</span>
        </button>
      </div>

      {/* Select Box Dropdowns Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        borderTop: '1px solid var(--border-color)',
        paddingTop: '20px'
      }}>
        {/* School Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>
            Filter by School / Publisher
          </label>
          <select
            value={selectedSchool || ''}
            onChange={(e) => setSelectedSchool(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.9rem',
              color: 'white',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#0b0f19' }}>All Schools ({schools.length})</option>
            {schools.map((school, idx) => (
              <option key={idx} value={idx} style={{ background: '#0b0f19' }}>{school}</option>
            ))}
          </select>
        </div>

        {/* Year Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>
            Filter by Exam Year
          </label>
          <select
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(e.target.value || null)}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '0.9rem',
              color: 'white',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="" style={{ background: '#0b0f19' }}>All Years ({years.length})</option>
            {years.map((year) => (
              <option key={year} value={year} style={{ background: '#0b0f19' }}>{year}</option>
            ))}
          </select>
        </div>
      </div>

    </div>
  );
}
