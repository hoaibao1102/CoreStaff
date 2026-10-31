/**
 * SAFE OFFLINE INSPECTOR ONLY, not an operational migration.
 * From Apps/api: npx ts-node scripts/migrate-overtime-attendance-v2.ts [--inspect|--dry-run] [--stdin]
 * --stdin accepts a JSON MigrationSnapshot export. No DB/export/backup operation is implemented.
 * Output is JSON on stdout; no files, flags, policies, indexes or documents are written.
 * Missing arrays mean NOT SUPPLIED, not proof of an empty production collection.
 */
import { inspectOvertimeAttendanceV2, MigrationSnapshot } from '../src/hr/overtime/overtime-attendance-migration';

function inventory() {
  // Source metadata only: never require or execute a seed, application or schema module.
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const apiRoot = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(apiRoot, 'package.json'), 'utf8'));
  const packageSeedCommands = Object.fromEntries(Object.entries(pkg.scripts as Record<string, string>).filter(([name, command]) => name.startsWith('seed') || /seed[^/]*\.ts/.test(command)));
  const seedEntrypoints = [
    ...fs.readdirSync(path.join(apiRoot, 'scripts')).filter(name => /^seed.*\.ts$/.test(name)).map(name => `CoreStaff/Apps/api/scripts/${name}`),
    'CoreStaff/Apps/api/src/database/seed/seed.ts',
  ].sort();
  return {
    scope: 'SOURCE_ENTRYPOINTS_ONLY_NO_CLIENT_RUNTIME_OR_SEED_EXECUTION',
    clients: [
      { path: 'CoreStaff/Apps/web/src/services/manager.service.ts', status: 'REQUIRES_CUTOVER_COMPATIBILITY_REVIEW', routes: ['/api/requests', '/api/overtime', '/api/overtime/schedule'] },
      { path: 'CoreStaff/Apps/web/src/services/policies.service.ts', status: 'REQUIRES_EXPLICIT_POLICY_REVIEW' },
      { client: 'Mobile and external/old clients', status: 'NOT_VERIFIED', action: 'Inventory deployed versions before tenant cutover; Mobile UI remains separate scope' },
    ],
    seedEntrypoints, packageSeedCommands,
    warning: 'Seeds are not migrations. Some package entrypoints may be absent; listed commands are metadata, never authorization to run them.',
  };
}

export function runMigrationInspection(args: string[] = [], snapshot: MigrationSnapshot = {}) {
  if (args.some(arg => !['--inspect', '--dry-run', '--stdin'].includes(arg)) || (args.includes('--inspect') && args.includes('--dry-run'))) {
    throw new Error('UNSUPPORTED_MODE: read-only offline inspect/dry-run only. Apply, backfill, activate, indexes, drop and rollback are NOT IMPLEMENTED; require a separate reviewed implementation and explicit approval.');
  }
  return { ...inspectOvertimeAttendanceV2(snapshot), mode: args.includes('--dry-run') ? 'dry-run' : 'inspect',
    suppliedCollections: Object.keys(snapshot), inventory: inventory(),
    indexVerification: 'NOT_PERFORMED_NO_DATABASE_CONNECTION',
    featureActivation: 'NOT_IMPLEMENTED',
  };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    // Validate/refuse all unsupported modes BEFORE reading stdin, even when --stdin is present.
    runMigrationInspection(args);
    const snapshot = args.includes('--stdin') ? JSON.parse(require('node:fs').readFileSync(0, 'utf8')) : {};
    process.stdout.write(`${JSON.stringify(runMigrationInspection(args, snapshot), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Inspection failed'}\n`);
    process.exitCode = 1;
  }
}
