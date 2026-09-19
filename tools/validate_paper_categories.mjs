import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('public/papers.json', 'utf8'));
const expectedCategories = new Map([
  ['assessments', 'A'],
  ['assessment', 'A'],
  ['trials', 'T'],
  ['trial', 'T'],
  ['hsc', 'H'],
]);

function categoryFromPath(filePath) {
  const parts = String(filePath || '').toLowerCase().split('/');
  const categoryIndex = parts.findIndex((part) => expectedCategories.has(part));
  return categoryIndex === -1 ? null : expectedCategories.get(parts[categoryIndex]);
}

const mismatches = data.papers
  .map((paper) => ({ paper, pathCategory: categoryFromPath(paper.cf || paper.pdfUrl) }))
  .filter(({ paper, pathCategory }) => pathCategory && pathCategory !== paper.c);

const assessmentKeys = new Set(
  data.papers
    .filter((paper) => paper.c === 'A')
    .map((paper) => paper.cf || paper.pdfUrl)
    .filter(Boolean),
);
const duplicateCategoryConflicts = data.papers.filter((paper) => (
  paper.c === 'T'
  && assessmentKeys.has(paper.cf || paper.pdfUrl)
));

if (mismatches.length > 0 || duplicateCategoryConflicts.length > 0) {
  console.error(`Found ${mismatches.length} paper category/path mismatches and ${duplicateCategoryConflicts.length} duplicate category conflicts.`);
  mismatches.slice(0, 20).forEach(({ paper, pathCategory }) => {
    console.error(`${paper.n} (${paper.c}) -> ${pathCategory}: ${paper.cf || paper.pdfUrl}`);
  });
  duplicateCategoryConflicts.slice(0, 20).forEach((paper) => {
    console.error(`${paper.n} (${paper.c}) duplicates an assessment record: ${paper.cf || paper.pdfUrl}`);
  });
  process.exitCode = 1;
} else {
  console.log('Paper categories match their indexed PDF paths.');
}