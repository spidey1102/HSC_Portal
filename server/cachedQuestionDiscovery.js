import { readFileSync } from 'fs';
import { resolve } from 'path';

import { getSupabaseSql } from './supabaseDb.js';

const MAX_RETURNED_QUESTIONS = 5;
const MAX_SCANNED_PAPERS = 250;
const MAX_EXCLUDED_KEYS = 200;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'any', 'around', 'ask', 'about', 'another', 'are', 'at', 'can', 'certain',
  'different', 'find', 'for', 'from', 'give', 'i', 'in', 'is', 'it', 'look', 'me', 'more', 'my',
  'next', 'of', 'on', 'paper', 'papers', 'please', 'question', 'questions', 'random', 'show', 'some',
  'the', 'this', 'to', 'topic', 'topics', 'trial', 'trials', 'want', 'with', 'you',
]);

let paperIndexCache = null;

function normaliseText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchableTokens(value) {
  return normaliseText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function questionResultKey(paperIdentity, questionId) {
  return `${paperIdentity}::${String(questionId || '').trim()}`;
}

function parsePaperIdentity(paperKey) {
  try {
    const fields = JSON.parse(decodeURIComponent(String(paperKey || '')));
    if (!Array.isArray(fields) || fields.length !== 8) return null;
    const [v, s, l, c, y, h, w, n] = fields;
    return {
      paperIdentity: JSON.stringify(fields),
      v: String(v || ''),
      s: Number(s),
      l: Number(l),
      c: String(c || ''),
      y: Number(y),
      h: Number(h),
      w: Number(w),
      n: String(n || ''),
    };
  } catch {
    return null;
  }
}

function loadPaperIndex() {
  if (paperIndexCache) return paperIndexCache;
  const raw = readFileSync(resolve(process.cwd(), 'public', 'papers.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  paperIndexCache = {
    subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
    schools: Array.isArray(parsed.schools) ? parsed.schools : [],
  };
  return paperIndexCache;
}

function questionRelevance(question, topicQuery) {
  const normalisedQuery = normaliseText(topicQuery);
  const tokens = searchableTokens(topicQuery);
  const topics = Array.isArray(question?.topics) ? question.topics : [];
  const labels = [
    ...topics,
    question?.skill,
    question?.commandVerb,
  ].map(normaliseText).filter(Boolean);

  if (!normalisedQuery || tokens.length === 0) return 1;

  let bestScore = 0;
  for (const label of labels) {
    if (!label) continue;
    if (label.includes(normalisedQuery)) bestScore = Math.max(bestScore, 100 + normalisedQuery.length);

    const matchingTokens = tokens.filter((token) => label.includes(token)).length;
    if (matchingTokens === tokens.length) bestScore = Math.max(bestScore, 70 + matchingTokens * 5);
    else if (tokens.length === 1 && matchingTokens === 1) bestScore = Math.max(bestScore, 45);
  }
  return bestScore;
}

function randomiseEqualScores(candidates) {
  const grouped = new Map();
  for (const candidate of candidates) {
    const bucket = grouped.get(candidate.score) || [];
    bucket.push(candidate);
    grouped.set(candidate.score, bucket);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .flatMap(([, bucket]) => bucket.sort(() => Math.random() - 0.5));
}

/**
 * Searches the completed shared question cache. It does not start analysis or
 * inspect uncached papers; a returned question is therefore immediately
 * reusable and page-addressable for every student.
 */
export async function searchCachedQuestions({
  topic = '',
  subject = '',
  difficulty = 'any',
  excludeQuestionKeys = [],
} = {}) {
  const sql = getSupabaseSql();
  const index = loadPaperIndex();
  const wantedSubject = normaliseText(subject);
  const wantedDifficulty = ['any', 'challenging', 'stretch'].includes(String(difficulty || '').toLowerCase())
    ? String(difficulty || 'any').toLowerCase()
    : 'any';
  const excluded = new Set((Array.isArray(excludeQuestionKeys) ? excludeQuestionKeys : [])
    .slice(-MAX_EXCLUDED_KEYS)
    .map((key) => String(key || ''))
    .filter(Boolean));

  const rows = await sql`
    select paper_key, paper_id, paper_name, questions
    from public.paper_metadata
    where status = 'ready'
      and jsonb_array_length(questions) > 0
    order by extracted_at desc nulls last
    limit ${MAX_SCANNED_PAPERS}
  `;

  const candidates = [];
  for (const row of rows) {
    const paper = parsePaperIdentity(row.paper_key);
    if (!paper) continue;
    const subjectName = String(index.subjects[paper.s] || 'Unknown subject');
    const schoolName = String(index.schools[paper.h] || 'Unknown source');
    const normalisedSubjectName = normaliseText(subjectName);
    if (wantedSubject && !normalisedSubjectName.includes(wantedSubject) && !wantedSubject.includes(normalisedSubjectName)) {
      continue;
    }

    const questions = Array.isArray(row.questions) ? row.questions : [];
    for (const question of questions) {
      const id = String(question?.id || '').trim();
      const page = Number(question?.page);
      if (!id || !Number.isInteger(page) || page < 1) continue;
      const level = String(question?.challenge?.level || 'routine').toLowerCase();
      if (wantedDifficulty !== 'any' && level !== wantedDifficulty) continue;

      const score = questionRelevance(question, topic);
      if (score <= 0) continue;

      const key = questionResultKey(paper.paperIdentity, id);
      if (!excluded.has(key)) {
        candidates.push({
          score,
          key,
          paperIdentity: paper.paperIdentity,
          paperName: paper.n || String(row.paper_name || ''),
          paperYear: Number.isFinite(paper.y) ? paper.y : null,
          subject: subjectName,
          school: schoolName,
          question: {
            id,
            page,
            marks: question?.marks === null || question?.marks === undefined ? null : Number(question.marks),
            topics: Array.isArray(question?.topics) ? question.topics.slice(0, 3) : [],
            skill: String(question?.skill || '').trim(),
            commandVerb: String(question?.commandVerb || '').trim(),
            challenge: {
              level: ['routine', 'challenging', 'stretch'].includes(level) ? level : 'routine',
              subpartId: String(question?.challenge?.subpartId || '').trim(),
            },
          },
        });
      }

      const subparts = Array.isArray(question?.subparts) ? question.subparts : [];
      for (const subpart of subparts) {
        const subpartId = String(subpart?.id || '').trim();
        const subpartPage = Number(subpart?.page ?? page);
        if (!subpartId || !Number.isInteger(subpartPage) || subpartPage < 1) continue;

        const subpartQuestion = {
          ...question,
          topics: Array.isArray(subpart?.topics) ? subpart.topics : [],
          skill: String(subpart?.skill || '').trim(),
          commandVerb: String(subpart?.commandVerb || '').trim(),
        };
        const hasOwnLabels = subpartQuestion.topics.some((label) => String(label || '').trim())
          || Boolean(subpartQuestion.skill)
          || Boolean(subpartQuestion.commandVerb);
        if (!hasOwnLabels) continue;
        const subpartScore = questionRelevance(subpartQuestion, topic);
        if (subpartScore <= 0) continue;

        const subpartKey = questionResultKey(paper.paperIdentity, `${id}(${subpartId})`);
        if (excluded.has(subpartKey)) continue;
        candidates.push({
          score: subpartScore,
          key: subpartKey,
          paperIdentity: paper.paperIdentity,
          paperName: paper.n || String(row.paper_name || ''),
          paperYear: Number.isFinite(paper.y) ? paper.y : null,
          subject: subjectName,
          school: schoolName,
          question: {
            id,
            page: subpartPage,
            marks: subpart?.marks === null || subpart?.marks === undefined ? null : Number(subpart.marks),
            topics: Array.isArray(subpart?.topics) ? subpart.topics.slice(0, 3) : [],
            skill: String(subpart?.skill || '').trim(),
            commandVerb: String(subpart?.commandVerb || '').trim(),
            challenge: {
              level: ['routine', 'challenging', 'stretch'].includes(level) ? level : 'routine',
              subpartId,
            },
          },
        });
      }
    }
  }

  const selected = randomiseEqualScores(candidates).slice(0, MAX_RETURNED_QUESTIONS);
  return {
    topic: String(topic || '').trim(),
    subject: String(subject || '').trim(),
    difficulty: wantedDifficulty,
    found: candidates.length,
    returned: selected.length,
    questions: selected,
  };
}

export { MAX_RETURNED_QUESTIONS, questionResultKey };
