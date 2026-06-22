import React from 'react';
import { Cloud, FileSearch, RefreshCw } from 'lucide-react';

export default function PapersLoadingState() {
  return (
    <div className="papers-loading-state">
      <div className="loading-orb"><RefreshCw className="spin" size={24} /></div>
      <div>
        <h3>Loading the paper library</h3>
        <p>Fetching the index and preparing Google Drive paper links. Large paper sets can take a moment.</p>
      </div>
      <div className="loading-steps">
        <span><FileSearch size={14} /> Reading paper metadata</span>
        <span><Cloud size={14} /> Warming Drive resources</span>
      </div>
      <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div className="paper-skeleton" key={i} />)}</div>
    </div>
  );
}
