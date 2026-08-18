import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPaperRouteId } from './paperIdentity';

export function createEmptyPaperMetadata(status = 'loading') {
  return {
    status,
    cached: false,
    questionCount: 0,
    totalMarks: null,
    questions: [],
    confidence: null,
    notes: '',
    retryAfterSeconds: null,
    error: '',
  };
}

function metadataDocumentId(paper) {
  return getPaperRouteId(paper);
}

function paperSourceFingerprint(paper) {
  return JSON.stringify({
    paperId: String(paper?.v || ''),
    paperName: String(paper?.n || ''),
    sourcePath: String(paper?.cf || ''),
  });
}

function isKnownMark(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function normaliseCachedMetadata(data) {
  return {
    ...createEmptyPaperMetadata(data?.status || 'ready'),
    cached: true,
    paperKey: data?.paperKey || '',
    questionCount: Number(data?.questionCount) || 0,
    totalMarks: isKnownMark(data?.totalMarks) ? Number(data.totalMarks) : null,
    questions: Array.isArray(data?.questions) ? data.questions : [],
    confidence: data?.confidence || null,
    notes: data?.notes || '',
    sourceFingerprint: data?.sourceFingerprint || '',
    error: '',
  };
}

export async function getPaperMetadata(paper) {
  const snapshot = await getDoc(doc(db, 'paperMetadata', metadataDocumentId(paper)));
  if (!snapshot.exists()) return createEmptyPaperMetadata('missing');
  const data = snapshot.data();
  if (data?.status !== 'ready' || data?.sourceFingerprint !== paperSourceFingerprint(paper)) {
    return createEmptyPaperMetadata(data?.status === 'analysing' ? 'analysing' : 'missing');
  }
  return normaliseCachedMetadata(data);
}

export async function analysePaperMetadata(paper, idToken) {
  const params = new URLSearchParams({
    paperId: String(paper?.v || ''),
    paperName: String(paper?.n || ''),
  });
  const response = await fetch(`/api/paper-metadata?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 202) {
    return { ...createEmptyPaperMetadata('analysing'), ...payload };
  }
  if (!response.ok) {
    throw new Error(payload?.error || 'The paper structure could not be analysed.');
  }
  return normaliseCachedMetadata({ ...payload, cached: false });
}
