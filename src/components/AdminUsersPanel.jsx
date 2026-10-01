import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';
import { getAdminUserActivity, getAdminUserDetail, getAdminUsers } from '../utils/adminUsersApi';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function jsonText(value) {
  if (value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2) ?? '—';
  } catch {
    return String(value);
  }
}

function JsonBlock({ value }) {
  return <pre className="admin-users-json">{jsonText(value)}</pre>;
}

function ProfileField({ label, value }) {
  return <div className="admin-users-profile-field"><span>{label}</span><strong>{formatValue(value)}</strong></div>;
}

function providerLabel(providers) {
  if (!providers?.length) return 'No linked providers';
  return providers.map((provider) => provider.providerId || 'Unknown provider').join(' · ');
}

function directorySearchText(account) {
  return [
    account.email,
    account.displayName,
    account.uid,
    ...(account.providers || []).flatMap((provider) => [provider.providerId, provider.email, provider.displayName, provider.uid]),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function ActivitySection({ title, section, activity, loading, error, sourceWarning, onLoadMore }) {
  const items = activity?.items || [];
  return (
    <section className="admin-users-activity-section">
      <div className="admin-users-section-heading"><h3>{title}</h3><span>{items.length.toLocaleString()} loaded</span></div>
      {items.length === 0 && !loading && !error && <p className="admin-users-muted">{sourceWarning ? `No ${title.toLocaleLowerCase()} rows returned; review the source warnings above to check availability.` : `No ${title.toLocaleLowerCase()} found for this account.`}</p>}
      {items.length > 0 && <div className="admin-users-activity-list">
        {items.map((item, index) => {
          const label = item?.id || item?.post_id || item?.submission_id || item?.created_at || `${title.slice(0, -1)} ${index + 1}`;
          return <details className="admin-users-record" key={`${section}-${item?.id || item?.post_id || item?.submission_id || index}`}>
            <summary><strong>{formatValue(label)}</strong><span>Record {index + 1}</span></summary>
            <JsonBlock value={item} />
          </details>;
        })}
      </div>}
      {error && <p className="admin-users-inline-error" role="alert">{error}</p>}
      {loading && <p className="admin-users-muted" role="status"><LoaderCircle size={14} className="admin-users-spinner" /> Loading more {title.toLocaleLowerCase()}…</p>}
      {activity?.nextOffset !== null && activity?.nextOffset !== undefined && <button type="button" className="admin-users-button admin-users-page-button" onClick={() => onLoadMore(section)} disabled={loading}>{loading ? 'Loading…' : `Load more ${title.toLocaleLowerCase()}`}</button>}
    </section>
  );
}

export default function AdminUsersPanel({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [pageToken, setPageToken] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [activityLoading, setActivityLoading] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const pageTokenRef = useRef(null);
  const listSequenceRef = useRef(0);
  const listAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const activityAbortRefs = useRef({});
  const selectedUidRef = useRef('');

  const loadDirectory = useCallback(async (append = false) => {
    const sequence = ++listSequenceRef.current;
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setListError('');
    if (append) setLoadingMore(true);
    else setListLoading(true);

    try {
      const payload = await getAdminUsers(user, { pageToken: append ? pageTokenRef.current : null, signal: controller.signal });
      if (controller.signal.aborted || sequence !== listSequenceRef.current) return;
      if (!Array.isArray(payload.users)) throw new Error('The account directory response was incomplete.');
      if (append) {
        setAccounts((current) => {
          const known = new Set(current.map((account) => account.uid));
          return [...current, ...payload.users.filter((account) => !known.has(account.uid))];
        });
      } else {
        setAccounts(payload.users);
      }
      const next = payload.nextPageToken || null;
      pageTokenRef.current = next;
      setPageToken(next);
    } catch (error) {
      if (!controller.signal.aborted && sequence === listSequenceRef.current) {
        setListError(error.message || 'The account directory could not be loaded.');
      }
    } finally {
      if (sequence === listSequenceRef.current) {
        setListLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadDirectory(false);
    return () => {
      listSequenceRef.current += 1;
      listAbortRef.current?.abort();
      detailAbortRef.current?.abort();
      Object.values(activityAbortRefs.current).forEach((controller) => controller?.abort());
    };
  }, [loadDirectory]);

  useEffect(() => {
    detailAbortRef.current?.abort();
    Object.values(activityAbortRefs.current).forEach((controller) => controller?.abort());
    activityAbortRefs.current = {};
    setActivityLoading({});
    setActivityErrors({});
    setDetail(null);
    setDetailError('');
    if (!selectedUid) {
      setDetailLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    detailAbortRef.current = controller;
    let active = true;
    setDetailLoading(true);
    getAdminUserDetail(user, selectedUid, { signal: controller.signal })
      .then((payload) => {
        if (!active) return;
        if (!payload.account || payload.account.uid !== selectedUid) throw new Error('The selected account details were incomplete.');
        setDetail(payload);
      })
      .catch((error) => {
        if (active && !controller.signal.aborted) setDetailError(error.message || 'The selected account details could not be loaded.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, selectedUid, detailRetry]);

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) => directorySearchText(account).includes(needle));
  }, [accounts, search]);

  const selectAccount = (uid) => {
    if (selectedUidRef.current === uid) return;
    selectedUidRef.current = uid;
    setSelectedUid(uid);
    setDetail(null);
    setDetailError('');
  };

  const loadMoreActivity = async (section) => {
    const uid = selectedUidRef.current;
    const offset = detail?.[section]?.nextOffset;
    if (!uid || offset === null || offset === undefined || activityLoading[section]) return;

    activityAbortRefs.current[section]?.abort();
    const controller = new AbortController();
    activityAbortRefs.current[section] = controller;
    setActivityLoading((current) => ({ ...current, [section]: true }));
    setActivityErrors((current) => ({ ...current, [section]: '' }));
    try {
      const payload = await getAdminUserActivity(user, uid, section, offset, { signal: controller.signal });
      if (controller.signal.aborted || selectedUidRef.current !== uid) return;
      if (!Array.isArray(payload.items)) throw new Error(`The next ${section} page was incomplete.`);
      setDetail((current) => {
        if (current?.account?.uid !== uid) return current;
        const previous = current[section] || { items: [], nextOffset: null };
        return { ...current, [section]: { items: [...previous.items, ...payload.items], nextOffset: payload.nextOffset ?? null } };
      });
    } catch (error) {
      if (!controller.signal.aborted && selectedUidRef.current === uid) {
        setActivityErrors((current) => ({ ...current, [section]: error.message || `The next ${section} page could not be loaded.` }));
      }
    } finally {
      if (!controller.signal.aborted && selectedUidRef.current === uid) setActivityLoading((current) => ({ ...current, [section]: false }));
    }
  };

  const activeDetail = detail?.account?.uid === selectedUid ? detail : null;
  const submissions = activeDetail?.submissions || { items: [], nextOffset: null };
  const posts = activeDetail?.posts || { items: [], nextOffset: null };
  const hasSourceWarnings = Boolean(activeDetail?.warnings?.length);

  return (
    <div className="admin-users-layout">
      <section className="admin-users-directory" aria-label="Registered accounts">
        <div className="admin-users-directory-tools">
          <label className="admin-users-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loaded accounts" aria-label="Search loaded accounts" /></label>
          <div className="admin-users-directory-actions">
            <span>{accounts.length.toLocaleString()} loaded</span>
            <button type="button" className="admin-users-icon-button" onClick={() => loadDirectory(false)} disabled={listLoading || loadingMore} aria-label="Refresh accounts" title="Refresh accounts"><RefreshCw size={15} /></button>
          </div>
          <p>Search applies to accounts loaded so far.</p>
        </div>
        {listError && <div className="admin-users-error" role="alert"><AlertTriangle size={15} /><span>{listError}</span>{!accounts.length && <button type="button" onClick={() => loadDirectory(false)}>Retry</button>}</div>}
        <div className="admin-users-account-list">
          {listLoading && !accounts.length && <div className="admin-users-empty" role="status"><LoaderCircle size={16} className="admin-users-spinner" /> Loading registered accounts…</div>}
          {!listLoading && !accounts.length && !listError && <div className="admin-users-empty"><Users size={20} />No Firebase accounts found.</div>}
          {accounts.length > 0 && filteredAccounts.map((account) => {
            const isSelected = selectedUid === account.uid;
            return <button type="button" className={`admin-users-account${isSelected ? ' is-selected' : ''}`} key={account.uid} onClick={() => selectAccount(account.uid)} aria-pressed={isSelected}>
              <span className="admin-users-account-heading"><strong>{account.displayName || account.email || 'Unnamed account'}</strong><span className={`admin-users-role role-${account.role || 'student'}`}>{account.role || 'student'}</span></span>
              <span className="admin-users-account-email">{account.email || 'No email address'}</span>
              <span className="admin-users-account-uid">UID · {account.uid}</span>
              <span className="admin-users-account-meta">{providerLabel(account.providers)} · {account.disabled ? 'Disabled' : 'Enabled'} · {account.emailVerified ? 'Email verified' : 'Email unverified'}</span>
            </button>;
          })}
          {accounts.length > 0 && filteredAccounts.length === 0 && <div className="admin-users-empty">No loaded accounts match this search.</div>}
          {listLoading && accounts.length > 0 && <p className="admin-users-loading-more" role="status"><LoaderCircle size={14} className="admin-users-spinner" /> Updating account directory…</p>}
          {pageToken && <button type="button" className="admin-users-button admin-users-directory-more" onClick={() => loadDirectory(true)} disabled={listLoading || loadingMore}>{loadingMore ? 'Loading accounts…' : 'Load more accounts'}</button>}
        </div>
      </section>

      <section className="admin-users-detail" aria-label="Selected account details">
        {!selectedUid && <div className="admin-users-empty admin-users-detail-empty"><Users size={23} /><strong>Select an account</strong><span>Choose a loaded account to inspect its profile and stored activity.</span></div>}
        {selectedUid && detailLoading && !activeDetail && <div className="admin-users-empty admin-users-detail-empty" role="status"><LoaderCircle size={17} className="admin-users-spinner" /> Loading account details…</div>}
        {selectedUid && detailError && !activeDetail && <div className="admin-users-error admin-users-detail-error" role="alert"><AlertTriangle size={16} /><span>{detailError}</span><button type="button" onClick={() => setDetailRetry((count) => count + 1)}>Retry</button></div>}
        {activeDetail && <div className="admin-users-detail-scroll">
          {detailError && <div className="admin-users-error" role="alert"><AlertTriangle size={15} /><span>{detailError}</span><button type="button" onClick={() => setDetailRetry((count) => count + 1)}>Reload details</button></div>}
          <header className="admin-users-detail-heading"><div><span>Firebase account</span><h2>{activeDetail.account.displayName || activeDetail.account.email || activeDetail.account.uid}</h2><p>{activeDetail.account.uid}</p></div><span className={`admin-users-role role-${activeDetail.account.role || 'student'}`}>{activeDetail.account.role || 'student'}</span></header>
          {!!activeDetail.warnings?.length && <div className="admin-users-warning" role="status"><AlertTriangle size={16} /><div><strong>Some stored sources could not be loaded</strong><ul>{activeDetail.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div></div>}

          <section className="admin-users-detail-section"><h3>Profile and account status</h3>
            <div className="admin-users-profile-grid">
              <ProfileField label="Email" value={activeDetail.account.email} />
              <ProfileField label="Display name" value={activeDetail.account.displayName} />
              <ProfileField label="UID" value={activeDetail.account.uid} />
              <ProfileField label="Photo URL" value={activeDetail.account.photoURL} />
              <ProfileField label="Phone number" value={activeDetail.account.phoneNumber} />
              <ProfileField label="Email verified" value={activeDetail.account.emailVerified} />
              <ProfileField label="Account disabled" value={activeDetail.account.disabled} />
              <ProfileField label="Portal role" value={activeDetail.account.role} />
              <ProfileField label="Created" value={activeDetail.account.metadata?.creationTime} />
              <ProfileField label="Last sign-in" value={activeDetail.account.metadata?.lastSignInTime} />
              <ProfileField label="Last token refresh" value={activeDetail.account.metadata?.lastRefreshTime} />
              <ProfileField label="Tokens valid after" value={activeDetail.account.tokensValidAfterTime} />
              <ProfileField label="Tenant ID" value={activeDetail.account.tenantId} />
            </div>
            <div className="admin-users-provider-list"><h4>Linked sign-in providers</h4>
              {activeDetail.account.providers?.length ? activeDetail.account.providers.map((provider, index) => <div className="admin-users-provider" key={`${provider.providerId}-${provider.uid}-${index}`}>
                <strong>{provider.providerId || 'Unknown provider'}</strong>
                <div className="admin-users-profile-grid"><ProfileField label="Provider UID" value={provider.uid} /><ProfileField label="Display name" value={provider.displayName} /><ProfileField label="Email" value={provider.email} /><ProfileField label="Photo URL" value={provider.photoURL} /><ProfileField label="Phone number" value={provider.phoneNumber} /></div>
              </div>) : <p className="admin-users-muted">No linked providers.</p>}
            </div>
            <details className="admin-users-json-disclosure"><summary>Custom claims</summary><JsonBlock value={activeDetail.account.customClaims} /></details>
            <details className="admin-users-json-disclosure"><summary>Multi-factor enrollment</summary><JsonBlock value={activeDetail.account.multiFactor} /></details>
          </section>

          <section className="admin-users-detail-section"><h3>Stored study data</h3>
            {activeDetail.studyData === null || activeDetail.studyData === undefined ? <p className="admin-users-muted">{hasSourceWarnings ? 'No study-data record returned; review the source warnings above to check availability.' : 'No study data stored.'}</p> : <details className="admin-users-json-disclosure"><summary>View complete study data JSON{activeDetail.studyData.updatedAt ? ` · Updated ${activeDetail.studyData.updatedAt}` : ''}</summary><JsonBlock value={activeDetail.studyData.data} /></details>}
          </section>
          <section className="admin-users-detail-section"><h3>Legacy Firestore data</h3>
            {activeDetail.legacyData === null || activeDetail.legacyData === undefined ? <p className="admin-users-muted">{hasSourceWarnings ? 'No legacy document returned; review the source warnings above to check availability.' : 'No legacy user document stored.'}</p> : <details className="admin-users-json-disclosure"><summary>View complete legacy document JSON</summary><JsonBlock value={activeDetail.legacyData} /></details>}
          </section>
          <section className="admin-users-detail-section"><h3>Daily contributor</h3>
            {activeDetail.contributor === null || activeDetail.contributor === undefined ? <p className="admin-users-muted">{hasSourceWarnings ? 'No contributor row returned; review the source warnings above to check availability.' : 'No contributor record found.'}</p> : <details className="admin-users-json-disclosure"><summary>View complete contributor record</summary><JsonBlock value={activeDetail.contributor} /></details>}
          </section>

          <ActivitySection title="Submissions" section="submissions" activity={submissions} loading={Boolean(activityLoading.submissions)} error={activityErrors.submissions} sourceWarning={hasSourceWarnings} onLoadMore={loadMoreActivity} />
          <ActivitySection title="Posts" section="posts" activity={posts} loading={Boolean(activityLoading.posts)} error={activityErrors.posts} sourceWarning={hasSourceWarnings} onLoadMore={loadMoreActivity} />
        </div>}
      </section>
    </div>
  );
}
