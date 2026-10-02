import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { POSITIONS } from '../src/database/seed/seed-data';

/**
 * One-shot backfill for the "position belongs to a department" change (no migration
 * framework in this repo). For every position without a departmentId, in order:
 *   1. the department most of its current holders belong to (from employee_profiles);
 *   2. the department from the seed catalog for that position code (e.g. DLEAD → ENG);
 *   3. the department whose code/name the position code/name mentions (e.g. HRBP → HR);
 *   4. otherwise the position is orphaned → deactivate so it drops out of the UI.
 * Also drops the old tenant-wide unique index `organizationId_1_code_1` on `positions`
 * so the new `{organizationId, departmentId, code}` index can be created by ensure-indexes.
 *
 * Run dry first:  npm run backfill:position-dept
 * Then apply:     npm run backfill:position-dept -- --apply
 */
async function main() {
	const env = resolveEnv();
	if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
	const apply = process.argv.includes('--apply');
	const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15000 });
	try {
		await connection.asPromise();
		const db = connection.db;
		if (!db) throw new Error('Mongo database unavailable.');
		const positions = db.collection('positions');
		const profiles = db.collection('employee_profiles');
		const departments = db.collection('departments');

		// Seed catalog maps a position code to its department code (org-independent).
		const seedDeptByCode = new Map(POSITIONS.map(row => [row.code.toUpperCase(), row.departmentCode]));

		const rows = await positions.find({ departmentId: { $in: [null, undefined] } }).toArray();
		const changes: Array<{ id: mongoose.Types.ObjectId; code: string; departmentId?: unknown; active: boolean; via: string }> = [];
		for (const position of rows) {
			const depts = await departments.find({ organizationId: position.organizationId }).toArray();
			const deptByCode = new Map(depts.map(dept => [String(dept.code).toUpperCase(), dept._id]));

			let departmentId: unknown;
			let via = '';
			// 1. Department most of this position's holders belong to.
			const holders = await profiles
				.find({ positionId: position._id, departmentId: { $exists: true, $ne: null } })
				.project({ departmentId: 1 })
				.toArray();
			if (holders.length) {
				const tally = new Map<string, { id: unknown; count: number }>();
				for (const holder of holders) {
					const key = String(holder.departmentId);
					const entry = tally.get(key) ?? { id: holder.departmentId, count: 0 };
					entry.count += 1;
					tally.set(key, entry);
				}
				departmentId = [...tally.values()].sort((a, b) => b.count - a.count)[0]?.id;
				if (departmentId) via = 'holders';
			}
			// 2. Seed catalog lookup by position code.
			if (!departmentId) {
				const seedCode = seedDeptByCode.get(String(position.code).toUpperCase());
				const mapped = seedCode ? deptByCode.get(seedCode.toUpperCase()) : undefined;
				if (mapped) { departmentId = mapped; via = 'seed'; }
			}
			// 3. Department whose code/name the position code/name mentions.
			if (!departmentId) {
				const haystack = `${position.code} ${position.name}`.toUpperCase();
				const hit = depts.find(dept => {
					const code = String(dept.code).toUpperCase();
					const name = String(dept.name).toUpperCase();
					return haystack.includes(code) || haystack.includes(name);
				});
				if (hit) { departmentId = hit._id; via = 'name-match'; }
			}
			changes.push({ id: position._id, code: String(position.code), departmentId, active: !!departmentId, via: via || 'orphan' });
		}

		const orphaned = changes.filter(c => !c.active).length;
		console.log(`[backfill:position-dept] mode=${apply ? 'apply' : 'dry-run'} legacyPositions=${rows.length} assigned=${changes.length - orphaned} orphanedDeactivated=${orphaned}`);
		for (const change of changes) console.log(`  ${change.active ? 'ASSIGN' : 'ORPHAN'} ${change.code} via=${change.via}`);
		if (apply) {
			const indexNames = (await positions.indexes()).map(index => index.name);
			for (const legacy of ['organizationId_1_code_1']) {
				if (indexNames.includes(legacy)) await positions.dropIndex(legacy);
			}
			for (const change of changes) {
				if (change.departmentId) {
					await positions.updateOne({ _id: change.id }, { $set: { departmentId: change.departmentId } });
				} else {
					await positions.updateOne({ _id: change.id }, { $set: { active: false } });
				}
			}
			console.log('[backfill:position-dept] applied; run `npm run ensure-indexes` to build the new unique index.');
		}
	} finally {
		await closeConnection(connection);
	}
}
void main().catch(error => { console.error('[backfill:position-dept] failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
