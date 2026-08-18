# Shared paper metadata setup

The paper-structure cache stores reusable **question counts, question labels, subparts, reliable mark values, and total marks** in the shared Firestore collection `paperMetadata`. It does not store a paper’s full PDF text or any student review data. Student reviews and mistake-notebook entries remain in the signed-in student’s existing `users/{uid}` document.

## Publish the Firestore rules

Before deploying the application, publish the repository’s updated [`firestore.rules`](../firestore.rules) to the Firebase project. The rules allow anyone to read the non-personal `paperMetadata` collection, while client-side writes are denied. The server route uses the Firebase Admin SDK and is therefore the only writer. The existing `users/{uid}` rule continues to restrict private review and mistake data to the authenticated owner.

Because this portal uses a named Firestore database, confirm that the rules are published to the database configured by `FIREBASE_FIRESTORE_DATABASE_ID` rather than to a different default database.

## Configure protected Vercel environment variables

Set these **server-only** variables for the Production, Preview, and Development environments as appropriate. Never prefix them with `VITE_`, and never place the service-account JSON in a browser-accessible file.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Existing portal AI key used to analyse a paper when no shared metadata exists. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON for a Firebase service account with access to the portal’s Firestore database. This is used only by the Vercel serverless route. |
| `FIREBASE_FIRESTORE_DATABASE_ID` | `ai-studio-hscportal-23b93b2f-3189-46a0-a6c8-b0b79ad59bc8`; optional because the server route includes this as its fallback. |
| `PAPER_METADATA_MODEL` | Optional OpenRouter model override. If omitted, the route uses `openrouter/free`. |

The service-account principal needs permission to read and write Firestore documents in the portal database. Do not use a browser API key in place of the service-account JSON.

## Verify the flow after deployment

Sign in, open a paper with a direct PDF source, and select **Analyse questions**. The first signed-in request extracts the paper text, asks the server-side model for structured JSON, validates the output, and creates one `paperMetadata` document. Another student opening that paper sees the cached question count and marks through Firestore without another AI call.

If the paper is image-only or its layout cannot be parsed safely, the interface keeps the manual review fields available and does not invent a mark total. Students can still record their score, review, and mistakes.
