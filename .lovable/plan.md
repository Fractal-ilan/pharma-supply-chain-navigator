## Goal
Produce one downloadable archive containing the full project so you can upload it into another Lovable account (or any Git/IDE workflow).

## What the archive will contain
- All source code: `src/`, `public/`, `index.html`, `abm/` (Python ABM), tests
- Config: `package.json`, `bun.lockb`/`package-lock.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `postcss.config.js`, `eslint.config.js`, `components.json`, `vitest.config.ts`, `playwright.config.ts`
- Docs/assets: `README.md`, `supply_chain_infographic.svg`
- Data: `src/data/*` including `validationReportData.json`

## What will be excluded
- `node_modules/`, `dist/`, `.vite/`, `.git/`, cached Vite timestamp files, `/tmp` artifacts — these bloat the zip and are regenerated on install.

## Deliverable
A single file written to `/mnt/documents/pharma-supply-chain-navigator.zip`, surfaced as a `presentation-artifact` so you can download it in one click.

## How to use it on the other account
1. Download the zip.
2. In the new Lovable account, create a new project and import / upload the zip (or unzip locally, push to a new GitHub repo, and connect that repo to the new Lovable project).
3. Lovable will install dependencies automatically on first run.

## Technical steps (build mode)
1. `cd /dev-server && zip -r /mnt/documents/pharma-supply-chain-navigator.zip . -x "node_modules/*" ".git/*" "dist/*" ".vite/*" "vite.config.ts.timestamp-*"`
2. Verify size and file count.
3. Emit `<presentation-artifact path="pharma-supply-chain-navigator.zip" mime_type="application/zip">`.

Approve to build the zip.