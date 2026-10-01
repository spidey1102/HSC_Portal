# HSC Portal

A modern all-in-one portal designed to help NSW HSC students manage study resources, assessments, notes, timetables, and exam preparation in one place.

---

## Features

- 📚 Subject resource management
- 📝 Assessment tracking
- 📅 Study planner and timetable support
- 📊 Progress monitoring
- 🔍 Easy navigation for HSC materials
- 💻 Clean and responsive user interface
- ⚡ Fast and lightweight performance

---

## Tech Stack

This project includes:

- Frontend: HTML, CSS, JavaScript
- Backend: Vite.js 
- Database: Firebase
- Hosting: Vercel

---

## Installation

Clone the repository:

```bash
git clone https://github.com/spidey1102/HSC_Portal.git
```

Navigate into the project folder:

```bash
cd HSC_Portal
```

Install dependencies (if applicable):

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

or

```bash
npm start
```

---

## Usage

1. Just Run

### Owner account directory

The owner-only **Admin → Users** tab lists registered Firebase Authentication accounts, including email, UID, profile fields, account status, sign-in providers, creation/sign-in/refresh metadata, custom claims, and multi-factor enrollment metadata. Select an account to inspect its complete synced study data, legacy Firestore `users/{uid}` document, daily-contributor record, submitted answers, and authored daily posts. Directory pages and activity pages contain up to 50 records; use **Load more** to inspect the remaining records. Search applies to accounts already loaded.

Access is read-only and enforced on every `/api/accounts/users` request using the existing `DAILY_POST_OWNER_UIDS` server allowlist. Trusted posters and students cannot access this directory. Password hashes, salts, authentication tokens, and secret-bearing custom-claim fields are excluded. Browser-only data that has never been synced cannot be inspected remotely. Missing records and unavailable sources are reported separately.

Server setup (local `.env` or Vercel environment variables; never use `VITE_` prefixes):

- `FIREBASE_SERVICE_ACCOUNT_JSON`: a Firebase service-account JSON object for the project in `firebase-applet-config.json`, with permission to list/read Authentication users and read the legacy Firestore user documents. Alternatively, configure Google Application Default Credentials for that same project. Keep the private key server-only.
- `FIREBASE_FIRESTORE_DATABASE_ID`: the Firestore database containing the legacy user documents; leave empty for `(default)`.
- `DATABASE_URL`: the existing Supabase Postgres connection, with the portal storage and daily-question migrations applied.
- `DAILY_POST_OWNER_UIDS`: the owner's Firebase UID, or comma-separated owner UIDs.

The account panel does not require `VITE_DAILY_QUESTIONS_ENABLED`. Local Vite routes support the owner identity lookup and account API. Deploy the updated application after setting the server variables. Source-access failures appear as errors or warnings, not fabricated empty accounts.

The account directory (`/api/accounts/users`) and per-user study sync (`/api/accounts/data`) share the single Vercel function `api/accounts.js`. Explicit rewrites in `vercel.json` send those public paths to the function with a `resource` parameter before the frontend fallback. Do not rely on bracket-style dynamic filenames for this Vite deployment. The implementation modules live under `server/`, not `api/`, so they are not deployed as additional functions. This keeps the current deployment at the Vercel Hobby limit of 12 serverless functions without removing either feature. New `api/` entry points require further consolidation or a plan that permits more functions.


---

## Folder Structure

```plaintext
HSC_Portal/
│
├── public/            # Static assets
├── src/               # Main source code
│   ├── components/    # Reusable UI components
│   ├── pages/         # Application pages
│   ├── styles/        # CSS / styling
│   └── utils/         # Helper functions
│
├── package.json
├── README.md
└── LICENSE
```

---

## Future Improvements

- 🔔 Notification reminders for assessments
- 🤝 Collaborative study groups
- 📈 Advanced analytics dashboard
- 📱 Mobile app support
- ☁️ Cloud sync and backups

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to your branch

```bash
git push origin feature-name
```

5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Author

Created by [spidey1102](https://github.com/spidey1102)

Contributions and partial rewrite from [xslvrrr](https://github.com/xslvrrr)

---

## Repositories

https://github.com/spidey1102/HSC_Portal (original)

https://github.com/xslvrrr/HSC_Portal (contribution fork)
