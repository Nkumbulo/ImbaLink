import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(file);
  }
}
walk(root);

function resolveLocal(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js"), path.join(base, "index.jsx")];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const missing = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
  for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g)) {
    if (!resolveLocal(file, match[1])) {
      missing.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

if (missing.length) {
  console.error("Unresolved local imports:");
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`Import check passed (${files.length} source files scanned).`);
