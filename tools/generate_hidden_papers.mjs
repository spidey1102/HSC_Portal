/* global console */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const archivePath = process.argv[2] ?? '/home/ubuntu/upload/downloaded_folder2.zip';
const outputPath = process.argv[3] ?? 'public/papers.json';

const subjects = [
  'Agriculture',
  'Ancient History',
  'Biology',
  'Business Studies',
  'Chemistry',
  'Economics',
  'Engineering Studies',
  'English Advanced',
  'English Ext 1',
  'English Standard',
  'General Maths',
  'Geography',
  'History Extension',
  'IPT',
  'Investigating Science',
  'Legal Studies',
  'Maths (2U)',
  'Maths Ext 1',
  'Maths Ext 2',
  'Modern History',
  'PDHPE',
  'Physics',
  'Software Engineering',
  'Society & Culture',
  'Standard Maths',
  'Studies of Religion 1',
  'Studies of Religion 2',
  'Visual Arts',
];

const directSubjectMap = new Map([
  ['Ancient History', 'Ancient History'],
  ['Biology', 'Biology'],
  ['Business Studies', 'Business Studies'],
  ['Chemistry', 'Chemistry'],
  ['Economics', 'Economics'],
  ['Engineering Studies', 'Engineering Studies'],
  ['English Ext 1', 'English Ext 1'],
  ['Geography', 'Geography'],
  ['IPT', 'IPT'],
  ['Legal Studies', 'Legal Studies'],
  ['Modern History', 'Modern History'],
  ['PDHPE', 'PDHPE'],
  ['Physics', 'Physics'],
  ['Society & Culture', 'Society & Culture'],
  ['Software', 'Software Engineering'],
  ['Visual Arts', 'Visual Arts'],
]);

function listArchivePaths(archive) {
  // The technical listing omits some ZIP members. The bare listing has one fixed
  // metadata prefix per member and retains every unique pathname.
  const output = execFileSync('7z', ['l', '-ba', archive], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return output
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+.{5}\s+\d+\s+\d+\s+(.+)$/);
      return match?.[1] ?? null;
    })
    .filter(Boolean);
}

function getRelativePdfPath(archivePathEntry) {
  const parts = archivePathEntry.split('/');
  const archiveRootIndex = parts.indexOf('downloaded_folder2');
  const relativeParts = archiveRootIndex === -1 ? parts : parts.slice(archiveRootIndex + 1);
  if (!relativeParts.at(-1)?.toLowerCase().endsWith('.pdf')) return null;
  if (relativeParts.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe archive path: ${archivePathEntry}`);
  }
  return relativeParts.join('/');
}

function getSubjectNames(relativePath) {
  const parts = relativePath.split('/');
  const archiveRoot = parts[0];
  const sourceSubject = archiveRoot === 'yr12-exter' ? parts[2] : parts[1];
  const lowered = relativePath.toLowerCase();

  if (archiveRoot === 'Sortee') return ['Maths Ext 1'];

  if (sourceSubject === 'English') {
    // Paper 1 is common to English Advanced and English Standard; the user requested duplicates.
    if (lowered.includes('paper 1') || (lowered.includes('marking') && !lowered.includes('paper 2'))) {
      return ['English Advanced', 'English Standard'];
    }
    if (lowered.includes('advanced')) return ['English Advanced'];
    if (lowered.includes('standard')) return ['English Standard'];
    throw new Error(`Cannot classify English paper: ${relativePath}`);
  }

  if (sourceSubject === 'Maths') {
    const mathsIndex = parts.indexOf('Maths');
    const mathsStream = parts[mathsIndex + 1] ?? '';
    if (mathsStream === 'Maths') return ['Maths (2U)'];
    if (mathsStream === 'Maths Ext 1') return ['Maths Ext 1'];
    if (mathsStream === 'Maths Ext 2') return ['Maths Ext 2'];
    if (mathsStream === 'General Maths') return ['General Maths'];
    if (mathsStream === 'Standard Maths') return ['Standard Maths'];
    if (mathsStream === 'General  &  Standard Maths') {
      const name = path.posix.basename(relativePath).toLowerCase();
      if (name.includes('general maths') || name.includes('general mathematics')) return ['General Maths'];
      if (name.includes('standard maths') || name.includes('standard mathematics')) return ['Standard Maths'];
      throw new Error(`Cannot classify General/Standard Maths paper: ${relativePath}`);
    }
    throw new Error(`Cannot classify Maths stream: ${relativePath}`);
  }

  const subjectName = directSubjectMap.get(sourceSubject);
  if (!subjectName) throw new Error(`No subject mapping for: ${relativePath}`);
  return [subjectName];
}

function getLevel(relativePath) {
  if (/year 11/i.test(relativePath)) return 11;
  if (/year 12/i.test(relativePath)) return 12;
  if (/^(yr12-exter|yr12-12-low|Sortee)\//i.test(relativePath)) return 12;
  throw new Error(`Cannot determine year level: ${relativePath}`);
}

function getCategory(relativePath) {
  if (/trial/i.test(relativePath)) return 'T';
  if (/(assessment|yearly)/i.test(relativePath)) return 'A';
  return 'O';
}

function getCollection(relativePath) {
  if (relativePath.startsWith('yr11-12-unlisted/')) return 'U';
  if (relativePath.startsWith('yr12-12-low/')) return 'L';
  // The existing hidden branch groups external exams and the supplied CSSA-X1 set together.
  return 'E';
}

function getPaperYear(relativePath) {
  const matches = relativePath.match(/(?:19|20)\d{2}/g);
  // Two supplied CSSA topic bundles have no year in either their path or filename.
  // Keep them searchable while representing an unknown year explicitly as 0.
  if (!matches?.length) return 0;
  return Number(matches[0]);
}

function toPaper(relativePath, subjectName, id) {
  const filename = path.posix.basename(relativePath);
  const name = filename.replace(/\.pdf$/i, '');
  const subjectIndex = subjects.indexOf(subjectName);
  if (subjectIndex < 0) throw new Error(`Subject is absent from metadata: ${subjectName}`);

  return {
    n: name,
    v: String(id),
    s: subjectIndex,
    l: getLevel(relativePath),
    c: getCategory(relativePath),
    y: getPaperYear(relativePath),
    h: 0,
    w: /(w\.\s*sol|solutions)/i.test(name) ? 1 : 0,
    col: getCollection(relativePath),
    cf: relativePath,
  };
}

const rawArchivePaths = listArchivePaths(archivePath);
const relativePdfPaths = rawArchivePaths
  .map(getRelativePdfPath)
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

const errors = [];
const papers = [];
for (const relativePath of relativePdfPaths) {
  try {
    for (const subjectName of getSubjectNames(relativePath)) {
      papers.push(toPaper(relativePath, subjectName, papers.length + 1));
    }
  } catch (error) {
    errors.push(error.message);
  }
}

if (errors.length) {
  console.error(`Metadata generation stopped with ${errors.length} classification error(s):`);
  for (const error of errors.slice(0, 30)) console.error(`- ${error}`);
  process.exit(1);
}

const categoryCounts = papers.reduce((counts, paper) => {
  counts[paper.c] = (counts[paper.c] ?? 0) + 1;
  return counts;
}, {});
const levelCounts = papers.reduce((counts, paper) => {
  counts[paper.l] = (counts[paper.l] ?? 0) + 1;
  return counts;
}, {});
const subjectCounts = papers.reduce((counts, paper) => {
  const subjectName = subjects[paper.s];
  counts[subjectName] = (counts[subjectName] ?? 0) + 1;
  return counts;
}, {});

const database = {
  subjects,
  schools: ['Unlisted source'],
  papers,
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(database)}\n`, 'utf8');

console.log(JSON.stringify({
  archivePdfCount: relativePdfPaths.length,
  generatedPaperEntries: papers.length,
  duplicatedEnglishPaperOneEntries: papers.length - relativePdfPaths.length,
  categoryCounts,
  levelCounts,
  subjectCounts,
  outputPath,
}, null, 2));
