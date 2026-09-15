# Dashboard Audit Checker

Regenerates the ImbaLink Engineering Dashboard's findings data from real,
live checks against this repo instead of hand-maintained status.

## Setup

1. Drop this whole `dashboard-audit/` folder into `scripts/` in the ImbaLink repo
   (i.e. `scripts/dashboard-audit/checks.mjs`, `scripts/dashboard-audit/findings-base.json`,
   `scripts/dashboard-audit/generate-findings.mjs`).
2. Optionally add a script to `package.json`:
   ```json
   "dashboard:audit": "node scripts/dashboard-audit/generate-findings.mjs"
   ```

## Run it

```bash
npm run dashboard:audit
# or directly:
node scripts/dashboard-audit/generate-findings.mjs
```

This runs `npm run build`, `npx vitest run`, `npm run check:architecture`, and
`npx eslint .`, then applies a set of targeted file-level checks (bundle size,
specific file diffs, line counts, grep patterns) for the findings that map
cleanly to something objective. It prints what changed and writes
`scripts/dashboard-audit/findings-generated.json` — import that file into the
dashboard via the **Import JSON** button.

## What's automated vs. what needs a human

16 of the 20 findings in `findings-base.json` have a `check` field naming a
function in `checks.mjs` that verifies them for real. The other 4 need either
a live database connection or a real device/browser to verify and are left
as-is on every run (printed under "Needs manual/live-DB verification"):

- `SEC-002` — public.users RLS backfill, needs a live DB check
- `DB-001` — property_images 403, root cause not yet isolated
- `DOC-001` — architecture docs completeness, a judgment call not a check
- `UX-001` — SearchPage mobile detail sheet, needs a real device

## Adding a new automated check

1. Add a finding to `findings-base.json` (same shape as the others, no `status`
   field, `"check": "yourCheckName"`).
2. Add `yourCheckName(shared)` to the `checks` export in `checks.mjs`. It gets
   the shared build/test/architecture/eslint results and should return
   `{ status, note }` (one of `NOT_STARTED` / `IN_PROGRESS` /
   `PARTIALLY_COMPLETE` / `COMPLETE` / `NEEDS_REVIEW` / `BLOCKED` / `FAILED`),
   or `null` if it can't reach a conclusion this run.
3. Re-run — it'll show up in the "Status changes" list.

## A note on trust

Every check here was written against this specific commit and manually
cross-checked before being trusted — the first version had two real bugs
(one picked the wrong build chunk, one silently dropped a build warning that
was on stderr instead of stdout) that would have reported false "fixed"
status. Re-verify a check's actual output against the real file/command
before trusting a new one, the same way — a check with a bug is exactly
the "claimed passed without really checking" failure mode this whole
tool exists to prevent.
