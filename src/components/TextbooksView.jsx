import React, { useState, useEffect } from 'react';
import { Book, ExternalLink, RefreshCw } from 'lucide-react';

export default function TextbooksView() {
  const [textbooks, setTextbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/textbooks.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load textbooks.');
        return res.json();
      })
      .then((data) => {
        setTextbooks(data.textbooks || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <section className="content-band">
      <div className="hero-stack" style={{ marginBottom: '20px' }}>
        <div className="eyebrow">Library</div>
        <div className="hero-title">
          <h2 className="page-title">Textbooks and reference material</h2>
          <p className="page-copy">
            Open subject folders without leaving the portal.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '16px' }}>
          <RefreshCw size={28} color="var(--text-muted)" className="spin" />
          <h3 style={{ color: 'var(--text-normal)' }}>Loading textbooks</h3>
        </div>
      ) : error ? (
        <div style={{ padding: '24px', background: 'rgba(163,61,61,0.08)', borderRadius: '16px', color: 'var(--header-primary)', border: '1px solid rgba(163,61,61,0.16)' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--status-danger)' }}>Load error</h3>
          <p>{error}</p>
        </div>
      ) : textbooks.length > 0 ? (
        <div className="papers-grid">
          {textbooks.map((book) => (
            <div key={book.id} className="paper-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="pill" style={{ width: 'fit-content', backgroundColor: 'rgba(53,91,79,0.08)', color: 'var(--brand-experiment)' }}>
                  <Book size={12} />
                  <span>{book.subject}</span>
                </div>

                <h3 style={{ fontSize: '17px', color: 'var(--header-primary)', lineHeight: 1.35 }}>
                  {book.title}
                </h3>

                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  {book.description}
                </p>
              </div>

              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '18px' }}
              >
                <ExternalLink size={16} />
                Open in Google Drive
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3 style={{ color: 'var(--header-primary)', marginBottom: '8px' }}>No textbooks found</h3>
          <p>We could not find any textbooks to display right now.</p>
        </div>
      )}
    </section>
  );
}
