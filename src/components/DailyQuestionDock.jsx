import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenCheck, FileUp, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAuth } from './AuthContext';
import { getDaily, getDailyFileUrl, openDailyFile, postDaily, uploadDailyFile } from '../utils/dailyApi';
import './DailyQuestionDock.css';

const todaySydney = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const emptyForm = () => ({
  title: '', subject: '', questionText: '', solutionText: '', publishDate: todaySydney(),
  questionFilePath: null, questionFileName: null, solutionFilePath: null, solutionFileName: null,
});

function RichText({ children }) {
  if (!children) return null;
  return <div className="daily-rich"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</ReactMarkdown></div>;
}

function InlineImage({ user, postId, kind, name }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl('');
    setError('');
    setExpanded(false);
    getDailyFileUrl(user, { postId, kind }).then((nextUrl) => {
      if (active) setUrl(nextUrl);
    }).catch((err) => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, [user, postId, kind]);

  return <figure className={`daily-inline-image${expanded ? ' expanded' : ''}`}>
    {!url && !error && <p className="daily-muted">Loading image…</p>}
    {error && <p role="alert" className="daily-error">{error}</p>}
    {url && <div className="daily-image-frame"><img src={url} alt={name || `${kind} attachment`} onError={() => { setUrl(''); setError('The image could not be loaded.'); }} /></div>}
    {url && <figcaption><span>{name || 'Attached image'}</span><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Fit to panel' : 'View full size'}</button></figcaption>}
  </figure>;
}

export default function DailyQuestionDock() {
  const { user, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('today');
  const [posts, setPosts] = useState([]);
  const [submittedIds, setSubmittedIds] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [managed, setManaged] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [questionFile, setQuestionFile] = useState(null);
  const [solutionFile, setSolutionFile] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answerFile, setAnswerFile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [posterUid, setPosterUid] = useState('');
  const [posterName, setPosterName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lastEditedId = useRef(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [publicData, identityData] = await Promise.all([
        getDaily(user),
        user ? getDaily(user, '?scope=identity') : Promise.resolve(null),
      ]);
      setPosts(publicData.posts || []);
      setSubmittedIds(publicData.submittedPostIds || []);
      setIdentity(identityData);
      if (identityData?.role) {
        const [manageData, contributorData] = await Promise.all([
          getDaily(user, '?scope=manage'),
          identityData.role === 'owner' ? getDaily(user, '?scope=contributors') : Promise.resolve(null),
        ]);
        setManaged(manageData.posts || []);
        setContributors(contributorData?.contributors || []);
      } else {
        setManaged([]);
        setContributors([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (open) reload(); }, [open, reload]);

  const current = posts[0] || null;
  const selected = useMemo(() => posts.find((post) => post.id === selectedId) || current, [posts, selectedId, current]);
  const edited = useMemo(() => managed.find((post) => post.id === manageId) || null, [managed, manageId]);

  useEffect(() => {
    if (lastEditedId.current === manageId || (manageId && !edited)) return;
    lastEditedId.current = manageId;
    if (!edited) {
      setForm(emptyForm());
    } else {
      setForm({
        title: edited.title, subject: edited.subject, questionText: edited.questionText,
        solutionText: edited.solutionText, publishDate: edited.publishDate,
        questionFilePath: edited.questionFilePath, questionFileName: edited.questionFileName,
        solutionFilePath: edited.solutionFilePath, solutionFileName: edited.solutionFileName,
      });
    }
    setQuestionFile(null);
    setSolutionFile(null);
    setSubmissions([]);
  }, [edited, manageId]);

  async function run(task, success) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      if (success) setNotice(success);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePost() {
    let id = manageId;
    if (!id) {
      const created = await postDaily(user, { action: 'create', ...form });
      id = created.post.id;
    }
    let next = { ...form };
    if (questionFile) {
      const upload = await uploadDailyFile(user, id, 'question', questionFile);
      next = { ...next, questionFilePath: upload.path, questionFileName: upload.name };
      setQuestionFile(null);
    }
    if (solutionFile) {
      const upload = await uploadDailyFile(user, id, 'solution', solutionFile);
      next = { ...next, solutionFilePath: upload.path, solutionFileName: upload.name };
      setSolutionFile(null);
    }
    const saved = await postDaily(user, { action: 'update', postId: id, ...next });
    setForm(next);
    setManageId(id);
    return saved.post;
  }

  async function showSubmissions(postId) {
    await run(async () => {
      const response = await getDaily(user, `?scope=submissions&postId=${encodeURIComponent(postId)}`);
      setSubmissions(response.submissions || []);
    });
  }

  const openFile = (params) => openDailyFile(user, params).catch((err) => setError(err.message));

  return <>
    <button type="button" className="daily-launch" onClick={() => setOpen(true)}>
      <BookOpenCheck size={18} /> Question of the Day
    </button>
    {open && <div className="daily-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="daily-panel" role="dialog" aria-modal="true" aria-label="Question of the Day">
        <header className="daily-header">
          <div><span className="daily-eyebrow">HSC Portal</span><h2>Question of the Day</h2></div>
          <button type="button" className="daily-icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={20} /></button>
        </header>
        <nav className="daily-tabs" aria-label="Daily question views">
          <button type="button" className={view === 'today' ? 'active' : ''} onClick={() => { setSelectedId(null); setView('today'); }}>Today</button>
          <button type="button" className={view === 'archive' ? 'active' : ''} onClick={() => setView('archive')}>Archive</button>
          {identity?.role && <button type="button" className={view === 'manage' ? 'active' : ''} onClick={() => setView('manage')}>Poster studio</button>}
        </nav>
        {error && <p role="alert" className="daily-error">{error}</p>}
        {notice && <p role="status" className="daily-notice">{notice}</p>}
        {loading && <p className="daily-muted">Loading questions…</p>}

        {(view === 'today' || view === 'archive') && <div className="daily-content">
          {view === 'archive' && <div className="daily-archive">
            {posts.map((post) => <button type="button" key={post.id} className={selected?.id === post.id ? 'active' : ''} onClick={() => setSelectedId(post.id)}>
              <small>{post.publishDate} · {post.subject || 'General'}</small><strong>{post.title}</strong>
            </button>)}
          </div>}
          {!selected && !loading && <p className="daily-empty">No question has been posted yet. Check back soon.</p>}
          {selected && <article className="daily-question">
            <div className="daily-meta">{selected.publishDate} · {selected.subject || 'General'}</div>
            <h3>{selected.title}</h3>
            <RichText>{selected.questionText}</RichText>
            {selected.hasQuestionFile && selected.questionIsImage && <InlineImage user={user} postId={selected.id} kind="question" name={selected.questionFileName} />}
            {selected.hasQuestionFile && !selected.questionIsImage && <button type="button" className="daily-file" onClick={() => openFile({ postId: selected.id, kind: 'question' })}>
              <FileUp size={16} /> Open question attachment: {selected.questionFileName || 'file'}
            </button>}
            {selected.solutionReleased && <div className="daily-solution">
              <h4>Official solution</h4><RichText>{selected.solutionText}</RichText>
              {selected.hasSolutionFile && selected.solutionIsImage && <InlineImage user={user} postId={selected.id} kind="solution" name={selected.solutionFileName} />}
              {selected.hasSolutionFile && !selected.solutionIsImage && <button type="button" className="daily-file" onClick={() => openFile({ postId: selected.id, kind: 'solution' })}>
                <FileUp size={16} /> Open solution attachment: {selected.solutionFileName || 'file'}
              </button>}
            </div>}
            {!user && <div className="daily-answer"><p>Sign in to submit your answer.</p><button type="button" onClick={() => signInWithGoogle().catch((err) => setError(err.message))}>Sign in with Google</button></div>}
            {user && submittedIds.includes(selected.id) && <p className="daily-confirmation">Your answer has been submitted. Only this question’s poster can view it.</p>}
            {user && !submittedIds.includes(selected.id) && <form className="daily-answer" onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const upload = answerFile ? await uploadDailyFile(user, selected.id, 'answer', answerFile) : null;
                await postDaily(user, { action: 'submit', postId: selected.id, answerText, filePath: upload?.path, fileName: upload?.name });
                setAnswerText(''); setAnswerFile(null);
              }, 'Answer submitted privately to the poster.');
            }}>
              <label htmlFor="daily-answer-text">Your answer</label>
              <textarea id="daily-answer-text" value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="Write your reasoning, or attach your handwritten work." rows={5} />
              <label className="daily-upload">Attach a PDF or image (up to 20 MB)
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setAnswerFile(event.target.files?.[0] || null)} />
              </label>
              {answerFile && <small>{answerFile.name}</small>}
              <button type="submit" disabled={busy || (!answerText.trim() && !answerFile)}>Submit privately</button>
            </form>}
          </article>}
        </div>}

        {view === 'manage' && identity?.role && <div className="daily-manage">
          <aside className="daily-manage-list">
            <button type="button" onClick={() => setManageId(null)}>+ New question</button>
            {managed.map((post) => <button type="button" key={post.id} className={manageId === post.id ? 'active' : ''} onClick={() => setManageId(post.id)}>
              <small>{post.publishDate} · {post.published ? 'Published' : 'Draft'}</small><strong>{post.title}</strong>
            </button>)}
          </aside>
          <div className="daily-editor">
            <p className="daily-muted">Signed in as {identity.uid} · {identity.role}</p>
            <label>Title<input value={form.title} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} disabled={edited?.published} /></label>
            <label>Subject<input value={form.subject} maxLength={80} onChange={(event) => setForm({ ...form, subject: event.target.value })} disabled={edited?.published} /></label>
            <label>Day (Sydney time)<input type="date" value={form.publishDate} onChange={(event) => setForm({ ...form, publishDate: event.target.value })} disabled={edited?.published} /></label>
            <label>Question<textarea rows={5} value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} disabled={edited?.published} /></label>
            <label className="daily-upload">Question PDF or image
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setQuestionFile(event.target.files?.[0] || null)} disabled={edited?.published} />
            </label>
            {(questionFile || form.questionFileName) && <small>{questionFile?.name || form.questionFileName}</small>}
            <label>Official solution<textarea rows={5} value={form.solutionText} onChange={(event) => setForm({ ...form, solutionText: event.target.value })} disabled={edited?.solutionReleased} /></label>
            <label className="daily-upload">Solution PDF or image
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setSolutionFile(event.target.files?.[0] || null)} disabled={edited?.solutionReleased} />
            </label>
            {(solutionFile || form.solutionFileName) && <small>{solutionFile?.name || form.solutionFileName}</small>}
            <div className="daily-actions">
              <button type="button" disabled={busy || !form.title} onClick={() => run(savePost, 'Draft saved.')}>Save</button>
              {edited && !edited.published && <button type="button" disabled={busy} onClick={() => run(async () => { await savePost(); await postDaily(user, { action: 'publish', postId: edited.id }); }, 'Question published for its scheduled day.')}>Publish</button>}
              {edited?.published && !edited.solutionReleased && <button type="button" disabled={busy} onClick={() => run(async () => { await savePost(); await postDaily(user, { action: 'release', postId: edited.id }); }, 'Official solution released.')}>Reveal solution</button>}
            </div>
            {edited && edited.authorUid === identity.uid && <section className="daily-submissions">
              <h4>Student submissions</h4>
              <button type="button" disabled={busy} onClick={() => showSubmissions(edited.id)}>Load private submissions</button>
              {submissions.map((submission, index) => <article key={submission.id}>
                <strong>Submission {submissions.length - index}</strong> <small>{new Date(submission.createdAt).toLocaleString()}</small>
                <RichText>{submission.answerText}</RichText>
                {submission.hasFile && <button type="button" className="daily-file" onClick={() => openFile({ postId: edited.id, kind: 'answer', submissionId: submission.id })}>Open {submission.fileName || 'attachment'}</button>}
              </article>)}
            </section>}
            {identity.role === 'owner' && <section className="daily-contributors">
              <h4>Trusted posters</h4>
              <p className="daily-muted">Add a Firebase UID to allow that account to create questions.</p>
              <input value={posterUid} onChange={(event) => setPosterUid(event.target.value)} placeholder="Firebase UID" />
              <input value={posterName} onChange={(event) => setPosterName(event.target.value)} placeholder="Display name (optional)" />
              <button type="button" disabled={busy || !posterUid.trim()} onClick={() => run(async () => {
                await postDaily(user, { action: 'grant', uid: posterUid.trim(), displayName: posterName.trim() });
                setPosterUid(''); setPosterName('');
              }, 'Poster access granted.')}>Add poster</button>
              {contributors.map((person) => <div key={person.firebase_uid} className="daily-person">
                <span>{person.display_name || person.firebase_uid} {person.active ? '' : '(inactive)'}</span>
                {person.active && <button type="button" disabled={busy} onClick={() => run(() => postDaily(user, { action: 'revoke', uid: person.firebase_uid }), 'Poster access removed.')}>Remove access</button>}
              </div>)}
            </section>}
          </div>
        </div>}
      </section>
    </div>}
  </>;
}
