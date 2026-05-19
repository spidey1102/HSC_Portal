import React, { useState, useEffect } from 'react';
import { Book, ExternalLink, RefreshCw } from 'lucide-react';

export default function TextbooksView() {
  const [textbooks, setTextbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/textbooks.json')
      .then(res => {
        if (!res.ok) throw new Error("Failed to load textbooks.");
        return res.json();
      })
      .then(data => {
        setTextbooks(data.textbooks || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      {/* Welcome Message (Discord style start of channel) */}
      <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <Book size={40} color="var(--header-primary)" />
        </div>
        <h1 style={{ fontSize: '32px', color: 'var(--header-primary)', marginBottom: '8px' }}>
          Welcome to #textbooks!
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          This is your library of textbook resources. Click on a link below to open the Google Drive folder.
        </p>
      </div>

      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 0',
          gap: '16px'
        }}>
          <RefreshCw size={32} color="var(--text-muted)" style={{ animation: 'spin 2s linear infinite' }} />
          <h3 style={{ color: 'var(--text-normal)' }}>Loading textbooks...</h3>
        </div>
      ) : error ? (
        <div style={{ padding: '24px', background: 'var(--status-danger)', borderRadius: '4px', color: 'white' }}>
          <h3 style={{ marginBottom: '8px', color: 'white' }}>Load Error</h3>
          <p>{error}</p>
        </div>
      ) : textbooks.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {textbooks.map((book) => (
            <div key={book.id} className="paper-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    backgroundColor: 'var(--brand-experiment)',
                    color: 'white'
                  }}>
                    <Book size={12} />
                    {book.subject}
                  </div>
                </div>
                
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  color: 'var(--header-primary)', 
                  marginBottom: '8px',
                  lineHeight: 1.4
                }}>
                  {book.title}
                </h3>
                
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-normal)',
                  marginBottom: '16px'
                }}>
                  {book.description}
                </p>
              </div>

              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                marginTop: 'auto'
              }}>
                <a 
                  href={book.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}
                >
                  <ExternalLink size={16} />
                  Open in Google Drive
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          borderRadius: '8px'
        }}>
          <h3 style={{ color: 'var(--header-primary)', marginBottom: '8px' }}>No textbooks found</h3>
          <p>We couldn't find any textbooks to display right now.</p>
        </div>
      )}
    </div>
  );
}
