TEACHTRACK - TERM SCHEDULE UPLOAD

1. Copy/replace the website files in your VS Code project (keep a backup).
2. Firebase Console > Firestore Database > Rules: replace the current rules with the FULL contents of FIRESTORE_RULES.txt, then Publish. Review these rules before real deployment.
3. Use VS Code Live Server to open index.html. Sign in as admin or teacher.
4. Admin: Teachers section > Upload Term Schedule > choose teacher and term.
5. Teacher: My Schedule > Upload Term Schedule > choose term.
6. For Excel, the automatic parser currently supports a simple table with columns Day, Start, End, Subject, Section. An official grid with merged cells is NOT automatically supported yet. Use the sample template included or enter/edit rows after opening a photo.
7. For JPG/PNG: a local photo preview is shown. There is NO OCR in this version. The user must enter rows manually. Original image bytes are NOT uploaded/stored; only filename and confirmed rows are saved. This avoids needing paid Firebase Storage.
8. Teacher submissions remain pending until an admin approves. Admin-approved rows replace the active weekly schedule in Firestore. The availability checker uses this active schedule.
9. Teachers cannot update active schedules directly. The existing manual schedule admin form is retained for compatibility.
10. Excel reader loads from cdn.sheetjs.com and needs internet. Test using a sample teacher account before adding 300 users.
11. The app's existing admin/teacher screens have not been end-to-end tested against your live Firebase project.
