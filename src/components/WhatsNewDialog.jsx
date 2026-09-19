import { Check, X } from 'lucide-react';
import { useEscapeKey } from '../utils/useEscapeKey';
import { usePresence } from '../utils/usePresence';

const RELEASES = [
  {
    label: 'Now available',
    title: 'A simpler Paper Room',
    items: [
      'Browse and search HSC papers by subject, year and school.',
      'Use Today for a suggested paper, or choose one yourself from the Library.',
      'Read papers with the exam timer, annotations, zoom and data sheets.',
      'Review your work, track mistakes and keep a study notebook.',
      'Set up your year, subjects and study preferences on one page.',
      'Turn paper tools on or off in Preferences. The exam timer stays available.',
      'Use Today, Library, Calendar, Notebook and History from one workspace.',
    ],
  },
  {
    label: '19 September 2026 · d91ba34',
    title: 'NSW Maths events',
    items: [
      'See NSW Maths classes, revision sessions and mock exams.',
      'Open dates and bookings from the banner or the section bar.',
      'Minimise the banner when you want more room for your papers.',
    ],
  },
];

const COMMIT_HISTORY = [
  ['9228485', '18 May 2026', 'Initial HSC past papers portal release'],
  ['a4dc003', '19 May 2026', 'Redesigned the interface around a Discord-style layout'],
  ['7529ca9', '19 May 2026', 'Added the Textbooks server and library view'],
  ['15b5072', '20 May 2026', 'Added the mobile layout and sidebar toggle'],
  ['96a0475', '20 May 2026', 'Added the collapsible tools panel and compact timer'],
  ['3934660', '24 May 2026', 'Added split-screen formula sheets'],
  ['090da40', '25 May 2026', 'Added the HSC exam countdown and subject channels'],
  ['a49cb85', '25 May 2026', 'Added custom Practice Room timer durations'],
  ['583afa1', '25 May 2026', 'Added sort by year to the paper list'],
  ['1a60db1', '25 May 2026', 'Added the study calendar'],
  ['7491e04', '25 May 2026', 'Added custom assessments with dates, subjects and topics'],
  ['18f4bee', '25 May 2026', 'Redesigned the study portal and added dark mode'],
  ['c4cd7d1', '25 May 2026', 'Added share links for papers'],
  ['18bc9d5', '4 Jun 2026', 'Added Paper History and mark paper complete'],
  ['048a720', '4 Jun 2026', 'Added subject routes and subject links'],
  ['e83ff0d', '22 Jun 2026', 'Added the agentic paper finder'],
  ['c33e186', '22 Jun 2026', 'Connected paper search to OpenRouter with a local fallback'],
  ['269392e', '30 Jun 2026', 'Added the Agent Command Center'],
  ['7c404e7', '2 Jul 2026', 'Added chat history and fixed shared paper links'],
  ['d76677b', '2 Jul 2026', 'Added themes'],
  ['3c3351c', '23 Jul 2026', 'Improved sign-in, redirects and error handling'],
  ['f118207', '23 Jul 2026', 'Saved the selected subject and year to Firebase'],
  ['b2981ff', '9 Aug 2026', 'Restored HSC papers and improved PDF loading'],
  ['5c788ec', '11 Aug 2026', 'Made subject selection dynamic'],
  ['ba4a619', '11 Aug 2026', 'Streamlined the mobile reader tools'],
  ['97ea8d6', '12 Aug 2026', 'Served PDFs through the paper CDN'],
  ['5373cd7', '18 Aug 2026', 'Refined study layouts and paper-aware AI'],
  ['41036a4', '18 Aug 2026', 'Added continuous paper loading and the timer wheel'],
  ['379bd16', '18 Aug 2026', 'Added formatted AI study responses'],
  ['b65da25', '18 Aug 2026', 'Added adaptive paper recommendations'],
  ['aaeda19', '18 Aug 2026', 'Synced subjects and paper history to Firebase'],
  ['e22eb72', '18 Aug 2026', 'Added paper reviews and shared metadata'],
  ['37f89ae', '18 Aug 2026', 'Added paper sorting controls'],
  ['6419c35', '19 Aug 2026', 'Moved the portal to its dedicated Firebase project'],
  ['bc51109', '20 Aug 2026', 'Added LaTeX rendering to Paper Margin'],
  ['e4939ab', '20 Aug 2026', 'Kept AI conversation context between questions'],
  ['705b3d0', '20 Aug 2026', 'Added switchable portal layouts and keyboard shortcuts'],
  ['7a60054', '20 Aug 2026', 'Added AI challenge recommendations'],
  ['f40e123', '20 Aug 2026', 'Added background paper analysis with progress'],
  ['f684f60', '21 Aug 2026', 'Added the Gemma chat provider'],
  ['b3e1536', '21 Aug 2026', 'Added chat fallback when a provider is unavailable'],
  ['957dbb5', '21 Aug 2026', 'Sent Paper Margin questions through AI'],
  ['abc4c73', '23 Aug 2026', 'Added cached question topic labels'],
  ['44d8921', '23 Aug 2026', 'Added cached question discovery to AI chat'],
  ['9d50cb6', '23 Aug 2026', 'Added question subparts to the question map'],
  ['26d2ddc', '23 Aug 2026', 'Added personalised question discovery'],
  ['8ad426a', '25 Aug 2026', 'Added a paper download control'],
  ['e665503', '25 Aug 2026', 'Opened native print and download controls'],
  ['b91a513', '26 Aug 2026', 'Added cached question recommendations to Today'],
  ['bc8be7e', '26 Aug 2026', 'Added subject tabs to question recommendations'],
  ['d91ba34', '19 Sep 2026', 'Added NSW Maths classes, revision sessions and mock exams'],
];

export default function WhatsNewDialog({ isOpen, onClose }) {
  const presence = usePresence(isOpen, 220);
  useEscapeKey(isOpen, onClose);

  if (!presence.mounted) return null;

  return (
    <div className={`dialog-backdrop is-${presence.stage}`} role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        style={{ width: 'min(620px, 100%)' }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <div className="kick">What&apos;s new</div>
            <h3 id="whats-new-title">What you can do here</h3>
            <p>Recent updates and the main features in the Paper Room.</p>
          </div>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose} aria-label="Close what&apos;s new">
            <X size={15} />
          </button>
        </div>

        <div className="dialog-scroll">
          {RELEASES.map((release) => (
            <section key={release.title} className="dialog-row">
              <div className="kick">{release.label}</div>
              <h4 style={{ margin: '6px 0 10px', fontSize: '19px' }}>{release.title}</h4>
              <ul style={{ display: 'grid', gap: '9px', margin: 0, padding: 0, listStyle: 'none' }}>
                {release.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', lineHeight: 1.45 }}>
                    <Check size={15} style={{ flex: 'none', marginTop: '2px', color: 'var(--color-accent)' }} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="dialog-row">
            <div className="kick">Product history</div>
            <h4 style={{ margin: '6px 0 10px', fontSize: '19px' }}>Changes by commit</h4>
            <p className="dim" style={{ margin: '0 0 14px', fontSize: '12px' }}>
              Major product commits are listed below. Automated paper index updates are grouped together.
            </p>
            <div style={{ display: 'grid', gap: '1px' }}>
              {COMMIT_HISTORY.map(([commit, date, summary]) => (
                <div key={commit} style={{ display: 'grid', gridTemplateColumns: '72px 92px minmax(0, 1fr)', gap: '10px', alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid var(--color-divider)', fontSize: '12px' }}>
                  <code className="num" style={{ color: 'var(--color-accent)' }}>{commit}</code>
                  <span className="dim">{date}</span>
                  <span>{summary}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="dialog-foot" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}
