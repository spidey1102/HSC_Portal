import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildAnalysisPrompt,
  callPaperAnalysis,
  normaliseAnalysis,
  questionRangeFromPaperText,
} from '../../api/paper-metadata.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const outputRoot = 'C:/Users/manup/.gemini/antigravity/scratch/paper-analysis';
const ledgerPath = path.join(outputRoot, 'ledger.json');
const catalogPath = path.join(repoRoot, 'public/papers.json');
const batchSize = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  const batchIndex = args.indexOf('--batch');
  const batch = Number(batchIndex >= 0 ? args[batchIndex + 1] : 1);
  const onlyIndexAt = args.indexOf('--only-index');
  const onlyIndex = onlyIndexAt >= 0 ? Number(args[onlyIndexAt + 1]) : null;
  const onlyIndexesAt = args.indexOf('--only-indexes');
  const onlyIndexes = onlyIndexesAt >= 0
    ? String(args[onlyIndexesAt + 1] || '').split(',').map((value) => Number(value.trim()))
    : null;
  const instructionAt = args.indexOf('--instruction');
  const instruction = instructionAt >= 0 ? String(args[instructionAt + 1] || '') : '';
  const noWrite = args.includes('--dry-run');
  if (!Number.isInteger(batch) || batch < 1) throw new Error('--batch must be a positive integer.');
  if (onlyIndex !== null && (!Number.isInteger(onlyIndex) || onlyIndex < 0)) throw new Error('--only-index must be a zero-based catalog index.');
  if (onlyIndexes && (!onlyIndexes.length || onlyIndexes.some((index) => !Number.isInteger(index) || index < 0))) {
    throw new Error('--only-indexes must be comma-separated zero-based catalog indexes.');
  }
  return { batch, noWrite, onlyIndex, onlyIndexes, instruction };
}

async function saveLedger(ledger) {
  const temp = `${ledgerPath}.tmp`;
  await writeFile(temp, JSON.stringify(ledger, null, 2), 'utf8');
  await rename(temp, ledgerPath);
}

function makePaperText(pages) {
  return pages.map((page) => `\n--- PDF page ${page.page} ---\n${page.text || ''}`).join('\n');
}

function verifyExplicitQuestionRanges(analysis, paperText) {
  const expected = questionRangeFromPaperText(paperText);
  if (!expected.length) return;
  const covered = new Set(analysis.questions
    .map((question) => Number(String(question.id).match(/^\s*(\d+)/)?.[1]))
    .filter(Number.isInteger));
  const missing = expected.filter((questionNumber) => !covered.has(questionNumber));
  if (missing.length) {
    throw new Error(`Question Map omitted explicitly ranged questions: ${missing.join(', ')}.`);
  }
}

async function analyseRecord(record, paper, additionalInstruction = '') {
  const textPath = record.page_text_file;
  const extracted = JSON.parse(await readFile(textPath, 'utf8'));
  const paperText = makePaperText(extracted.pages);
  const fingerprint = JSON.stringify({
    paperId: String(paper.v || ''),
    paperName: String(paper.n || ''),
    sourcePath: String(paper.cf || ''),
  });
  const prompt = `${buildAnalysisPrompt(paper, paperText)}${additionalInstruction ? `\n\nSource-specific coverage instructions:\n${additionalInstruction}` : ''}`;
  let answer = await callPaperAnalysis(prompt);
  let analysis;
  try {
    analysis = normaliseAnalysis(answer, fingerprint, { paper, paperText });
    verifyExplicitQuestionRanges(analysis, paperText);
  } catch (firstError) {
    answer = await callPaperAnalysis(
      `${prompt}\n\nThe preceding response was rejected: ${firstError.message} Re-read the full paper text, cover every explicitly ranged question, including alternate questions and later sections, and return a complete Question Map with accurate marks and question coverage.`,
    );
    analysis = normaliseAnalysis(answer, fingerprint, { paper, paperText });
    verifyExplicitQuestionRanges(analysis, paperText);
  }
  return {
    analysis,
    extraction: {
      sourceSha256: record.source_sha256,
      pageCount: record.page_count,
      ocrPages: extracted.pages.filter((page) => page.ocr_used).length,
      lowConfidenceTextBoxes: extracted.pages.reduce((count, page) => (
        count + page.text_boxes.filter((box) => Number(box.confidence) < 0.75).length
      ), 0),
    },
  };
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not available in the environment.');
  const { batch, noWrite, onlyIndex, onlyIndexes, instruction } = parseArgs();
  const [ledger, catalogData] = await Promise.all([
    readFile(ledgerPath, 'utf8').then(JSON.parse),
    readFile(catalogPath, 'utf8').then(JSON.parse),
  ]);
  if (ledger.catalog_fingerprint !== undefined) {
    const crypto = await import('node:crypto');
    const catalogHash = crypto.createHash('sha256').update(await readFile(catalogPath)).digest('hex');
    if (catalogHash !== ledger.catalog_fingerprint) throw new Error('Website catalog changed; reconcile the ledger before analysing.');
  }
  const start = (batch - 1) * batchSize;
  const selectedIndexes = onlyIndexes || (onlyIndex === null ? null : [onlyIndex]);
  const records = selectedIndexes === null
    ? ledger.papers.slice(start, start + batchSize)
    : ledger.papers.filter((record) => selectedIndexes.includes(Number(record.catalog_index)));
  if (!records.length) throw new Error(`Batch ${batch} contains no website papers.`);
  await mkdir(outputRoot, { recursive: true });

  const summary = [];
  for (const record of records) {
    if (record.analysis_status === 'mapped' || record.analysis_status === 'reviewed') {
      summary.push({ title: record.title, status: 'already mapped' });
      continue;
    }
    try {
      const paper = catalogData.papers[record.catalog_index];
      const result = await analyseRecord(record, paper, instruction);
      record.questions = result.analysis.questions;
      record.total_marks = result.analysis.totalMarks;
      record.question_count = result.analysis.questionCount;
      record.map_confidence = result.analysis.confidence;
      record.map_notes = result.analysis.notes;
      record.map_extraction = result.extraction;
      record.analysis_status = noWrite ? 'analysis_dry_run' : 'mapped_pending_review';
      record.crop_review_status = 'pending';
      record.failure_reason = null;
      record.mapped_at = new Date().toISOString();
      if (!noWrite) await saveLedger(ledger);
      summary.push({
        title: record.title,
        status: record.analysis_status,
        questions: record.question_count,
        marks: record.total_marks,
        confidence: record.map_confidence,
        notes: record.map_notes,
        ocrPages: result.extraction.ocrPages,
      });
    } catch (error) {
      record.retry_count = Number(record.retry_count || 0) + 1;
      record.analysis_status = 'blocked';
      record.failure_reason = String(error?.message || error).slice(0, 1000);
      if (!noWrite) await saveLedger(ledger);
      summary.push({ title: record.title, status: 'blocked', reason: record.failure_reason });
    }
  }
  process.stdout.write(`${JSON.stringify({ batch, count: records.length, dryRun: noWrite, summary }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
});
