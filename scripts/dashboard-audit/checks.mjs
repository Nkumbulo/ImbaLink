import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function readFile(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function run(cmd) {
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: err.stdout || "" };
  }
}

// ESLint exits non-zero whenever it finds ANY lint error — that's expected
// and not a sign anything is broken. "ok" (exit code) tells you nothing
// useful about whether ESLint itself is installed/runnable. What does:
// ESLint prints its own "Oops! Something went wrong!" banner whenever IT
// crashes before producing a normal report — regardless of which specific
// module was missing (different missing packages produce different error
// text: "ERR_MODULE_NOT_FOUND", "Cannot find module", "Cannot find
// package", etc., so matching the banner is far more robust than matching
// any one of those).
function eslintRan(result) {
  return !result.out.includes("Oops! Something went wrong");
}

// ---- Shared, expensive checks run once and passed into per-finding checks ----

export function runSharedChecks() {
  console.log("Running build...");
  const build = run("npm run build");

  console.log("Running test suite...");
  const test = run("npx vitest run");

  console.log("Running architecture checker...");
  const architecture = run("npm run check:architecture");

  console.log("Checking ESLint runs...");
  const eslintResult = run("npx --yes eslint .");
  const eslint = { ...eslintResult, ran: eslintRan(eslintResult) };

  return { build, test, architecture, eslint };
}

// ---- Per-finding checks. Each returns { status, note } or null if inconclusive. ----

export const checks = {
  migrationFootgun999(shared) {
    const a = readFile("backend/999-messaging-final-fix.sql");
    const b = readFile("backend/999-messaging-production-fix.sql");
    const hardened = readFile("backend/1000-phase6-messaging-reply-fix.sql");
    if (!a || !b || !hardened) return { status: "NOT_STARTED", note: "one of the three files is missing" };
    const identical = a === b;
    const nineNineNineHasHardening = a.includes("v_is_participant");
    if (identical && !nineNineNineHasHardening) {
      return { status: "NOT_STARTED", note: "999 files still byte-identical and still lack v_is_participant hardening that 1000/1001 have" };
    }
    if (!identical || nineNineNineHasHardening) {
      return { status: "COMPLETE", note: "999 files no longer identical, or hardening has been merged in" };
    }
    return null;
  },

  eslintRunnable(shared) {
    if (shared.eslint.ran) {
      return { status: "COMPLETE", note: "eslint . runs without a module-resolution crash (lint findings, if any, are a separate matter)" };
    }
    return { status: "NOT_STARTED", note: "still crashes before it can even scan a file (ERR_MODULE_NOT_FOUND / Cannot find package)" };
  },

  bundleCodeSplit(shared) {
    const matches = [...shared.build.out.matchAll(/index-[\w-]+\.js\s+([\d.]+)\s*kB/g)];
    const dynStaticWarning = shared.build.out.includes("is dynamically imported by") && shared.build.out.includes("but also statically imported by");
    if (matches.length === 0) return { status: "NEEDS_REVIEW", note: "could not parse any main chunk size from build output" };
    // Multiple chunks can start with "index-" (route chunks, the entry
    // bundle, etc.) — the one we care about for this finding is the
    // largest, since that's the one Vite's own size warning is about.
    const kb = Math.max(...matches.map((m) => parseFloat(m[1])));
    if (kb > 500 && dynStaticWarning) {
      return { status: "NOT_STARTED", note: `largest index-*.js chunk still ${kb}kB, indexeddb.js still both statically and dynamically imported` };
    }
    if (kb <= 500) return { status: "COMPLETE", note: `largest index-*.js chunk now ${kb}kB, under the 500kB warning threshold` };
    return { status: "PARTIALLY_COMPLETE", note: `largest chunk ${kb}kB but the dynamic/static import conflict is resolved` };
  },

  homeFilterBarSize() {
    const content = readFile("src/pages/HomePage/HomeFilterBar.jsx");
    if (!content) return { status: "COMPLETE", note: "file no longer exists at this path — likely already split or moved" };
    const lines = content.split("\n").length;
    if (lines > 300) return { status: "NOT_STARTED", note: `still ${lines} lines` };
    return { status: "COMPLETE", note: `now ${lines} lines` };
  },

  messageTicksDuplicate() {
    const a = readFile("src/pages/MessagesPage/MessageTicks.jsx");
    const b = readFile("src/features/messaging/components/MessageThread/MessageTicks.jsx");
    if (!a) return { status: "COMPLETE", note: "dead duplicate no longer exists" };
    if (!b) return { status: "NEEDS_REVIEW", note: "the canonical file is missing — check which copy is actually in use" };
    const referenced = run(`grep -rl "MessagesPage/MessageTicks" src`);
    if (a === b && !referenced.ok) {
      return { status: "NOT_STARTED", note: "still byte-identical and still unreferenced" };
    }
    return { status: "PARTIALLY_COMPLETE", note: "duplicate still exists but is no longer byte-identical, or is now referenced somewhere" };
  },

  adminRoleManagementUI() {
    const hit = run(`grep -rl "app_metadata.role" src/services/admin src/pages/AdminPage.jsx 2>/dev/null`);
    if (hit.ok && hit.out.trim()) {
      return { status: "NEEDS_REVIEW", note: "found a reference to app_metadata.role in admin UI code — check whether it's a real grant flow" };
    }
    return { status: "NOT_STARTED", note: "no in-app role-grant UI found; still Supabase Dashboard only" };
  },

  migrationReadmeCoverage() {
    const readme = readFile("backend/README.md");
    if (!readme) return null;
    const documented = new Set(
      [...readme.matchAll(/`(\d{3})-[\w-]+\.sql`/g)].map((m) => parseInt(m[1], 10)).filter((n) => n < 900)
    );
    const sqlFiles = fs
      .readdirSync(path.join(ROOT, "backend"))
      .filter((f) => /^\d{3}-.*\.sql$/.test(f))
      .map((f) => parseInt(f.match(/^(\d{3})/)[1], 10))
      .filter((n) => n < 900);
    const existing = [...new Set(sqlFiles)];
    const undocumented = existing.filter((n) => !documented.has(n)).sort((a, b) => a - b);
    if (undocumented.length === 0) {
      return { status: "COMPLETE", note: `every migration file (up to ${Math.max(...existing)}) is referenced by number in README.md` };
    }
    return {
      status: "NEEDS_REVIEW",
      note: `migration(s) with no mention anywhere in README.md: ${undocumented.join(", ")}`,
    };
  },

  dockerSkippedTests(shared) {
    const skipped = (shared.test.out.match(/Docker\/Postgres unavailable/g) || []).length;
    const totalFiles = (shared.test.out.match(/Test Files\s+(\d+)/) || [])[1];
    if (skipped === 0) return { status: "COMPLETE", note: "no Docker/Postgres-skipped test files found" };
    return {
      status: "PARTIALLY_COMPLETE",
      note: `${skipped} test file(s) still skip real assertions when Docker/Postgres is unavailable (of ${totalFiles || "?"} total files) — green run still overstates coverage`,
    };
  },

  messagingMemoization() {
    const controller = readFile("src/pages/MessagesPage/useMessagesPageController.js");
    const list = readFile("src/features/messaging/components/MessageThread/MessageList.jsx");
    const composer = readFile("src/features/messaging/components/MessageThread/MessageComposer.jsx");
    if (!controller || !list || !composer) return null;
    const listMemoized = /React\.memo/.test(list);
    const composerMemoized = /React\.memo/.test(composer);
    const keyCallbacksStabilized =
      /useCallback[^)]*retryMessage|const retryMessage = useCallback/.test(controller) &&
      /useCallback[^)]*handleViewingResponse|const handleViewingResponse = useCallback/.test(controller);
    if (listMemoized && composerMemoized && keyCallbacksStabilized) {
      return { status: "COMPLETE", note: "MessageList/MessageComposer memoized and controller callbacks stabilized" };
    }
    if (listMemoized || composerMemoized || keyCallbacksStabilized) {
      return { status: "PARTIALLY_COMPLETE", note: "some memoization present but not both memo + stable callbacks together" };
    }
    return { status: "NOT_STARTED", note: "neither component memoized, key callbacks not useCallback-stabilized" };
  },

  presenceBroadcastFix() {
    const content = readFile("src/hooks/useGlobalPresence.js");
    if (!content) return null;
    const hasTrack = /\.track\(/.test(content);
    if (!hasTrack) return { status: "COMPLETE", note: "no channel.track() broadcast found" };
    return { status: "NOT_STARTED", note: "channel.track() broadcast still present — O(n²) presence issue likely still live" };
  },

  landlordVisibilityFix() {
    const content = readFile("src/features/messaging/components/MessageThread/MessageList.jsx");
    if (!content) return null;
    const gatedBlock = /isViewingRequestMessage\s*&&\s*isPropertyOwner\s*&&[\s\S]{0,120}(declined|cancelled)/.test(content);
    const roleAwareCopy = /isPropertyOwner[\s\S]{0,40}\?[\s\S]{0,200}:/.test(content) && /(declined|cancelled)/.test(content);
    if (roleAwareCopy && !gatedBlock) {
      return { status: "COMPLETE", note: "assistant bubble appears role-aware, not gated to owner-only" };
    }
    return { status: "NEEDS_REVIEW", note: "could not confirm the gate is fully removed — check manually" };
  },

  messageScrollFix() {
    const paths = ["src/hooks/useMessageViewport.js", "src/pages/MessagesPage/useMessageViewport.js"];
    const content = paths.map(readFile).find(Boolean);
    if (!content) return null;
    const usesRealBottom = /scrollTop\s*=\s*\w+\.scrollHeight/.test(content);
    const doubleRaf = (content.match(/requestAnimationFrame/g) || []).length >= 2;
    if (usesRealBottom && doubleRaf) {
      return { status: "COMPLETE", note: "scrollTop=scrollHeight approach with a re-check on a later frame is in place" };
    }
    return { status: "NOT_STARTED", note: "still using scroll-margin/scrollIntoView guessing, or no late-layout re-check" };
  },

  buildSucceeds(shared) {
    if (shared.build.ok) return { status: "COMPLETE", note: "production build succeeds with no errors" };
    return { status: "FAILED", note: "production build is currently failing — see build output" };
  },

  splitFileSizes() {
    const targets = [
      "src/components/property/PropertyDetail.jsx",
      "src/pages/PostPage/PostCard.jsx",
      "src/pages/MessagesPage/MessageThreadView.jsx",
    ];
    const sizes = targets
      .map((t) => {
        const content = readFile(t);
        return content ? content.split("\n").length : null;
      })
      .filter((n) => n !== null);
    if (sizes.length === 0) return null;
    const stillSmall = sizes.every((n) => n < 400);
    return stillSmall
      ? { status: "COMPLETE", note: `spot-checked split files still under 400 lines (${sizes.join(", ")})` }
      : { status: "NEEDS_REVIEW", note: `one or more previously-split files have grown back large: ${sizes.join(", ")}` };
  },

  deadFilesRemoved() {
    const oldBottomNav = fileExists("src/components/BottomNav.jsx");
    const mockProvider = fileExists("src/services/messaging/mockMessagingProvider.js");
    if (!oldBottomNav && !mockProvider) {
      return { status: "COMPLETE", note: "both previously-flagged dead files remain absent" };
    }
    return { status: "NOT_STARTED", note: "one of the previously-removed dead files has reappeared — check for a regression" };
  },

  duplicateMigrationNumbers() {
    const files = fs.readdirSync(path.join(ROOT, "backend")).filter((f) => /^\d{3}-.*\.sql$/.test(f));
    const counts = {};
    files.forEach((f) => {
      const n = f.match(/^(\d{3})/)[1];
      counts[n] = (counts[n] || 0) + 1;
    });
    const dupes = Object.entries(counts).filter(([, c]) => c > 1);
    if (dupes.length === 0) return { status: "COMPLETE", note: "no duplicate migration numbers found" };
    return {
      status: "NOT_STARTED",
      note: `duplicate migration number(s) still present: ${dupes.map(([n]) => n).join(", ")}`,
    };
  },
};
