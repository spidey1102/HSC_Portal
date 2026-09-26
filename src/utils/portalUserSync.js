import { getApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const USER_DATA_ENDPOINT = '/api/user-data';
const LEGACY_CHECK_KEY = '_legacyFirestoreChecked';
const STUDY_FIELDS = [
  'bookmarks', 'assessments', 'appearance', 'selectedSubject', 'selectedLevel',
  'mySubjects', 'viewedPapers', 'completedPapers', 'practiceReviews', 'mistakeLog',
];
const pendingLoads = new Map();

function isEmpty(value) {
  return value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}

export function mergeLegacyStudyData(current, legacy) {
  const merged = { ...current };
  for (const field of STUDY_FIELDS) {
    if (legacy[field] !== undefined && isEmpty(merged[field]) && !isEmpty(legacy[field])) {
      merged[field] = legacy[field];
    }
  }
  return merged;
}

export async function requestUserData(user, method, data) {
  const token = await user.getIdToken();
  const response = await fetch(USER_DATA_ENDPOINT, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'PUT' ? { body: JSON.stringify({ data }) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'The study data could not be synchronised.');
  return payload;
}

async function loadUserDataOnce(user) {
  const payload = await requestUserData(user, 'GET');
  const current = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  if (current[LEGACY_CHECK_KEY]) return current;

  // The former Firestore store is readable only by its owner. Copy its missing
  // fields once, without replacing any newer Supabase values.
  let legacy;
  try {
    const snapshot = await getDoc(doc(getFirestore(getApp()), 'users', user.uid));
    legacy = snapshot.exists() ? snapshot.data() : {};
  } catch (error) {
    console.warn('Could not check older Firebase study data:', error);
    return current; // Retry the legacy check at the next sign-in.
  }

  const merged = mergeLegacyStudyData(current, legacy);
  merged[LEGACY_CHECK_KEY] = true;
  const saved = await requestUserData(user, 'PUT', merged);
  return saved?.data && typeof saved.data === 'object' ? saved.data : merged;
}

export function loadUserData(user) {
  if (pendingLoads.has(user.uid)) return pendingLoads.get(user.uid);
  const load = loadUserDataOnce(user).finally(() => pendingLoads.delete(user.uid));
  pendingLoads.set(user.uid, load);
  return load;
}
