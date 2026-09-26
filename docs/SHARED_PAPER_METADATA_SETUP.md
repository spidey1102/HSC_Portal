# Portal data storage

Firebase Authentication signs students in. Supabase stores their private study data in `portal_user_data` and shared paper analysis in `paper_metadata`. Server routes verify Firebase ID tokens before reading or writing private data.

## Student data

The first successful authenticated request creates an empty `portal_user_data` row if needed. Each student can then save subjects, settings, paper history, reviews, and mistakes under their Firebase UID.

The site checks the older Firestore `users/{uid}` document once per student. It copies fields missing from Supabase and keeps existing Supabase values. The older Firestore document is not deleted. If that check is temporarily unavailable, it is retried on a later sign-in.

Keep [`firestore.rules`](../firestore.rules) published while this migration is in use. Its `users/{uid}` rule lets students read only their own older data.

## Deployment

Apply [`20260820_01_create_portal_storage.sql`](../supabase/migrations/20260820_01_create_portal_storage.sql) to the Supabase database. Configure `DATABASE_URL` and `OPENROUTER_API_KEY` as server-only environment variables in Vercel. Do not expose the database URL to browser code.

After deployment, sign in with a new account and confirm its UID appears in `portal_user_data`. Sign in with an account that has an older Firestore `users/{uid}` document and confirm its study fields appear in Supabase. Existing Supabase values should remain intact.
