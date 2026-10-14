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
