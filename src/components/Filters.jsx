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
  yearSort,
  setYearSort,
  sortMode,
  setSortMode,
  solutionsOnly,
  setSolutionsOnly,
  schools,
  years,
  resetFilters,
  hasActiveFilters
}) {
  return (
    <div className="control-strip" style={{ justifyContent: 'flex-end' }}>
      <div className="search-field">
        <input
          type="text"
          placeholder="Search papers, schools, years"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="discord-input"
        />
        <Search size={16} />
      </div>

      <select
        value={selectedCategory || ''}
        onChange={(e) => setSelectedCategory(e.target.value || null)}
        className="field"
        style={{ padding: '0 12px', minWidth: '150px' }}
      >
        <option value="">All types</option>
        <option value="H">HSC papers</option>
        <option value="T">Trial exams</option>
        <option value="A">Internal tasks</option>
      </select>

      <select
        value={selectedYear || ''}
        onChange={(e) => setSelectedYear(e.target.value || null)}
        className="field"
        style={{ padding: '0 12px', minWidth: '120px' }}
      >
        <option value="">Any year</option>
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>

      <select
        value={sortMode || (yearSort === 'asc' ? 'year-asc' : yearSort === 'none' ? 'default' : 'year-desc')}
        onChange={(e) => {
          setSortMode(e.target.value);
          setYearSort(e.target.value === 'year-asc' ? 'asc' : e.target.value === 'default' ? 'none' : 'desc');
        }}
        className="field"
        style={{ padding: '0 12px', minWidth: '170px' }}
        title="Sort papers"
      >
        <option value="year-desc">Newest first</option>
        <option value="year-asc">Oldest first</option>
        <option value="name-asc">Name A-Z</option>
        <option value="school-asc">School A-Z</option>
        <option value="solutions-first">Solutions first</option>
        <option value="default">Default order</option>
      </select>

      <select
        value={selectedSchool || ''}
        onChange={(e) => setSelectedSchool(e.target.value ? parseInt(e.target.value, 10) : null)}
        className="field"
        style={{ padding: '0 12px', minWidth: '160px', maxWidth: '220px' }}
      >
        <option value="">Any school</option>
        {schools.map((school, idx) => (
          <option key={idx} value={idx}>{school}</option>
        ))}
      </select>

      <button
        onClick={() => setSolutionsOnly(!solutionsOnly)}
        className={`chip ${solutionsOnly ? 'is-active' : ''}`}
        title="Show papers with worked solutions only"
      >
        <span style={{
          width: '16px',
          height: '16px',
          borderRadius: '5px',
          border: `1px solid ${solutionsOnly ? '#fff' : 'var(--interactive-muted)'}`,
          backgroundColor: solutionsOnly ? 'rgba(255,255,255,0.18)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {solutionsOnly && <Check size={11} color="white" />}
        </span>
        <span>Solutions</span>
      </button>

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="btn-secondary"
          style={{ padding: '10px 12px', color: 'var(--status-danger)' }}
          title="Reset filters"
        >
          <XCircle size={16} />
        </button>
      )}
    </div>
  );
}
