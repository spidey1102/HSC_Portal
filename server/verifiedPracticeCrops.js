// These rectangles were reviewed against the original question pages. Coordinates
// are PDF points measured from the top-left corner, in source page order.
const verifiedPapers = {
  'yr12/Maths/Extension 1/Pymble 2024 w. sol [5338-7640dcbc].pdf': {
    sha256: '01b94907eab59ce6c6115585e30eca1800271e99eb389f3c15bac30a1d45d57c',
    questions: {
      '1': {
        correction: {
          page: 2,
          skill: 'Apply vector addition in a grid of parallelograms',
          topics: ['Vectors'],
          geometry: { confidence: 'high', segments: [{ page: 2, bbox: [56, 162, 535, 350], pageWidth: 595.28, pageHeight: 841.89 }] },
        },
        units: {
          whole: { marks: 1, fragments: [{ page: 2, bbox: [56, 162, 535, 350], pageWidth: 595.28, pageHeight: 841.89 }] },
        },
      },
    },
  },
  'yr12/Maths/Extension 1/St George Girls 2025 w. sol [5338-213e821d].pdf': {
    sha256: '070bf537885984cdabc3fc91e1c7ad325f29d4cd3571ebb0d82d4e16e399855e',
    questions: {
      '5': {
        correction: {
          page: 4,
          geometry: { confidence: 'high', segments: [{ page: 4, bbox: [40, 100, 548, 314], pageWidth: 595.22, pageHeight: 842 }] },
        },
        units: {
          whole: { marks: 1, fragments: [{ page: 4, bbox: [40, 100, 548, 314], pageWidth: 595.22, pageHeight: 842 }] },
        },
      },
    },
  },
  'yr12/Maths/Extension 1/Riverview 2024 w. sol [5338-c4cce351].pdf': {
    sha256: 'e8c0bfa8e970f2f72495624a8651c9959469bc2be74d16071191de9aacec6d5c',
    questions: {
      '14': {
        correction: {
          page: 10,
          geometry: { confidence: 'high', segments: [
            { page: 10, bbox: [70, 529, 530, 756], pageWidth: 595.32, pageHeight: 841.92 },
            { page: 11, bbox: [70, 115, 530, 390], pageWidth: 595.32, pageHeight: 841.92 },
          ] },
          subparts: [
            { id: 'a', page: 10, marks: 4, topics: ['Trigonometry', 'Calculus'], skill: 'Differentiate and integrate trigonometric expressions', commandVerb: 'show' },
            { id: 'b', page: 10, marks: 3, topics: ['Combinatorics', 'Mathematical Induction'], skill: 'Prove a series identity by induction', commandVerb: 'prove' },
            { id: 'c', page: 11, marks: 3, topics: ['Differential Equations'], skill: 'Solve a separable differential equation', commandVerb: 'find' },
            { id: 'd', page: 11, marks: 3, topics: ['Differential Equations'], skill: 'Solve a differential equation', commandVerb: 'solve' },
            { id: 'e', page: 11, marks: 2, topics: ['Vectors'], skill: 'Prove a vector angle bisector result', commandVerb: 'show' },
          ],
        },
        units: {
          whole: { marks: 15, fragments: [
            { page: 10, bbox: [70, 529, 530, 755], pageWidth: 595.32, pageHeight: 841.92 },
            { page: 11, bbox: [70, 114, 530, 390], pageWidth: 595.32, pageHeight: 841.92 },
          ] },
          a: { marks: 4, fragments: [{ page: 10, bbox: [70, 555, 530, 675], pageWidth: 595.32, pageHeight: 841.92 }] },
          b: { marks: 3, fragments: [{ page: 10, bbox: [70, 678, 530, 755], pageWidth: 595.32, pageHeight: 841.92 }] },
          c: { marks: 3, fragments: [{ page: 11, bbox: [70, 114, 530, 210], pageWidth: 595.32, pageHeight: 841.92 }] },
          d: { marks: 3, fragments: [{ page: 11, bbox: [70, 215, 530, 305], pageWidth: 595.32, pageHeight: 841.92 }] },
          e: { marks: 2, fragments: [{ page: 11, bbox: [70, 315, 530, 390], pageWidth: 595.32, pageHeight: 841.92 }] },
        },
      },
    },
  },
  'yr12/Maths/Extension 1/Kings 2021 w. sol [5338-ab88617a].pdf': {
    sha256: 'bacf0c6e85b6ba6ddd5e812be7618488806477ba7929154d9332e21b25897189',
    questions: {
      '14': {
        units: {
          a: { marks: 4, fragments: [{ page: 12, bbox: [78, 104, 535, 302], pageWidth: 595.28, pageHeight: 841.89 }] },
          b: { marks: 5, fragments: [{ page: 12, bbox: [78, 302, 535, 589], pageWidth: 595.28, pageHeight: 841.89 }] },
          c: { marks: 6, fragments: [{ page: 12, bbox: [78, 590, 535, 722], pageWidth: 595.28, pageHeight: 841.89 }] },
        },
      },
    },
  },
};

export function correctedPracticeQuestion(sourcePath, question) {
  const correction = verifiedPapers[sourcePath]?.questions?.[String(question?.id || '')]?.correction;
  return correction ? { ...question, ...correction } : question;
}

export function verifiedPracticeCrop(sourcePath, questionId, unitId, marks) {
  const paper = verifiedPapers[sourcePath];
  const unit = paper?.questions?.[String(questionId)]?.units?.[String(unitId || 'whole').toLowerCase()];
  if (!paper || !unit || Number(unit.marks) !== Number(marks)) return null;
  return {
    sourcePath,
    sourceSha256: paper.sha256,
    questionId: String(questionId),
    unitId: String(unitId || 'whole').toLowerCase(),
    marks: Number(unit.marks),
    fragments: unit.fragments,
  };
}
