import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { isOwner } from './dailyPosts.js';
import { getSupabaseSql } from './supabaseDb.js';

const PAGE_SIZE = 50;
const ADMIN_APP_NAME = 'hsc-portal-admin-users';
const SENSITIVE_CLAIM_KEY = /password|salt|token|secret|credential|private.?key/i;

export class AdminUsersError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AdminUsersError';
    this.status = status;
  }
}

function firebaseAdminApp() {
  const expectedProjectId = String(firebaseConfig?.projectId || '').trim();
  if (!expectedProjectId) throw new AdminUsersError(503, 'Account inspection is not configured.');
  let credential;
  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new AdminUsersError(503, 'Account inspection is not configured.');
    }
    if (serviceAccount?.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    if (serviceAccount?.project_id !== expectedProjectId) {
      throw new AdminUsersError(503, 'Account inspection project configuration does not match.');
    }
    try {
      credential = cert(serviceAccount);
    } catch {
      throw new AdminUsersError(503, 'Account inspection is not configured.');
    }
  }

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) {
    if (existing.options.projectId !== expectedProjectId) throw new AdminUsersError(503, 'Account inspection project configuration does not match.');
    return existing;
  }
  try {
    return initializeApp({ credential, projectId: expectedProjectId }, ADMIN_APP_NAME);
  } catch {
    throw new AdminUsersError(503, 'Account inspection is not configured.');
  }
}

function adminServices() {
  const app = firebaseAdminApp();
  const configuredDatabaseId = String(process.env.FIREBASE_FIRESTORE_DATABASE_ID || '').trim();
  try {
    const db = configuredDatabaseId ? getFirestore(app, configuredDatabaseId) : getFirestore(app);
    return { auth: getAuth(app), db };
  } catch {
    throw new AdminUsersError(503, 'Account inspection is not configured.');
  }
}

function safeClaims(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => entry && typeof entry === 'object' ? safeClaims(entry) : entry);
  }
  if (!value || typeof value !== 'object') return {};
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_CLAIM_KEY.test(key)) continue;
    if (entry === null || ['string', 'number', 'boolean'].includes(typeof entry)) result[key] = entry;
    else if (typeof entry === 'object') result[key] = safeClaims(entry);
  }
  return result;
}

export function publicAdminAccount(user, role = 'student') {
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    phoneNumber: user.phoneNumber || null,
    emailVerified: user.emailVerified === true,
    disabled: user.disabled === true,
    providers: (user.providerData || []).map((provider) => ({
      providerId: provider.providerId || null,
      uid: provider.uid || null,
      displayName: provider.displayName || null,
      email: provider.email || null,
      photoURL: provider.photoURL || null,
      phoneNumber: provider.phoneNumber || null,
    })),
    metadata: {
      creationTime: user.metadata?.creationTime || null,
      lastSignInTime: user.metadata?.lastSignInTime || null,
      lastRefreshTime: user.metadata?.lastRefreshTime || null,
    },
    customClaims: safeClaims(user.customClaims),
    tenantId: user.tenantId || null,
    tokensValidAfterTime: user.tokensValidAfterTime || null,
    multiFactor: {
      enrolledFactors: (user.multiFactor?.enrolledFactors || []).map((factor) => ({
        uid: factor.uid || null,
        factorId: factor.factorId || null,
        displayName: factor.displayName || null,
        enrollmentTime: factor.enrollmentTime || null,
        phoneNumber: factor.phoneNumber || null,
      })),
    },
    role,
  };
}

async function contributorRoles(users) {
  const roleByUid = new Map();
  for (const user of users) if (isOwner(user.uid)) roleByUid.set(user.uid, 'owner');
  const lookup = users.filter((user) => !roleByUid.has(user.uid)).map((user) => user.uid);
  if (!lookup.length) return roleByUid;
  const sql = getSupabaseSql();
  const rows = await sql`
    select firebase_uid, active from public.daily_contributors
    where firebase_uid = any(${sql.array(lookup, 'text')})
  `;
  for (const row of rows) if (row.active) roleByUid.set(row.firebase_uid, 'poster');
  return roleByUid;
}

function isoOrNull(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function adminActivityPage(rows, offset) {
  return { items: rows.slice(0, PAGE_SIZE), nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
}

async function readPage(sql, table, uid, offset) {
  const rows = table === 'daily_submissions'
    ? await sql`
      select * from public.daily_submissions where student_uid = ${uid}
      order by created_at desc, id desc limit ${PAGE_SIZE + 1} offset ${offset}
    `
    : await sql`
      select * from public.daily_posts where author_uid = ${uid}
      order by created_at desc, id desc limit ${PAGE_SIZE + 1} offset ${offset}
    `;
  return adminActivityPage(rows, offset);
}

function firebaseConfigurationError(error) {
  return error?.code === 'app/invalid-credential'
    || /default credentials|failed to determine project id/i.test(String(error?.message || ''));
}

export async function listAdminUsers({ pageToken = undefined } = {}) {
  const { auth } = adminServices();
  let page;
  try {
    page = await auth.listUsers(PAGE_SIZE, pageToken);
  } catch (error) {
    if (firebaseConfigurationError(error)) throw new AdminUsersError(503, 'Account inspection is not configured.');
    throw new AdminUsersError(500, 'Accounts could not be loaded.');
  }
  let roles = new Map();
  try {
    roles = await contributorRoles(page.users);
  } catch (error) {
    const missingDatabaseUrl = /DATABASE_URL must be configured/i.test(String(error?.message || ''));
    throw new AdminUsersError(missingDatabaseUrl ? 503 : 500, 'Account role information could not be loaded.');
  }
  return {
    users: page.users.map((user) => publicAdminAccount(user, roles.get(user.uid) || (isOwner(user.uid) ? 'owner' : 'student'))),
    nextPageToken: page.pageToken || null,
  };
}

export async function getAdminUserDetail(uid, section = null, offset = 0) {
  const { auth, db } = adminServices();
  let user;
  try {
    user = await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') throw new AdminUsersError(404, 'Account not found.');
    if (firebaseConfigurationError(error)) throw new AdminUsersError(503, 'Account inspection is not configured.');
    throw new AdminUsersError(500, 'Account details could not be loaded.');
  }
  const warnings = [];

  if (section) {
    try {
      const sql = getSupabaseSql();
      return await readPage(sql, section === 'submissions' ? 'daily_submissions' : 'daily_posts', uid, offset);
    } catch {
      throw new AdminUsersError(503, `${section === 'submissions' ? 'Submitted answers' : 'Authored posts'} could not be loaded.`);
    }
  }

  const result = { account: publicAdminAccount(user, isOwner(uid) ? 'owner' : 'student'), warnings };

  try {
    const sql = getSupabaseSql();
    const rows = await sql`select data, updated_at from public.portal_user_data where firebase_uid = ${uid} limit 1`;
    result.studyData = rows[0] ? { data: rows[0].data, updatedAt: isoOrNull(rows[0].updated_at) } : null;
  } catch {
    result.studyData = null;
    warnings.push('Study data could not be loaded.');
  }
  try {
    const snapshot = await db.collection('users').doc(uid).get();
    result.legacyData = snapshot.exists ? snapshot.data() : null;
  } catch {
    result.legacyData = null;
    warnings.push('Legacy account data could not be loaded.');
  }
  try {
    const sql = getSupabaseSql();
    const rows = await sql`select * from public.daily_contributors where firebase_uid = ${uid} limit 1`;
    result.contributor = rows[0] || null;
    if (result.contributor?.active && !isOwner(uid)) result.account.role = 'poster';
  } catch {
    result.contributor = null;
    warnings.push('Contributor information could not be loaded.');
  }
  for (const activity of ['submissions', 'posts']) {
    try {
      const sql = getSupabaseSql();
      result[activity] = await readPage(sql, activity === 'submissions' ? 'daily_submissions' : 'daily_posts', uid, 0);
    } catch {
      result[activity] = { items: [], nextOffset: null };
      warnings.push(`${activity === 'submissions' ? 'Submitted answers' : 'Authored posts'} could not be loaded.`);
    }
  }
  return result;
}
