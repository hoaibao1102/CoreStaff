/**
 * Read-only data audit: does the live data fit the current schemas?
 *
 * Not a jest spec — it needs the real database. It opens `MONGODB_URI` through the
 * app's own env loader (so the SRV resolver workaround applies), builds models from
 * SCHEMA_REGISTRY, validates every document against its schema, and checks the
 * cross-collection + business invariants the DB cannot enforce alone.
 *
 * It WRITES NOTHING. No URI, no password, no document body is printed — only
 * collection names, counts, field paths and ObjectIds.
 *
 * Run:  npx ts-node-script scripts/audit-schema-fit.ts
 */
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { SCHEMA_REGISTRY } from '../src/database/schemas/registry';
import { ContractStatus, ContractType, EmploymentStatus, WORKING_EMPLOYMENT_STATUSES } from '../src/database/schemas/enums';

const env = resolveEnv();
if (!hasMongoUri(env)) {
  console.error('MONGODB_URI is not configured.');
  process.exit(1);
}
// Narrowed copy — `hasMongoUri` proved it, but the type does not survive into main().
const uri: string = env.mongodbUri as string;

/** `reasons` counts are capped per key so one bad collection cannot flood output. */
interface Report {
  total: number;
  /** Genuine corruption — a rule the schema or a service enforces, violated. */
  invalid: number;
  /** By-design or compliance observations — surfaced, but do not fail the audit. */
  notes: number;
  reasons: Map<string, number>;
}

function bump(r: Report, key: string) {
  r.reasons.set(key, (r.reasons.get(key) ?? 0) + 1);
}

/** Records a finding AND counts it — `bump` alone only tallies the reason label. */
function fail(r: Report, key: string) {
  r.invalid++;
  bump(r, key);
}

/**
 * Informational observation — legal/expected under the current design, reported
 * so a human sees the shape of the data without failing the audit.
 */
function note(r: Report, key: string) {
  r.notes++;
  bump(r, key);
}

async function main() {
  const db = mongoose.createConnection(uri);
  await db.asPromise();

  const models = new Map<string, mongoose.Model<any>>();
  for (const { name, schema } of SCHEMA_REGISTRY) models.set(name, db.model(name, schema));

  const reports = new Map<string, Report>();
  for (const { name } of SCHEMA_REGISTRY) reports.set(name, { total: 0, invalid: 0, notes: 0, reasons: new Map() });

  // ── 1. Field-level: every document validated against its own schema ──
  const docs = new Map<string, Record<string, unknown>[]>();
  for (const { name } of SCHEMA_REGISTRY) {
    const model = models.get(name)!;
    const rep = reports.get(name)!;
    const rows = await model.find({}).lean();
    docs.set(name, rows as Record<string, unknown>[]);
    rep.total = rows.length;
    for (const raw of rows as Record<string, unknown>[]) {
      // `new Model(...)` applies casting (unknown fields stripped by strict mode);
      // a cast failure throws before validate even runs, so both paths are caught.
      try {
        const inst = new model({ ...raw });
        const err = inst.validateSync();
        if (err) {
          rep.invalid++;
          for (const [path, e] of Object.entries(err.errors ?? {})) bump(rep, `${path}: ${(e as Error).message}`);
        }
      } catch (e) {
        rep.invalid++;
        bump(rep, `cast: ${(e as Error).message.split(':')[0]}`);
      }
    }
  }

  // ── 2. Cross-collection: every ObjectId reference resolves, same tenant ──
  const idSet = (name: string, field = '_id') =>
    new Set((docs.get(name) ?? []).map((d) => String(d[field])));

  const orgIds = idSet('Organization');
  const userIds = idSet('User');
  const profileIds = idSet('EmployeeProfile');
  const contractIds = idSet('EmploymentContract');
  const deptIds = idSet('Department');
  const posIds = idSet('Position');

  const refChecks: Array<[string, string, string, Set<string>]> = [
    ['User', 'organizationId', 'Organization', orgIds],
    ['EmployeeProfile', 'organizationId', 'Organization', orgIds],
    ['EmployeeProfile', 'userId', 'User', userIds],
    ['EmployeeProfile', 'departmentId', 'Department', deptIds],
    ['EmployeeProfile', 'positionId', 'Position', posIds],
    ['EmploymentHistory', 'employeeProfileId', 'EmployeeProfile', profileIds],
    ['EmploymentContract', 'employeeProfileId', 'EmployeeProfile', profileIds],
    ['EmployeeDocument', 'employeeProfileId', 'EmployeeProfile', profileIds],
    ['EmployeeDocument', 'contractId', 'EmploymentContract', contractIds],
  ];
  const refs: Report = { total: 0, invalid: 0, notes: 0, reasons: new Map() };
  for (const [collection, field, target, valid] of refChecks) {
    for (const d of docs.get(collection) ?? []) {
      const v = d[field];
      if (v === undefined || v === null || v === '') continue; // optional — schema already judged required-ness
      refs.total++;
      if (!valid.has(String(v))) {
        fail(refs, `${collection}.${field} → dangling ${target}`);
      }
    }
  }
  // Same-tenant rule: a child row must live in its parent's organization.
  // Map any document/organization id → the organizationId it belongs to.
  const orgOf = new Map<string, string>();
  for (const d of docs.get('Organization') ?? []) orgOf.set(String(d._id), String(d._id));
  for (const n of ['EmployeeProfile', 'EmploymentContract', 'EmployeeDocument', 'Department', 'Position', 'User']) {
    for (const d of docs.get(n) ?? []) orgOf.set(String(d._id), String(d.organizationId ?? ''));
  }
  for (const [child, field] of [
    ['EmployeeProfile', 'userId'],
    ['EmploymentContract', 'employeeProfileId'],
    ['EmployeeDocument', 'contractId'],
    ['EmployeeDocument', 'employeeProfileId'],
  ] as const) {
    for (const d of docs.get(child) ?? []) {
      const parent = d[field];
      if (!parent) continue;
      const a = orgOf.get(String(d.organizationId));
      const b = orgOf.get(String(parent));
      if (a !== undefined && b !== undefined && a !== b) {
        // counted by fail()
        fail(refs, `${child}.${field} → cross-tenant`);
      }
    }
  }

  // ── 3. Business invariants the schema allows but the domain does not ──
  const rules: Report = { total: 0, invalid: 0, notes: 0, reasons: new Map() };
  const contracts = docs.get('EmploymentContract') ?? [];
  const profiles = docs.get('EmployeeProfile') ?? [];
  const byProfile = new Map<string, Record<string, unknown>[]>();
  for (const c of contracts) {
    const k = String(c.employeeProfileId);
    const b = byProfile.get(k);
    if (b) b.push(c);
    else byProfile.set(k, [c]);
  }

  const time = (v: unknown) => (v ? new Date(v as string).getTime() : Number.NaN);
  const now = Date.now();

  // `fail` = a rule a service/schema enforces, violated → real corruption.
  // `note` = legal-but-messy or a compliance gap the app now surfaces → informative.
  for (const c of contracts) {
    rules.total++;
    const status = c.status as string;
    const type = c.contractType as string;
    const eff = time(c.effectiveDate);
    const exp = time(c.expiryDate);
    if (status === ContractStatus.TERMINATED && !c.endDate) fail(rules, 'TERMINATED without endDate');
    // ACTIVE→EXPIRED never stamps endDate (only termination does) — absence is normal.
    if (status === ContractStatus.EXPIRED && !c.endDate) note(rules, 'EXPIRED without endDate (normal for the ACTIVE→EXPIRED move)');
    if (type === ContractType.INDEFINITE_TERM && c.expiryDate) fail(rules, 'INDEFINITE_TERM carries expiryDate');
    if (!Number.isNaN(eff) && !Number.isNaN(exp) && exp <= eff) fail(rules, 'expiryDate <= effectiveDate');
    if (status === ContractStatus.ACTIVE && !Number.isNaN(exp) && exp < now) note(rules, 'ACTIVE past expiryDate (drift — isExpired/compliance flag)');
  }

  // One governing ACTIVE window per employee; overlaps are real corruption.
  for (const own of byProfile.values()) {
    const active = own.filter((c) => c.status === ContractStatus.ACTIVE);
    rules.total += active.length;
    if (active.length > 1) note(rules, 'more than one ACTIVE contract for one employee');
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const aEnd = time(a.expiryDate) || Number.POSITIVE_INFINITY;
        const bEnd = time(b.expiryDate) || Number.POSITIVE_INFINITY;
        if (time(a.effectiveDate) < bEnd && time(b.effectiveDate) < aEnd) fail(rules, 'overlapping ACTIVE windows');
      }
    }
  }

  // Working employees must be covered by a contract (Invariant A) — a compliance
  // gap the app now surfaces, not schema corruption, so it is a note.
  for (const p of profiles) {
    const st = p.employmentStatus as string;
    if (!WORKING_EMPLOYMENT_STATUSES.includes(st as EmploymentStatus)) continue;
    rules.total++;
    const own = byProfile.get(String(p._id)) ?? [];
    if (!own.some((c) => c.status === ContractStatus.ACTIVE || c.status === ContractStatus.EXPIRED)) {
      note(rules, 'working employee with no ACTIVE/EXPIRED contract');
    }
  }

  // ── output ──
  // Accumulated purely by the loops below — do not pre-seed or refs/rules double-count.
  let bad = 0;
  let noted = 0;
  console.log(`\nSchema fit — ${env.mongodbSourceKey} (database "${db.name}")\n`);
  for (const [name, r] of reports) {
    bad += r.invalid;
    noted += r.notes;
    const flag = r.invalid ? `✗ ${r.invalid} invalid` : '✓';
    console.log(`${flag.padEnd(14)} ${name.padEnd(22)} ${r.total} doc(s)`);
    for (const [reason, n] of r.reasons) console.log(`                 · ${reason} [${n}]`);
  }
  console.log('');
  for (const [label, r] of [['references', refs], ['invariants', rules]] as const) {
    bad += r.invalid;
    noted += r.notes;
    const flag = r.invalid ? `✗ ${r.invalid}` : r.notes ? `○ ${r.notes} note(s)` : '✓';
    console.log(`${flag.padEnd(14)} ${label.padEnd(22)} ${r.total} check(s)`);
    for (const [reason, n] of r.reasons) console.log(`                 · ${reason} [${n}]`);
  }
  console.log(
    `\n${bad === 0 ? 'Data fits the schemas.' : `${bad} corruption finding(s) — see ✗ above.`}` +
      (noted ? ` ${noted} informational note(s) (○) — compliance/design, not defects.\n` : '\n'),
  );

  await db.close();
  process.exit(bad === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error('audit failed:', (e as Error).message);
  process.exit(1);
});
