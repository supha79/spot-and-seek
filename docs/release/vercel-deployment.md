# Vercel Deployment

## Project settings

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: repository root

`vercel.json` rewrites client-side routes to `index.html`. The build command fails when either required Supabase browser variable is missing.

## Environment variables

Set these in Vercel Project Settings for each environment that will be used:

- `VITE_SUPABASE_URL`: the approved Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: the project's publishable/anon key

Only a publishable/anon key belongs in a `VITE_` variable. Never put a service-role key, database password, or other server secret in the frontend environment.

## Local verification update (2026-10-17)

- The local production build, Node tests (83), Vitest tests (74), and Docker-backed pgTAP suite (177 checks) pass. Dynamic positive-path assertions use a rollback-only synthetic policy fixture; no assertions were skipped. React Router is on `7.18.4`, Vite on `6.4.4`, and Vitest on `5.0.5`; the Vite/React plugin peer range and local Node 24 were checked.
- `vercel build --prod --yes` is not verified locally: Vercel CLI downloads the Production settings and completes `npm install`, then fails to spawn `cmd.exe` (`ENOENT`). The configured `npm run build` succeeds independently; no deployment was started.
- pgTAP ran only against the local database. The local `imgproxy` container is absent, so signed image-transformation requests have not been verified locally; `LevelArtwork` now falls back once to an untransformed signed URL when a thumbnail fails to load.
- `npm audit --omit=dev --audit-level=moderate` reports zero production dependency vulnerabilities.
- Full `npm audit` still reports seven development/build-tool advisories (five high, two moderate) in the Tailwind 3 dependency tree, including `braces` and `postcss-selector-parser`. The suggested Tailwind 4 update is a breaking CSS build/config migration and was not applied because the existing screens have not had a full visual regression pass on Tailwind 4.
- A read-only Vercel CLI listing shows `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured for Production and Preview. Their values were masked and not retrieved, so the Supabase URL/key target could not be validated.

## Release blockers

Passing the Vite build proves only that the frontend bundle can be produced. A read-only Production snapshot on 2026-10-17 showed all 16 migrations synchronized and the Dynamic Gameplay gate already enabled with 9 Published Levels. No Remote migration or gate change was made during that audit. The 2026-10-31 archived-level recovery migration is documented below; it does not change the Dynamic Gameplay gate.

## Archived level recovery (2026-10-31)

The Admin Levels page can restore an archived level only when its parent game is published and the existing published rule snapshot, pinned private artwork pair, spots, and approved score policy still satisfy the normal publish checks. The restore RPC delegates to the existing publish workflow and verifies that it reused the same immutable rule version and content hash; any content drift aborts the transaction. This preserves existing run history and does not silently create a replacement level version.

Local asset inventory update (2026-10-17): all nine `Picture/level-*/qa-report.txt` files report `VERIFIED`, and each `differences.json` hash matches the final per-level Original/Comparison files with verified difference entries. The `level-02-magic-garden` Comparison was normalized to the Original's 1448x1086 dimensions; the raw source remains preserved as `Picture/level2-2.png` and its SHA-256 is recorded separately. Local pair/manifest verification does not prove content rights, database records, private Storage objects, or published rule versions are ready. Do not treat local files as published production content.

Production's Dynamic Gameplay gate is already enabled; do not close or reopen it based on this audit. Structural content checks passed, but remote image bytes, signed image transformations, authenticated browser gameplay, and Vercel environment settings remain unverified. The local UI falls back to a full signed image if a thumbnail transform fails. The frontend intentionally has no local gameplay or catalog fallback; empty database content remains an empty catalog.
