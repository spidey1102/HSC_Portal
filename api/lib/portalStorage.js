import { getSupabaseSql } from './supabaseDb.js';

const PAPER_COLUMNS = `
  paper_key,
  paper_id,
  paper_name,
  source_fingerprint,
  extraction_version,
  status,
  analysis_started_at_millis,
  question_count,
  total_marks,
  questions,
  confidence,
  notes,
  pages_analysed,
  total_pages,
  error_message,
  extracted_at,
  updated_at
`;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asIsoString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mapPaperMetadata(row) {
  if (!row) return null;
  return {
    paperKey: String(row.paper_key || ''),
    paperId: String(row.paper_id || ''),
    paperName: String(row.paper_name || ''),
    sourceFingerprint: String(row.source_fingerprint || ''),
    extractionVersion: String(row.extraction_version || ''),
    status: String(row.status || 'missing'),
    analysisStartedAtMillis: Number(row.analysis_started_at_millis) || null,
    questionCount: Number(row.question_count) || 0,
    totalMarks: row.total_marks === null || row.total_marks === undefined ? null : Number(row.total_marks),
    questions: Array.isArray(row.questions) ? row.questions : [],
    confidence: row.confidence || null,
    notes: row.notes || '',
    pagesAnalysed: Number(row.pages_analysed) || null,
    totalPages: Number(row.total_pages) || null,
    errorMessage: row.error_message || '',
    extractedAt: asIsoString(row.extracted_at),
    updatedAt: asIsoString(row.updated_at),
  };
}

export async function getUserData(firebaseUid) {
  const sql = getSupabaseSql();
  const rows = await sql`
    select data
    from public.portal_user_data
    where firebase_uid = ${String(firebaseUid)}
    limit 1
  `;
  return asObject(rows[0]?.data);
}

export async function saveUserData(firebaseUid, data) {
  const sql = getSupabaseSql();
  const safeData = asObject(data);
  const rows = await sql`
    insert into public.portal_user_data (firebase_uid, data, updated_at)
    values (${String(firebaseUid)}, ${sql.json(safeData)}, now())
    on conflict (firebase_uid) do update
      set data = excluded.data,
          updated_at = now()
    returning data, updated_at
  `;
  return {
    data: asObject(rows[0]?.data),
    updatedAt: asIsoString(rows[0]?.updated_at),
  };
}

export async function getPaperMetadata(paperKey) {
  const sql = getSupabaseSql();
  const rows = await sql.unsafe(`
    select ${PAPER_COLUMNS}
    from public.paper_metadata
    where paper_key = $1
    limit 1
  `, [String(paperKey)]);
  return mapPaperMetadata(rows[0]);
}

export async function claimPaperAnalysis({
  paperKey,
  paperId,
  paperName,
  sourceFingerprint,
  extractionVersion,
  analysisStartedAtMillis,
  lockMs,
}) {
  const sql = getSupabaseSql();
  const rows = await sql`
    select ${sql.unsafe(PAPER_COLUMNS)}
    from public.claim_paper_analysis(
      ${String(paperKey)},
      ${String(paperId)},
      ${String(paperName)},
      ${String(sourceFingerprint)},
      ${String(extractionVersion)},
      ${Number(analysisStartedAtMillis)},
      ${Number(lockMs)}
    )
  `;
  return mapPaperMetadata(rows[0]);
}

export async function completePaperAnalysis({ paperKey, sourceFingerprint, analysis, paper, pagesAnalysed, totalPages }) {
  const sql = getSupabaseSql();
  const rows = await sql`
    update public.paper_metadata
    set status = 'ready',
        question_count = ${Number(analysis.questionCount) || 0},
        total_marks = ${analysis.totalMarks},
        questions = ${sql.json(Array.isArray(analysis.questions) ? analysis.questions : [])},
        confidence = ${analysis.confidence || 'medium'},
        notes = ${analysis.notes || ''},
        pages_analysed = ${Number(pagesAnalysed) || null},
        total_pages = ${Number(totalPages) || null},
        error_message = null,
        analysis_started_at_millis = null,
        extracted_at = now(),
        updated_at = now(),
        paper_id = ${String(paper.v)},
        paper_name = ${String(paper.n)}
    where paper_key = ${String(paperKey)}
      and source_fingerprint = ${String(sourceFingerprint)}
      and status = 'analysing'
    returning ${sql.unsafe(PAPER_COLUMNS)}
  `;
  return mapPaperMetadata(rows[0]);
}

export async function recordPaperAnalysisFailure({ paperKey, sourceFingerprint, error, allowRetry = false }) {
  const sql = getSupabaseSql();
  const nextStatus = allowRetry ? 'missing' : 'error';
  const message = allowRetry
    ? null
    : String(error?.message || 'The shared paper analysis could not be completed.').slice(0, 500);
  const rows = await sql`
    update public.paper_metadata
    set status = ${nextStatus},
        error_message = ${message},
        analysis_started_at_millis = null,
        updated_at = now()
    where paper_key = ${String(paperKey)}
      and source_fingerprint = ${String(sourceFingerprint)}
      and status = 'analysing'
    returning ${sql.unsafe(PAPER_COLUMNS)}
  `;
  return mapPaperMetadata(rows[0]);
}
