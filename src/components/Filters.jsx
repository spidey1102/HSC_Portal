import React from 'react';
import { Search, XCircle, Check } from 'lucide-react';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      
      {/* Search Input (Discord Style) */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: 'min(240px, 40vw)'
      }}>
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="discord-input"
          style={{
            width: '100%',
            height: '24px',
            padding: '0 8px',
            paddingRight: '24px',
            fontSize: '14px',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-normal)'
          }}
        />
        <Search style={{
          position: 'absolute',
          right: '6px',
          color: 'var(--text-muted)'
        }} size={14} />
      </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--bg-modifier-accent)' }} />

      {/* Dropdown Filters */}
      <div style={{ display: 'flex', gap: '8px' }}>
        
        {/* Category */}
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          style={{
            backgroundColor: 'transparent',
            color: selectedCategory ? 'var(--interactive-active)' : 'var(--interactive-normal)',
            border: 'none',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            padding: '4px'
          }}
        >
          <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>All Types</option>
          <option value="H" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>HSC Papers</option>
          <option value="T" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>Trial Exams</option>
          <option value="A" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>Internal Tasks</option>
        </select>

        {/* Year */}
        <select
          value={selectedYear || ''}
          onChange={(e) => setSelectedYear(e.target.value || null)}
          style={{
            backgroundColor: 'transparent',
            color: selectedYear ? 'var(--interactive-active)' : 'var(--interactive-normal)',
            border: 'none',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            padding: '4px'
          }}
        >
          <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>Any Year</option>
          {years.map((year) => (
            <option key={year} value={year} style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>{year}</option>
          ))}
        </select>

        {/* School */}
        <select
          value={selectedSchool || ''}
          onChange={(e) => setSelectedSchool(e.target.value ? parseInt(e.target.value) : null)}
          style={{
            backgroundColor: 'transparent',
            color: selectedSchool !== null ? 'var(--interactive-active)' : 'var(--interactive-normal)',
            border: 'none',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
            padding: '4px',
            maxWidth: '120px'
          }}
        >
          <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>Any School</option>
          {schools.map((school, idx) => (
            <option key={idx} value={idx} style={{ background: 'var(--bg-secondary)', color: 'var(--text-normal)' }}>{school}</option>
          ))}
        </select>
      </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--bg-modifier-accent)' }} />

      {/* Solutions Toggle */}
      <button
        onClick={() => setSolutionsOnly(!solutionsOnly)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: solutionsOnly ? 'var(--status-positive)' : 'var(--interactive-normal)',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          padding: '4px'
        }}
        title="Show papers with worked solutions only"
      >
        <div style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: `1px solid ${solutionsOnly ? 'var(--status-positive)' : 'var(--interactive-normal)'}`,
          backgroundColor: solutionsOnly ? 'var(--status-positive)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {solutionsOnly && <Check size={12} color="white" />}
        </div>
        <span>Solutions</span>
      </button>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--status-danger)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            marginLeft: '4px'
          }}
          title="Reset Filters"
        >
          <XCircle size={18} />
        </button>
      )}

    </div>
  );
}
