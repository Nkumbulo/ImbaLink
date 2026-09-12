#!/usr/bin/env node
// Regenerates the ImbaLink Engineering Dashboard's findings data from real,
// live checks against this repo — build, test suite, architecture boundary
// checker, ESLint, and a set of targeted file-level checks for specific
// findings — instead of hand-maintained status.
//
// Usage:
//   node scripts/dashboard-audit/generate-findings.mjs
//
// Writes scripts/dashboard-audit/findings-generated.json in the same shape
// the dashboard's Import button expects ({ issues, notes, updatedAt }).
// Findings with no automated check keep whatever status is already in
// findings-base.json (these need a human, or a live database, to verify —
// see the printed "MANUAL" list at the end).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSharedChecks, checks } from "./checks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const basePath = path.join(HERE, "findings-base.json");
const outPath = path.join(HERE, "findings-generated.json");

const base = JSON.parse(fs.readFileSync(basePath, "utf8"));

console.log(`\nImbaLink Dashboard — Automated Findings Check\n${"=".repeat(48)}\n`);

const shared = runSharedChecks();

console.log(`\nBuild:        ${shared.build.ok ? "PASS" : "FAIL"}`);
console.log(`Tests:        ${shared.test.ok ? "PASS" : "FAIL"}`);
console.log(`Architecture: ${shared.architecture.ok ? "PASS" : "FAIL"}`);
console.log(`ESLint:       ${shared.eslint.ran ? "RUNS (lint findings, if any, are separate)" : "CRASHED (module not found — still not installed)"}`);
console.log("");

const results = [];
const manual = [];
const changed = [];

const updated = base.map((finding) => {
  if (!finding.check) {
    manual.push(finding);
    return finding;
  }

  const checkFn = checks[finding.check];
  if (!checkFn) {
    console.warn(`⚠ no check function registered for "${finding.check}" (${finding.id})`);
    manual.push(finding);
    return finding;
  }

  let result;
  try {
    result = checkFn(shared);
  } catch (err) {
    console.warn(`⚠ check "${finding.check}" threw for ${finding.id}: ${err.message}`);
    manual.push(finding);
    return finding;
  }

  if (!result) {
    manual.push(finding);
    return finding;
  }

  const prevStatus = finding.status;
  const nextStatus = result.status;
  if (prevStatus !== nextStatus) {
    changed.push({ id: finding.id, title: finding.title, from: prevStatus, to: nextStatus, note: result.note });
  } else {
    results.push({ id: finding.id, status: nextStatus, note: result.note });
  }

  return { ...finding, status: nextStatus, check: undefined, _lastAutoCheck: result.note };
});

console.log(`\nStatus changes this run: ${changed.length}\n${"-".repeat(48)}`);
if (changed.length === 0) {
  console.log("  (none — every automated finding matches its recorded status)");
}
changed.forEach((c) => {
  console.log(`  ${c.id}: ${c.from ?? "(unset)"} → ${c.to}`);
  console.log(`    ${c.title}`);
  console.log(`    ${c.note}`);
});

console.log(`\nConfirmed unchanged: ${results.length}`);
console.log(`Needs manual/live-DB verification: ${manual.length}`);
manual.forEach((m) => console.log(`  - ${m.id}: ${m.title}`));

// ---- Staleness guard ----
// A check can silently give a WRONG answer if the file it's reading no
// longer exists where the finding says it does (renamed, moved, deleted) —
// that's more dangerous than an honest "can't verify," because it looks
// confident. This doesn't block anything; it just surfaces the risk so a
// stale reference doesn't quietly rot into false confidence.
const staleFileRefs = updated.filter((f) => {
  if (!f.file || !f.file.includes("/")) return false; // not a real path (a label like "test suite")
  const exists = fs.existsSync(path.resolve(HERE, "..", "..", f.file));
  if (f.fileExpectedAbsent) return exists; // flip: absence is the correct/fixed state here
  return !exists;
});
if (staleFileRefs.length > 0) {
  console.log(`\n⚠ Stale file reference(s) — verify these manually, don't trust their status:\n${"-".repeat(48)}`);
  staleFileRefs.forEach((f) => {
    console.log(`  ${f.id}: "${f.file}" ${f.fileExpectedAbsent ? "exists again (expected to stay removed)" : "no longer exists"}`);
  });
}

// ---- Run history ----
// A single overwritten JSON can't show whether things are trending toward
// done. Append a one-line summary per run to a local, git-trackable log —
// cheap, and the only way to see real progress over the weeks leading to
// a production date.
const historyPath = path.join(HERE, "history.jsonl");
const statusCounts = {};
updated.forEach((f) => { statusCounts[f.status] = (statusCounts[f.status] || 0) + 1; });
const openP0P1 = updated.filter((f) => (f.priority === "P0" || f.priority === "P1") && f.status !== "COMPLETE").length;
const historyLine = JSON.stringify({
  date: new Date().toISOString(),
  totalFindings: updated.length,
  statusCounts,
  openP0P1,
  staleFileRefs: staleFileRefs.map((f) => f.id),
  checksInconclusive: manual.length,
});
fs.appendFileSync(historyPath, historyLine + "\n");
console.log(`\nAppended run summary to ${historyPath}`);

const fullHistory = fs
  .readFileSync(historyPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const cleanedIssues = updated.map(({ check, _lastAutoCheck, fileExpectedAbsent, ...rest }) => rest);

const exportShape = {
  issues: cleanedIssues,
  notes: {},
  history: fullHistory,
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(outPath, JSON.stringify(exportShape, null, 2));
console.log(`\nWrote ${outPath}`);
console.log("Import this file into the dashboard via the \"Import JSON\" button.\n");
