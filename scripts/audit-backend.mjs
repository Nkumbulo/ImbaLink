import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const violations = [];
const warnings = [];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) files.push(full);
  }
}
walk(root);

function rel(file) { return path.relative(root, file).replaceAll(path.sep, '/'); }
function clean(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

for (const file of files) {
  const r = rel(file);
  const source = clean(fs.readFileSync(file, 'utf8'));
  const providerBound = r.startsWith('infrastructure/supabase/') || r.startsWith('auth/');
  const legacyData = r.startsWith('core/data/implementations/') || r.startsWith('services/db/');

  if (!providerBound && /from\s*["']@supabase\/supabase-js["']/.test(source))
    violations.push(`${r}: Supabase SDK import outside infrastructure/auth`);

  if (r.startsWith('features/') || r.startsWith('components/') || r.startsWith('pages/') || r.startsWith('App/')) {
    if (/supabase\.(from|rpc|functions\.invoke)\s*\(/.test(source))
      violations.push(`${r}: direct Supabase data access in presentation/feature layer`);
    if (/from\s*["'][^"']*(?:services\/supabase|services\/db\/|core\/data\/implementations)[^"']*["']/.test(source))
      violations.push(`${r}: imports provider/legacy persistence directly`);
  }

  if (legacyData && !providerBound) {
    if (/supabase\.(from|rpc|functions\.invoke)\s*\(/.test(source))
      warnings.push(`${r}: legacy provider-bound implementation remains below core/services boundary`);
  }
}

const backendFile = path.join(root, 'infrastructure/supabase/backend.js');
const backend = fs.readFileSync(backendFile, 'utf8');
const expectedPorts = [
  'auth: supabaseAuthAdapter', 'propertyRepository: supabasePropertyRepository',
  'profileRepository: supabaseProfileRepository', 'accountStateRepository: supabaseAccountStateRepository',
  'interactionRepository: supabaseInteractionRepository', 'viewingRequestRepository: supabaseViewingRequestRepository',
  'enquiryRepository: supabaseEnquiryRepository', 'reportRepository: supabaseReportRepository',
  'registrationRepository: supabaseRegistrationRepository', 'studentRepository: supabaseStudentRepository',
  'notificationRepository: supabaseNotificationRepository', 'sharingRepository: supabaseSharingRepository',
  'quoteRepository: supabaseQuoteRepository', 'supportRepository: supabaseSupportRepository',
  'verificationRepository: supabaseVerificationRepository', 'messageRepository: supabaseMessageRepository',
  'conversationRepository: supabaseConversationRepository', 'storage,', 'realtime,', 'functions,',
  'legalDocumentRepository: supabaseLegalDocumentRepository',
];
for (const port of expectedPorts) {
  if (!backend.includes(port)) violations.push(`composition root: missing backend wiring for ${port}`);
}

// Core implementations that still talk directly to Supabase are intentionally
// reported as migration debt rather than failing the build. They are provider-
// bound services currently consumed by infrastructure adapters.
console.log(`Backend audit: ${files.length} source files scanned.`);
console.log(`Hard presentation-boundary violations: ${violations.length}`);
for (const v of violations) console.log(`- ${v}`);
console.log(`Legacy/provider-bound warnings: ${warnings.length}`);
for (const w of warnings.slice(0, 80)) console.log(`- ${w}`);
if (warnings.length > 80) console.log(`- ... ${warnings.length - 80} more`);
if (violations.length) process.exit(1);
