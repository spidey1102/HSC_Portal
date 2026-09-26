# Question of the Day setup

The site uses Firebase Authentication to identify posters and students. Post text and submissions are stored in Supabase Postgres; PDFs and images are stored in a private Supabase Storage bucket. The browser never receives the Supabase service role key.

## Before deploying

1. Run [`20260926_01_daily_questions.sql`](../supabase/migrations/20260926_01_daily_questions.sql) in the same Supabase project used by `DATABASE_URL`. It creates the tables and the private `daily-questions` bucket. The bucket accepts PDF, JPG, PNG, and WebP files up to 20 MB.
2. In Vercel, add these **server-only** environment variables for the website: `SUPABASE_URL` (the Supabase project URL), `SUPABASE_SERVICE_ROLE_KEY` (the project's service role key), and `DAILY_POST_OWNER_UIDS` (the site owner's Firebase UID; separate multiple UIDs with commas). Do not prefix these with `VITE_` or put them in browser code.
3. Confirm `DATABASE_URL` already points to that Supabase project. Set `VITE_DAILY_QUESTIONS_ENABLED=true` in Vercel, then redeploy. Until this flag is enabled, the new interface stays hidden.

The owner can use **Question of the Day → Poster studio → Trusted posters** to grant or remove posting access by Firebase UID. Poster access is checked on every server request. Only the author of a question can read its student submissions and their private attachments, even if another account has the owner role.

## Publishing flow

The poster creates a draft, chooses a Sydney calendar date, adds question text and/or a PDF or image, and publishes it. One published question is allowed per date. Students see it on that date and can submit one private answer with text and/or a PDF or image. The poster can add an official solution and reveal it manually. Published questions and revealed solutions cannot be changed, protecting what students saw.

The current public view shows the latest 60 published questions. A submitted student sees confirmation but cannot read any submission afterward. Only the question author sees the submission text and signed attachment links.
