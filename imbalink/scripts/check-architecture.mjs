import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const violations = [];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
  }
}
walk(root);

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function sourceWithoutComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function localImportSpecifiers(text) {
  const clean = sourceWithoutComments(text);
  const specs = [];
  for (const match of clean.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) {
    specs.push(match[1]);
  }
  return specs;
}

function resolveLocal(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const graph = new Map(files.map((file) => [file, []]));

for (const file of files) {
  const r = rel(file);
  const text = sourceWithoutComments(fs.readFileSync(file, "utf8"));

  // Data access belongs behind the core data/domain boundary or an explicitly
  // marked infrastructure/auth boundary. UI must never become a data layer.
  if (!r.startsWith("services/") && !r.startsWith("core/") && !r.startsWith("auth/")) {
    if (/supabase\.(from|rpc|functions\.invoke)\s*\(/.test(text)) {
      violations.push(`${r}: direct Supabase data access outside services/core/auth`);
    }
  }

  if (!r.startsWith("services/") && !r.startsWith("core/") && !r.startsWith("auth/")) {
    if (/from\s*["'][^"']*services\/(database|db\/|supabase)[^"']*["']/.test(text)) {
      violations.push(`${r}: imports legacy/infrastructure data service directly`);
    }
  }

  // The compatibility facade is intentionally isolated.
  if (r !== "services/database.js" && /from\s*["'][^"']*services\/database[^"']*["']/.test(text)) {
    violations.push(`${r}: imports deprecated services/database facade; use a core data domain API`);
  }

  // Low-level DB adapters are infrastructure. Only the domain adapter layer,
  // compatibility facade, or another adapter may consume them.
  if (!r.startsWith("core/data/adapters/") && r !== "services/database.js" && !r.startsWith("services/db/")) {
    if (/from\s*["'][^"']*(?:services\/db\/|core\/data\/adapters\/db\/)[^"']*["']/.test(text)) {
      violations.push(`${r}: imports low-level persistence directly; use core/data/domains`);
    }
  }

  // Dependency direction: core is reusable infrastructure and cannot depend
  // on pages/components. Pages/components may depend on core, never reverse it.
  if (r.startsWith("core/") && /from\s*["'][^"']*(?:pages|components|App|hooks)\//.test(text)) {
    violations.push(`${r}: core layer depends on UI/application layer`);
  }

  for (const specifier of localImportSpecifiers(fs.readFileSync(file, "utf8"))) {
    const target = resolveLocal(file, specifier);
    if (target) graph.get(file).push(target);
    else violations.push(`${r}: unresolved local import ${specifier}`);
  }
}

// Detect actual relative-import cycles. Comments are stripped so documentation
// examples cannot create false positives.
const state = new Map();
const stack = [];
const seenCycles = new Set();
function visit(node) {
  state.set(node, 1);
  stack.push(node);
  for (const target of graph.get(node) || []) {
    if (state.get(target) === 1) {
      const start = stack.indexOf(target);
      const cycle = [...stack.slice(start), target].map(rel).join(" -> ");
      if (!seenCycles.has(cycle)) {
        seenCycles.add(cycle);
        violations.push(`circular dependency: ${cycle}`);
      }
    } else if (!state.get(target)) visit(target);
  }
  stack.pop();
  state.set(node, 2);
}
for (const file of files) if (!state.get(file)) visit(file);

if (violations.length) {
  console.error("Architecture boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Architecture check passed (${files.length} source files scanned; no unresolved local imports or dependency cycles).`);
