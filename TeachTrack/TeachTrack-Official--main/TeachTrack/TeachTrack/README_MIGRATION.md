# TeachTrack — Vercel + PostgreSQL migration (setup required)

This package removes Firebase client imports and adds a Vercel serverless API and PostgreSQL document storage. **Not deployed or connected to a live database.**

## Deploy
1. Create a PostgreSQL database (e.g. Neon via Vercel Marketplace). Use a private connection string.
2. Run `schema.sql` in the database SQL editor.
3. Set Vercel environment variables `DATABASE_URL` and a cryptographically random `SESSION_SECRET` (at least 32 characters). Never put these in website JavaScript or GitHub.
4. Install dependencies (`npm install`) and deploy the project root on Vercel.
5. Create the initial admin from a trusted machine using `DATABASE_URL` in your environment and `node scripts/create-admin.mjs ADMIN_USERNAME 'STRONG_UNIQUE_PASSWORD'`. Do not commit passwords.
6. Log in with the admin username and password. Admin creates teacher usernames/passwords in the dashboard.

## Migration notes and limitations
- Firebase data is **not** transferred. Obtain a Firestore export/backup when Firebase access is restored, then migrate carefully. This package starts with an empty database.
- Real-time Firestore listeners are replaced by request-based reads. Cross-user instant updates are **not** implemented; refresh to see changes.
- Existing teacher creation UI uses the old variable `email` for the username; no Gmail account is required.
- This is an initial compatibility migration, **not a security-audited production release**. Verify admin and teacher permissions, timetable approval, absence workflows, and account lifecycle before entering real student or teacher data.
- Some original flows assume Firestore behavior and may need additional adjustments after end-to-end testing against a deployed database.
- Never publish database credentials, SESSION_SECRET, or a service account key. Use unique passwords and secure account recovery procedures.
- To run automated core tests: `npm test`.

## Teacher self-registration update
- Public Create Teacher Account accepts a full name, real email address, and a NEW TeachTrack-only password (minimum 12 characters).
- Registrations create **disabled/pending** teacher accounts. School administrators must verify the teacher independently and approve at `/approvals.html` after signing in. The registration form cannot create admin accounts.
- Admin accounts must be provisioned privately using `scripts/create-admin.mjs` after `schema.sql` is applied. Use individual admin accounts where possible.
- **IMPORTANT:** This version does NOT verify ownership of the submitted email address. Approval by a school administrator is required; do not assume an email belongs to the registrant. Password reset, abuse throttling and production security review are still needed before real-world use.
- In Neon SQL Editor run the entire `schema.sql` from this ZIP. Earlier manually created `users` table is not used by the backend; the API requires `tt_users` and `tt_documents`. Existing `users` can remain untouched.
- Set `SESSION_SECRET` in Vercel to a unique random string at least 32 characters long; `DATABASE_URL` must also be configured. Redeploy after setting environment variables.
- To create admin locally, use environment variables rather than putting secrets in GitHub. Never put a real password in chat.
