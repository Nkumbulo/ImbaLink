import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('viewing request banner does not destructure repository at module evaluation time', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, '../src/pages/MessagesPage/useViewingRequestBanner.js'), 'utf8');
  expect(source).not.toMatch(/const\s*\{[^}]*getViewingRequestStatus[^}]*\}\s*=\s*backend\.viewingRequestRepository/);
  expect(source).toContain('backend.viewingRequestRepository?.getViewingRequestStatus');
});
