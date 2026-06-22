import React, { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Link2, Mail, MessageCircle, Share2, X } from 'lucide-react';

export default function ShareMenu({ paper, getUrl, onCopied, buttonClassName = 'btn-secondary', buttonLabel = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const url = paper ? getUrl(paper) : window.location.href;
  const title = paper?.n || 'HSC Portal';

  useEffect(() => {
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  const copy = async () => {
    await navigator.clipboard?.writeText(url);
    onCopied?.('Share link copied');
    setOpen(false);
  };

  const options = [
    { label: 'Copy link', icon: Copy, action: copy },
    { label: 'Open link', icon: ExternalLink, href: url },
    { label: 'Email', icon: Mail, href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
    { label: 'SMS', icon: MessageCircle, href: `sms:?&body=${encodeURIComponent(`${title} ${url}`)}` },
  ];

  return (
    <div className="share-menu-wrap" ref={ref}>
      <button type="button" className={buttonClassName} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} title="Share options">
        <Share2 size={16} />
        {buttonLabel && <span>{buttonLabel}</span>}
      </button>
      {open && (
        <div className="share-popover animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <div className="share-popover-head">
            <div><strong>Share paper</strong><span>{title}</span></div>
            <button type="button" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          <div className="share-link-preview"><Link2 size={14} /><span>{url}</span></div>
          <div className="share-option-grid">
            {options.map((option) => {
              const Icon = option.icon;
              const content = <><Icon size={16} /><span>{option.label}</span></>;
              return option.href ? (
                <a key={option.label} className="share-option" href={option.href} target={option.label === 'Open link' ? '_blank' : undefined} rel="noreferrer">{content}</a>
              ) : (
                <button key={option.label} type="button" className="share-option" onClick={option.action}>{content}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
