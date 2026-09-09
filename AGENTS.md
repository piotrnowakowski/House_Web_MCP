# Project data is part of the application

- Treat the house/plot project as tracked product data, just like source code. The canonical published project is `project-data/zielonki/project.json`. Browser IndexedDB is a working copy, not the sole source of truth.
- Before a branch/worktree merge or deployment, extract the user's current workspace from the actual browser origin/profile, make a recoverable backup, and compare it with tracked project data. A test browser profile is not the user's profile. Never claim a project was transferred just because code was merged.
- Include project edits (including deletions, roof/room geometry, furniture, finishes and landscape) in the same reviewed change as code. Preserve stable entity `ref` identifiers and readable JSON. Record the source origin, revision, date and merge decisions in `project-data/zielonki/README.md`.
- Merge data using a common baseline and entity references, not array positions, timestamps or the largest revision number. Deletions must remain deletions. Independent field edits can merge; edit-versus-delete and different edits to the same field are conflicts. Do not resolve conflicts by silently choosing a whole branch or recreating defaults.
- Preserve both versions and report unresolved conflicts. Keep proposals/audit history in recoverable snapshots. Do not overwrite a newer browser working copy, reset IndexedDB, or touch another origin's project to make a deployment look correct.
- Before publishing, validate the schema and geometry, test deletions across save/reload and migration, and verify both a fresh browser and an existing saved project receive the intended data. Report code revision and project revision separately.
- Browser edits do not automatically commit to Git. Explicitly capture and merge them before delivery. Preserve the previous published project as the migration baseline when changing canonical data; do not replace the original legacy baseline with a newer snapshot.

# Deployment

- The working house branch is `codex/deploy-furnished-zielonki`, local preview port 5173, public deployment on Mikrus port 20203. Follow `docs/mikrus-deployment.md`.
- GitHub Pages/main is the separate competition submission. Do not overwrite it when deploying the working house.
- Never commit browser profiles, credentials, `.env`, or unrelated browser data. Raw recovery backups belong in ignored `tmp/`; only extracted house project data belongs in Git.
