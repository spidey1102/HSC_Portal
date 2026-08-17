/* global console */

import { readFileSync } from 'node:fs';
import process from 'node:process';

const metadataPath = process.argv[2] ?? 'public/papers.json';
const database = JSON.parse(readFileSync(metadataPath, 'utf8'));
const expectedRoots = new Set(['yr11-12-unlisted', 'yr12-12-low', 'yr12-exter', 'Sortee']);
const requiredFields = ['n', 'v', 's', 'l', 'c', 'y', 'h', 'w', 'col', 'cf'];
const errors = [];
const ids = new Set();
const paths = new Set();

if (!Array.isArray(database.subjects) || !Array.isArray(database.schools) || !Array.isArray(database.papers)) {
  errors.push('Metadata must contain subjects, schools, and papers arrays.');
}

for (const requiredSubject of ['Geography', 'Society & Culture']) {
  if (!database.subjects?.includes(requiredSubject)) {
    errors.push(`Missing required subject: ${requiredSubject}`);
  }
}

for (const [index, paper] of (database.papers ?? []).entries()) {
  for (const field of requiredFields) {
    if (!(field in paper)) errors.push(`Paper ${index} is missing ${field}.`);
  }
  if ('pdfUrl' in paper) errors.push(`Paper ${index} has an unexpected pdfUrl field.`);
  if (ids.has(paper.v)) errors.push(`Duplicate paper ID: ${paper.v}`);
  ids.add(paper.v);
  if (!Number.isInteger(paper.s) || paper.s < 0 || paper.s >= database.subjects.length) {
    errors.push(`Invalid subject index at paper ${index}: ${paper.s}`);
  }
  if (![11, 12].includes(paper.l)) errors.push(`Invalid level at paper ${index}: ${paper.l}`);
  if (!['T', 'A', 'O'].includes(paper.c)) errors.push(`Invalid category at paper ${index}: ${paper.c}`);
  if (!Number.isInteger(paper.y) || paper.y < 0) errors.push(`Invalid year at paper ${index}: ${paper.y}`);
  if (![0, 1].includes(paper.w)) errors.push(`Invalid solution flag at paper ${index}: ${paper.w}`);
  if (!['U', 'L', 'E'].includes(paper.col)) errors.push(`Invalid collection code at paper ${index}: ${paper.col}`);
  if (paper.h !== 0) errors.push(`Invalid school index at paper ${index}: ${paper.h}`);
  if (typeof paper.cf !== 'string' || paper.cf.includes('..') || paper.cf.startsWith('/')) {
    errors.push(`Unsafe Cloudflare path at paper ${index}: ${paper.cf}`);
  }
  if (!expectedRoots.has(String(paper.cf).split('/')[0])) {
    errors.push(`Unexpected Cloudflare path root at paper ${index}: ${paper.cf}`);
  }
  paths.add(paper.cf);
}

const result = {
  paperEntries: database.papers.length,
  uniquePaperIds: ids.size,
  uniqueCloudflarePaths: paths.size,
  duplicateEnglishEntries: database.papers.length - paths.size,
  subjects: database.subjects.length,
  valid: errors.length === 0,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
