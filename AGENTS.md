# Project data is part of the application

- Treat the house/plot project as tracked product data, just like source code. The canonical published project is `project-data/zielonki/project.json`. Browser IndexedDB is a working copy, not the sole source of truth.
- The existing `zielonki v2` project is `project-data/zielonki-v2/project.json` (`project/zielonki-v2`), now including the south carport. Continue this identity; do not create another project for subsequent v2 changes. Its immutable first-publication migration baseline is `before-carport-r46.json`; `before-pergola-r45.json` preserves the earlier full workspace. Capture and merge each project independently.
- The user explicitly requested a separate third design on 2026-09-10: `project-data/zielonki-rear-carport/project.json` (`project/zielonki-rear-carport`), named "Z garażem za domem przy sąsiadach", forked from preserved v2 r49. Its immutable baseline is `initial-r49.json`. Keep this historical rear-carport layout independent of current v2.
- Before a branch/worktree merge or deployment, extract the user's current workspace from the actual browser origin/profile, make a recoverable backup, and compare it with tracked project data. A test browser profile is not the user's profile. Never claim a project was transferred just because code was merged.
- Include project edits (including deletions, roof/room geometry, furniture, finishes and landscape) in the same reviewed change as code. Preserve stable entity `ref` identifiers and readable JSON. Record the source origin, revision, date and merge decisions in `project-data/zielonki/README.md`.
- Merge data using a common baseline and entity references, not array positions, timestamps or the largest revision number. Deletions must remain deletions. Independent field edits can merge; edit-versus-delete and different edits to the same field are conflicts. Do not resolve conflicts by silently choosing a whole branch or recreating defaults.
- Preserve both versions and report unresolved conflicts. Keep proposals/audit history in recoverable snapshots. Do not overwrite a newer browser working copy, reset IndexedDB, or touch another origin's project to make a deployment look correct.
- Before publishing, validate the schema and geometry, test deletions across save/reload and migration, and verify both a fresh browser and an existing saved project receive the intended data. Report code revision and project revision separately.
- Browser edits do not automatically commit to Git. Explicitly capture and merge them before delivery. Preserve the previous published project as the migration baseline when changing canonical data; do not replace the original legacy baseline with a newer snapshot.

# Zielonki roof constraints

- Preserve compliance of the main roof slopes with the applicable Zielonki MPZP. For this project's MN/MNU site in plan area 06, Resolution IX/55/2007, section 13(6)(4), requires symmetric gable or hipped main slopes of 37–45 degrees. See `knowledge-bank/zielonki/ZONING.md` for official sources and amendments; recheck the applicable plan before changing this constraint.
- The r44 house has 1.40 m attic knee walls and both main gables retain their previous pitch of approximately 40.134234 degrees. When changing knee-wall height, move eaves and ridges together to preserve pitch unless the user requests a compliant pitch change. Check each main roof segment after geometry edits and data merges.
- A compliant main-roof pitch does not establish compliance of the whole building or permission for the flat garage terrace/canopy. Keep those separate questions explicit as documented in the zoning evidence.

# Deployment

- The working house branch is `codex/deploy-furnished-zielonki`, local preview port 5173, public deployment on Mikrus port 20203. Follow `docs/mikrus-deployment.md`.
- GitHub Pages/main is the separate competition submission. Do not overwrite it when deploying the working house.
- During the hackathon, treat `main` as frozen and protected: do not commit, merge, rebase, reset or push changes to it, and do not trigger its GitHub Pages deployment. Commit and push house changes only to `codex/deploy-furnished-zielonki` and deploy that branch to Mikrus. Lift this freeze only on the user's explicit instruction; routine requests to commit, push, merge or redeploy do not lift it.
- Never commit browser profiles, credentials, `.env`, or unrelated browser data. Raw recovery backups belong in ignored `tmp/`; only extracted house project data belongs in Git.
