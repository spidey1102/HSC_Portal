export const MY_SUBJECTS_STORAGE_KEY = 'hsc_my_subjects';
export const MAX_MY_SUBJECTS = 6;

/** @returns {string[]} */
export function loadMySubjects() {
  try {
    const raw = localStorage.getItem(MY_SUBJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === 'string').slice(0, MAX_MY_SUBJECTS);
  } catch (e) {
    return [];
  }
}

/** @param {string[]} names @returns {string[]} */
export function saveMySubjects(names) {
  const unique = [...new Set(names)].slice(0, MAX_MY_SUBJECTS);
  try {
    localStorage.setItem(MY_SUBJECTS_STORAGE_KEY, JSON.stringify(unique));
  } catch (e) {
    // ignore
  }
  return unique;
}
