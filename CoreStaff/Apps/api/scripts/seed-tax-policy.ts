import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { TaxPolicySchema } from '../src/database/schemas/tax-policy.schema';

const APPLY = process.argv.includes('--apply');

/** Vietnam 5-tier progressive tax brackets (updated 2026) */
const TAX_BRACKETS_V2 = [
	{ upperLimit: 10_000_000, rate: 5 },
	{ upperLimit: 30_000_000, rate: 10 },
	{ upperLimit: 60_000_000, rate: 20 },
	{ upperLimit: 100_000_000, rate: 30 },
	{ upperLimit: Infinity, rate: 35 },
];

interface Summary { planned: number; created: number; skipped: number }
const summary = new Map<string, Summary>();
function mark(kind: string, result: 'planned' | 'created' | 'skipped') {
	const row = summary.get(kind) ?? { planned: 0, created: 0, skipped: 0 };
	row[result]++;
	summary.set(kind, row);
}

async function insertIfMissing(model: mongoose.Model<any>, query: Record<string, unknown>, doc: Record<string, unknown>, kind: string) {
	const exists = await model.exists(query);
	if (exists) { mark(kind, 'skipped'); return exists._id; }
	if (!APPLY) { mark(kind, 'planned'); return new mongoose.Types.ObjectId(); }
	const created = await model.create(doc);
	mark(kind, 'created');
	return created._id;
}

async function main() {
	const env = resolveEnv();
	if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured');
	const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });
	await db.asPromise();

	const Org = db.model('Organization', OrganizationSchema);
	const TaxPolicy = db.model('TaxPolicy', TaxPolicySchema);

	// Find default organization
	const org = await Org.findOne({}).lean();
	if (!org) {
		console.error('❌ No Organization found. Run seed-data.ts first.');
		process.exit(1);
	}
	const orgId = org._id.toString();

	console.log(`🌐 Seeding TaxPolicy for Organization: ${orgId}`);

	// ── Seed TaxPolicy ─────────────────────────────────────────────────────

	console.log('\n📋 Seeding TaxPolicy v2 (updated brackets)...');
	const taxPolicyDoc = {
		organizationId: orgId,
		effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
		personalDeduction: 15500000, // Giảm trừ bản thân: 15.5tr
		dependentDeduction: 6200000, // Giảm trừ/người phụ thuộc: 6.2tr
		progressiveBrackets: TAX_BRACKETS_V2,
		roundingRule: 'ROUND_HALF_UP_TO_VND',
		legalReference: 'Luật Thuế TNCN 200/QH12; Nghị định 126/2023/NĐ-CP',
		version: 2,
		active: true,
	};

	const policyId = await insertIfMissing(TaxPolicy, { organizationId: orgId, version: 2 }, taxPolicyDoc, 'TaxPolicy');
	console.log(`   ✓ TaxPolicy v2: ${TAX_BRACKETS_V2.length} bậc, giảm trừ ${taxPolicyDoc.personalDeduction.toLocaleString()} VND/bản thân, ${taxPolicyDoc.dependentDeduction.toLocaleString()} VND/phụ thuộc`);

	// ── Summary ────────────────────────────────────────────────────────────

	console.log('\n📊 Summary:');
	for (const [kind, stats] of summary.entries()) {
		console.log(`   ${kind}: planned=${stats.planned}, created=${stats.created}, skipped=${stats.skipped}`);
	}

	if (!APPLY) {
		console.log('\n⚠️  DRY RUN — Add --apply to create records.');
	} else {
		console.log('\n✅ TaxPolicy seeding complete!');
	}

	await db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
