import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|jsx)$/.test(entry.name)) sourceFiles.push(file);
  }
}
walk(root);
const clean = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('architecture boundaries', () => {
  it('has no UI imports of legacy database infrastructure', () => {
    const offenders = sourceFiles.filter((file) => {
      const rel = path.relative(root, file).replaceAll(path.sep, '/');
      if (rel.startsWith('services/') || rel.startsWith('core/') || rel.startsWith('auth/')) return false;
      return /from\s*["'][^"']*services\/(database|db\/|supabase)[^"']*["']/.test(clean(fs.readFileSync(file, 'utf8')));
    });
    expect(offenders).toEqual([]);
  });

  it('keeps direct persistence behind core domains/adapters or services compatibility boundaries', () => {
    const offenders = sourceFiles.filter((file) => {
      const rel = path.relative(root, file).replaceAll(path.sep, '/');
      if (rel.startsWith('core/data/') || rel.startsWith('services/db/') || rel === 'services/database.js') return false;
      return /from\s*["'][^"']*(?:services\/db\/|core\/data\/adapters\/db\/)[^"']*["']/.test(clean(fs.readFileSync(file, 'utf8')));
    });
    expect(offenders).toEqual([]);
  });
});
