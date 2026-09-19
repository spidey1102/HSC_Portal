const CATEGORY_BY_FOLDER = {
  assessment: 'A',
  assessments: 'A',
  trial: 'T',
  trials: 'T',
  hsc: 'H',
};

function categoryFromPath(pathValue) {
  const parts = String(pathValue || '').toLowerCase().split('/');
  const folder = parts.find((part) => CATEGORY_BY_FOLDER[part]);
  return folder ? CATEGORY_BY_FOLDER[folder] : null;
}

export function normalisePaperCategories(papers) {
  const assessmentKeys = new Set(
    papers
      .filter((paper) => paper.c === 'A')
      .map((paper) => paper.cf || paper.pdfUrl)
      .filter(Boolean),
  );

  return papers.map((paper) => {
    const pathCategory = categoryFromPath(paper.cf || paper.pdfUrl);
    const duplicateAssessment = paper.c === 'T'
      && assessmentKeys.has(paper.cf || paper.pdfUrl);
    const category = pathCategory || (duplicateAssessment ? 'A' : paper.c);
    return category !== paper.c
      ? { ...paper, c: category }
      : paper;
  });
}