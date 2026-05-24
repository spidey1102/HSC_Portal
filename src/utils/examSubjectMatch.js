/**
 * Maps portal sidebar subject names (from papers.json) to HSC written exam entries.
 * @param {string} examLabel
 * @param {string} portalSubjectName
 */
export function examMatchesPortalSubject(examLabel, portalSubjectName) {
  const label = examLabel.trim();
  const matchers = PORTAL_SUBJECT_MATCHERS[portalSubjectName];
  if (matchers) {
    return matchers.some((fn) => fn(label));
  }
  return label.toLowerCase().startsWith(portalSubjectName.toLowerCase());
}

/** @param {Array<{ label: string }>} exams @param {string|null} portalSubjectName */
export function filterExamsForPortalSubject(exams, portalSubjectName) {
  if (!portalSubjectName) return exams;
  return exams.filter((e) => examMatchesPortalSubject(e.label, portalSubjectName));
}

/** @type {Record<string, Array<(label: string) => boolean>>} */
const PORTAL_SUBJECT_MATCHERS = {
  'English Advanced': [(l) => l.startsWith('English Advanced')],
  'English Standard': [(l) => l.startsWith('English Standard')],
  'English Ext 1': [(l) => l.startsWith('English Extension 1')],
  'Maths (2U)': [(l) => l === 'Mathematics Advanced'],
  'Maths Ext 1': [(l) => l.startsWith('Mathematics Extension 1')],
  'Maths Ext 2': [(l) => l.startsWith('Mathematics Extension 2')],
  'General Maths': [(l) => l.startsWith('Mathematics Standard')],
  'Standard Maths': [(l) => l.startsWith('Mathematics Standard')],
  PDHPE: [(l) => l.startsWith('Health and Movement Science')],
  IPT: [(l) => l.startsWith('Enterprise Computing')],
  'Senior Science': [(l) => l.startsWith('Investigating Science')],
  Software: [(l) => l.startsWith('Software Engineering')],
  'Studies of Religion 1': [(l) => l.startsWith('Studies of Religion')],
  'Studies of Religion 2': [(l) => l.startsWith('Studies of Religion II')],
  Agriculture: [(l) => l === 'Agriculture'],
  'Ancient History': [(l) => l === 'Ancient History'],
  Biology: [(l) => l === 'Biology'],
  'Business Studies': [(l) => l === 'Business Studies'],
  Chemistry: [(l) => l === 'Chemistry'],
  Economics: [(l) => l === 'Economics'],
  'Engineering Studies': [(l) => l === 'Engineering Studies'],
  'History Extension': [(l) => l === 'History Extension'],
  'Legal Studies': [(l) => l === 'Legal Studies'],
  'Modern History': [(l) => l === 'Modern History'],
  Physics: [(l) => l === 'Physics'],
  'Visual Arts': [(l) => l.startsWith('Visual Arts')],
};
