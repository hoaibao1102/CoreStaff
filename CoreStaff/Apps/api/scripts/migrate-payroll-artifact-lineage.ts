import { MongoClient } from 'mongodb';

export const APPLY_OPT_IN = 'I_UNDERSTAND_THIS_MUTATES_PAYROLL_ARTIFACTS';

export type MigrationMode = 'inspect' | 'apply' | 'verify' | 'rollback';
export interface MigrationOptions { mode: MigrationMode; applyOptIn: boolean }
export interface MigrationOperation {
  id: string;
  kind: 'inspect' | 'write';
  blockedBy?: string[];
}
export interface MigrationPlan {
  mode: MigrationMode;
  readOnly: boolean;
  operations: MigrationOperation[];
}

const WRITE_MODES = new Set<MigrationMode>(['apply', 'rollback']);

export function parseMigrationOptions(args: string[]): MigrationOptions {
  const modeValue = args.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length) ?? 'inspect';
  if (!['inspect', 'apply', 'verify', 'rollback'].includes(modeValue)) {
    throw new Error('INVALID_MIGRATION_MODE');
  }
  const mode = modeValue as MigrationMode;
  const applyOptIn = args.includes(`--allow-apply=${APPLY_OPT_IN}`);
  if (WRITE_MODES.has(mode) && !applyOptIn) throw new Error('APPLY_OPT_IN_REQUIRED');
  return { mode, applyOptIn };
}

export function buildMigrationPlan(options: MigrationOptions): MigrationPlan {
  if (options.mode === 'inspect') {
    return {
      mode: options.mode,
      readOnly: true,
      operations: [
        { id: 'inventory-legacy-and-duplicates', kind: 'inspect' },
        { id: 'inspect-current-indexes', kind: 'inspect' },
        { id: 'render-apply-plan', kind: 'inspect' },
      ],
    };
  }
  if (options.mode === 'verify') {
    return {
      mode: options.mode,
      readOnly: true,
      operations: [{ id: 'verify-lineage-and-indexes', kind: 'inspect' }],
    };
  }
  if (options.mode === 'rollback') {
    return {
      mode: options.mode,
      readOnly: false,
      operations: [
        { id: 'backup-pre-rollback-state', kind: 'write' },
        { id: 'restore-legacy-indexes', kind: 'write', blockedBy: ['backup-pre-rollback-state'] },
        { id: 'remove-new-indexes', kind: 'write', blockedBy: ['restore-legacy-indexes'] },
      ],
    };
  }
  return {
    mode: options.mode,
    readOnly: false,
    operations: [
      { id: 'inventory-legacy-and-duplicates', kind: 'inspect' },
      { id: 'backup-affected-collections', kind: 'write', blockedBy: ['inventory-legacy-and-duplicates'] },
      { id: 'backfill-explicit-legacy-contract', kind: 'write', blockedBy: ['backup-affected-collections'] },
      { id: 'create-versioned-history-indexes', kind: 'write', blockedBy: ['backfill-explicit-legacy-contract'] },
      { id: 'verify-backfill-before-index-cutover', kind: 'inspect', blockedBy: ['create-versioned-history-indexes'] },
      { id: 'drop-conflicting-legacy-indexes', kind: 'write', blockedBy: ['verify-backfill-before-index-cutover'] },
      { id: 'create-one-active-run-index', kind: 'write', blockedBy: ['drop-conflicting-legacy-indexes'] },
      { id: 'verify-lineage-and-indexes', kind: 'inspect', blockedBy: ['create-one-active-run-index'] },
    ],
  };
}

const COLLECTIONS = ['timesheet_summaries', 'payroll_input_snapshots', 'payroll_runs', 'payslips'] as const;

async function inspect(client: MongoClient): Promise<Record<string, unknown>> {
  const db = client.db();
  const result: Record<string, unknown> = {};
  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    result[name] = {
      count: await collection.countDocuments(),
      missingSchemaVersion: await collection.countDocuments({ schemaVersion: { $exists: false } }),
      indexes: await collection.indexes(),
    };
  }
  result.summaryIdentityDuplicates = await db.collection('timesheet_summaries').aggregate([
    { $group: { _id: { organizationId: '$organizationId', periodId: '$periodId', sourcePeriodVersion: { $ifNull: ['$sourcePeriodVersion', 1] }, employeeProfileId: '$employeeProfileId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  result.snapshotIdentityDuplicates = await db.collection('payroll_input_snapshots').aggregate([
    { $group: { _id: { organizationId: '$organizationId', periodId: '$periodId', sourcePeriodVersion: { $ifNull: ['$sourcePeriodVersion', 1] }, employeeProfileId: '$employeeProfileId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  return result;
}

async function backup(client: MongoClient, suffix: string): Promise<void> {
  const db = client.db();
  for (const name of COLLECTIONS) {
    await db.collection(name).aggregate([{ $match: {} }, { $out: `${name}__lineage_backup_${suffix}` }]).toArray();
  }
}

async function apply(client: MongoClient): Promise<void> {
  const db = client.db();
  const before = await inspect(client);
  const duplicateCount = ['summaryIdentityDuplicates', 'snapshotIdentityDuplicates']
    .reduce((total, key) => total + (before[key] as unknown[]).length, 0);
  if (duplicateCount > 0) throw new Error('DUPLICATE_VERSIONED_IDENTITIES_FOUND');
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '');
  await backup(client, suffix);
  await db.collection('timesheet_summaries').updateMany(
    { schemaVersion: { $exists: false } },
    { $set: { schemaVersion: 1, sourcePeriodVersion: 1, calculationContract: 'LEGACY_WORKING_DAYS_V1' } },
  );
  await db.collection('payroll_input_snapshots').updateMany(
    { schemaVersion: { $exists: false } },
    { $set: { schemaVersion: 1, sourcePeriodVersion: 1, calculationContract: 'LEGACY_WORKING_DAYS_V1' } },
  );
  await db.collection('payroll_runs').updateMany(
    { schemaVersion: { $exists: false } },
    { $set: { schemaVersion: 1, sourcePeriodVersion: 1, runSequence: 1, sourceSnapshotIds: [] } },
  );
  await db.collection('payslips').updateMany(
    { schemaVersion: { $exists: false } },
    { $set: { schemaVersion: 1, sourcePeriodVersion: 1 } },
  );
  await db.collection('timesheet_summaries').createIndex(
    { organizationId: 1, periodId: 1, sourcePeriodVersion: 1, employeeProfileId: 1 },
    { unique: true, name: 'uq_summary_source_version_employee' },
  );
  await db.collection('payroll_input_snapshots').createIndex(
    { organizationId: 1, periodId: 1, sourcePeriodVersion: 1, employeeProfileId: 1 },
    { unique: true, name: 'uq_snapshot_source_version_employee' },
  );
  await db.collection('payroll_runs').createIndex(
    { organizationId: 1, timesheetPeriodId: 1, runSequence: 1 },
    { unique: true, name: 'uq_payroll_run_sequence' },
  );
  const backfillVerified = await inspect(client);
  if (['timesheet_summaries', 'payroll_input_snapshots', 'payroll_runs', 'payslips']
    .some((name) => Number((backfillVerified[name] as { missingSchemaVersion: number }).missingSchemaVersion) !== 0)) {
    throw new Error('LINEAGE_BACKFILL_VERIFICATION_FAILED');
  }
  for (const [collection, index] of [
    ['timesheet_summaries', 'periodId_1_employeeProfileId_1'],
    ['payroll_input_snapshots', 'periodId_1_employeeProfileId_1'],
    ['payroll_runs', 'organizationId_1_timesheetPeriodId_1'],
  ] as const) {
    const names = (await db.collection(collection).indexes()).map((entry) => entry.name);
    if (names.includes(index)) await db.collection(collection).dropIndex(index);
  }
  await db.collection('payroll_runs').createIndex(
    { organizationId: 1, timesheetPeriodId: 1 },
    { unique: true, name: 'uq_one_active_payroll_run', partialFilterExpression: { status: { $in: ['DRAFT', 'CALCULATED', 'LOCKED', 'RELEASED'] } } },
  );
  const finalIndexes = (await db.collection('payroll_runs').indexes()).map((entry) => entry.name);
  if (!finalIndexes.includes('uq_payroll_run_sequence') || !finalIndexes.includes('uq_one_active_payroll_run')) {
    throw new Error('INDEX_CUTOVER_VERIFICATION_FAILED');
  }
}

async function rollback(client: MongoClient): Promise<void> {
  const db = client.db();
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '');
  await backup(client, `pre_rollback_${suffix}`);
  await db.collection('timesheet_summaries').createIndex({ periodId: 1, employeeProfileId: 1 }, { unique: true, name: 'periodId_1_employeeProfileId_1' });
  await db.collection('payroll_input_snapshots').createIndex({ periodId: 1, employeeProfileId: 1 }, { unique: true, name: 'periodId_1_employeeProfileId_1' });
  await db.collection('payroll_runs').createIndex({ organizationId: 1, timesheetPeriodId: 1 }, { unique: true, name: 'organizationId_1_timesheetPeriodId_1' });
  for (const [collection, indexes] of [
    ['timesheet_summaries', ['uq_summary_source_version_employee']],
    ['payroll_input_snapshots', ['uq_snapshot_source_version_employee']],
    ['payroll_runs', ['uq_payroll_run_sequence', 'uq_one_active_payroll_run']],
  ] as const) {
    const names = (await db.collection(collection).indexes()).map((entry) => entry.name);
    for (const index of indexes) if (names.includes(index)) await db.collection(collection).dropIndex(index);
  }
}

async function main(): Promise<void> {
  const options = parseMigrationOptions(process.argv.slice(2));
  const plan = buildMigrationPlan(options);
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI_REQUIRED_FOR_INSPECTION_OR_EXECUTION');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    if (options.mode === 'inspect' || options.mode === 'verify') {
      process.stdout.write(`${JSON.stringify(await inspect(client), null, 2)}\n`);
    } else if (options.mode === 'apply') {
      await apply(client);
    } else {
      await rollback(client);
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
