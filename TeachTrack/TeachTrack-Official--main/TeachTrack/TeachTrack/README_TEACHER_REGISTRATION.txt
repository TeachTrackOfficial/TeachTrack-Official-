TEACHTRACK - TEACHER SELF-REGISTRATION

This ZIP contains a TeachTrack folder. Upload its contents to the existing GitHub TeachTrack/ directory (preserving api/, js/, css/, and other paths). Vercel Root Directory must remain TeachTrack.

Teacher registration:
1. Open the deployed TeachTrack login page.
2. Click Create Teacher Account.
3. Enter full name, Gmail or school email, and a NEW TeachTrack password (at least 12 characters).
4. Submit. The account is disabled until school approval.
5. Sign in as an existing admin and open /approvals.html or Teacher Approvals on the dashboard.
6. Verify the teacher's identity independently with the school before clicking Approve teacher.
7. The teacher may now sign in with the email and TeachTrack password.

IMPORTANT:
- Email address ownership is NOT verified automatically. Admin verification is required.
- Teacher registration cannot grant admin privileges.
- The server requires DATABASE_URL and SESSION_SECRET in Vercel Production environment variables.
- Redeploy after uploading changes to GitHub if Vercel does not deploy automatically.
- Do not upload .env files, database credentials, or passwords to GitHub.
