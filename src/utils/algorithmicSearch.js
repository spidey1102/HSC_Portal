const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'to', 'with', 'hsc', 'paper', 'papers', 'exam', 'exams'
]);

const SUBJECT_ALIASES = {
  'maths': 'Maths (2U)',
  'math': 'Maths (2U)',
  '2u': 'Maths (2U)',
  'maths 2u': 'Maths (2U)',
  'math 2u': 'Maths (2U)',
  'adv maths': 'Maths (2U)',
  'advanced maths': 'Maths (2U)',
  'ext 1': 'Maths Ext 1',
  'ext1': 'Maths Ext 1',
  '3u': 'Maths Ext 1',
  'maths ext 1': 'Maths Ext 1',
  'extension 1': 'Maths Ext 1',
  'ext 2': 'Maths Ext 2',
  'ext2': 'Maths Ext 2',
  '4u': 'Maths Ext 2',
  'maths ext 2': 'Maths Ext 2',
  'extension 2': 'Maths Ext 2',
  'std maths': 'Standard Maths',
  'standard maths': 'Standard Maths',
  'gen maths': 'General Maths',
  'general maths': 'General Maths',
  'eng adv': 'English Advanced',
  'english adv': 'English Advanced',
  'english advanced': 'English Advanced',
  'eng std': 'English Standard',
  'english std': 'English Standard',
  'english standard': 'English Standard',
  'eng ext 1': 'English Ext 1',
  'english ext 1': 'English Ext 1',
  'phys': 'Physics',
  'physics': 'Physics',
  'chem': 'Chemistry',
  'chemistry': 'Chemistry',
  'bio': 'Biology',
  'biology': 'Biology',
  'econ': 'Economics',
  'economics': 'Economics',
  'biz': 'Business Studies',
  'business': 'Business Studies',
  'mod': 'Modern History',
  'modern': 'Modern History',
  'anc': 'Ancient History',
  'ancient': 'Ancient History',
  'legal': 'Legal Studies',
  'pe': 'PDHPE',
  'pdhpe': 'PDHPE',
  'ipt': 'IPT',
  'sdd': 'Software Engineering',
  'software': 'Software Engineering',
  'sor1': 'Studies of Religion 1',
  'sor 1': 'Studies of Religion 1',
  'sor2': 'Studies of Religion 2',
  'sor 2': 'Studies of Religion 2',
};

function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function searchPapersAlgorithmic(papers, subjects, query) {
  if (!query || !query.trim()) {
    return papers.map(p => ({ paper: p, score: 0 }));
  }

  const rawQuery = query.trim();
  const normQuery = normalize(rawQuery);
  const queryTokens = normQuery
    .split(' ')
    .filter(t => t.length > 0 && !STOP_WORDS.has(t));

  if (queryTokens.length === 0) {
    return papers.map(p => ({ paper: p, score: 0 }));
  }

  // Extract years from query
  const queryYears = (rawQuery.match(/\b(19[89]\d|20[0-2]\d)\b/g) || []).map(Number);

  // Extract category intent from query
  const wantsTrial = /\b(trial|trials|t)\b/i.test(rawQuery);
  const wantsAssessment = /\b(assessment|assessments|yearly|hy|half yearly|prelim|a)\b/i.test(rawQuery);
  const wantsSolution = /\b(sol|sols|solution|solutions|answers|guidelines|w\.?\s*sol)\b/i.test(rawQuery);

  const scoredResults = [];

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    let score = 0;

    const paperNameNorm = normalize(paper.n);
    const paperPathNorm = normalize(paper.cf);
    const subjectName = subjects[paper.s] || '';
    const subjectNameNorm = normalize(subjectName);

    // 1. Exact or Substring match on Full Query
    if (paperNameNorm.includes(normQuery)) {
      score += 120;
    } else if (paperPathNorm.includes(normQuery)) {
      score += 80;
    }

    // 2. Year Match
    if (queryYears.length > 0) {
      if (queryYears.includes(paper.y)) {
        score += 60;
      }
    }

    // 3. Subject Match
    if (subjectNameNorm && normQuery.includes(subjectNameNorm)) {
      score += 50;
    } else {
      // Check subject aliases
      for (const [alias, targetSub] of Object.entries(SUBJECT_ALIASES)) {
        if (normQuery.includes(alias) && subjectName === targetSub) {
          score += 45;
          break;
        }
      }
    }

    // 4. Category Match
    if (wantsTrial && paper.c === 'T') {
      score += 30;
    }
    if (wantsAssessment && paper.c === 'A') {
      score += 30;
    }

    // 5. Solution Match
    if (wantsSolution && paper.w === 1) {
      score += 25;
    }

    // 6. Token matching against title & relative path
    let matchedTokenCount = 0;
    for (const token of queryTokens) {
      if (token.length < 2) continue;

      if (paperNameNorm.includes(token)) {
        score += 20 + Math.min(token.length * 2, 10);
        matchedTokenCount++;
      } else if (paperPathNorm.includes(token)) {
        score += 12 + Math.min(token.length, 5);
        matchedTokenCount++;
      } else if (subjectNameNorm.includes(token)) {
        score += 15;
        matchedTokenCount++;
      }
    }

    // Boost if multiple tokens matched
    if (matchedTokenCount > 1) {
      score += matchedTokenCount * 10;
    }

    if (score > 0) {
      scoredResults.push({ paper, score });
    }
  }

  // Sort by score descending, then by paper year descending
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (b.paper.y || 0) - (a.paper.y || 0);
  });

  return scoredResults;
}
