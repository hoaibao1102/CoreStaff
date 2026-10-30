import {
  APPLY_OPT_IN,
  buildMigrationPlan,
  parseMigrationOptions,
} from '../../../scripts/migrate-payroll-artifact-lineage';

describe('payroll artifact lineage migration safety', () => {
  it('defaults to inspection-only dry-run without requiring database configuration', () => {
    expect(parseMigrationOptions([])).toEqual({ mode: 'inspect', applyOptIn: false });
    const plan = buildMigrationPlan({ mode: 'inspect', applyOptIn: false });
    expect(plan.readOnly).toBe(true);
    expect(plan.operations.every((operation) => operation.kind === 'inspect')).toBe(true);
  });

  it('refuses apply without the exact future opt-in token', () => {
    expect(() => parseMigrationOptions(['--mode=apply'])).toThrow('APPLY_OPT_IN_REQUIRED');
    expect(() => parseMigrationOptions(['--mode=apply', '--allow-apply=wrong'])).toThrow(
      'APPLY_OPT_IN_REQUIRED',
    );
    expect(parseMigrationOptions(['--mode=apply', `--allow-apply=${APPLY_OPT_IN}`])).toEqual({
      mode: 'apply',
      applyOptIn: true,
    });
  });

  it('plans inventory, backups, legacy compatibility backfill and staged index replacement', () => {
    const plan = buildMigrationPlan({ mode: 'apply', applyOptIn: true });
    expect(plan.operations.map((operation) => operation.id)).toEqual([
      'inventory-legacy-and-duplicates',
      'backup-affected-collections',
      'backfill-explicit-legacy-contract',
      'create-versioned-history-indexes',
      'verify-backfill-before-index-cutover',
      'drop-conflicting-legacy-indexes',
      'create-one-active-run-index',
      'verify-lineage-and-indexes',
    ]);
    expect(plan.operations.find((operation) => operation.id === 'drop-conflicting-legacy-indexes')?.blockedBy)
      .toEqual(['verify-backfill-before-index-cutover']);
    expect(plan.operations.find((operation) => operation.id === 'create-one-active-run-index')?.blockedBy)
      .toEqual(['drop-conflicting-legacy-indexes']);
  });

  it('keeps verify read-only and makes rollback an explicit opted-in mode', () => {
    expect(buildMigrationPlan({ mode: 'verify', applyOptIn: false }).readOnly).toBe(true);
    expect(() => parseMigrationOptions(['--mode=rollback'])).toThrow('APPLY_OPT_IN_REQUIRED');
  });
});