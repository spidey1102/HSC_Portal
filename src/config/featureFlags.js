// Keep temporarily unavailable areas disabled here rather than removing their
// code. Textbook components remain in the repository but are intentionally not
// imported by the public app, so their Drive links are not shipped to visitors.
// To restore the area, enable this flag and re-add the imports/render branches.
export const TEXTBOOKS_ENABLED = false;
// Enable after the daily-question tables, private bucket, and server secrets
// have been configured in the deployed environment.
export const DAILY_QUESTIONS_ENABLED = import.meta.env.VITE_DAILY_QUESTIONS_ENABLED === 'true';
