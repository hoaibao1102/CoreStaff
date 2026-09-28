import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { EnterpriseInsurancePolicySchema } from '../src/database/schemas/enterprise-insurance-policy.schema';
import { EnterpriseInsuranceCostBearer } from '../src/database/schemas/enums';
import { findEffective } from '../src/common/effective-dating';

/**
 * D41 follow-up (2026-09-28). Seeds ONE illustrative EnterpriseInsurancePolicy
 * per organization that doesn't already have an effective one — so the
 * "Bảo hiểm doanh nghiệp" screen isn't empty. Picks the ONE category from the
 * user-supplied classification of "bảo hiểm doanh nghiệp" that actually fits
 * this schema: group accident/health insurance bought FOR EMPLOYEES
 * (voluntary, per Bộ luật Lao động Điều 168 spirit — no law mandates it or
 * sets its rate). The other categories the user listed — bắt buộc xe cơ giới
 * (Nghị định 67/2023/NĐ-CP), cháy nổ bắt buộc, bảo hiểm xây dựng, bảo hiểm
 * trách nhiệm nghề nghiệp theo ngành — insure an ASSET or a LIABILITY, not a
 * per-employee benefit; they don't have a `premiumPerEmployee`/`costBearer`
 * concept and would need a different data model. Out of scope here.
 *
 * `provider`/`premiumPerEmployee` are illustrative placeholders (clearly
 * marked in `note`) — no real vendor or premium has been confirmed. Dry-run
 * by default; pass --apply to write.
 */

const APPLY = process.argv.includes('--apply');

const SEED_NOTE =
	'Seed minh họa (2026-09-28, D41) — bảo hiểm tai nạn/sức khỏe nhóm tự nguyện cho nhân viên, KHÔNG phải số liệu đã xác nhận. ' +
	'HR cần thay bằng nhà cung cấp/mức phí thật của công ty trước khi dùng cho payroll thật.';

function startOfDayUtc(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function main() {
	const env = resolveEnv();
	if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
	const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });

	try {
		await connection.asPromise();
		const Org = connection.model('Organization', OrganizationSchema);
		const EnterpriseInsurancePolicy = connection.model('EnterpriseInsurancePolicy', EnterpriseInsurancePolicySchema);

		const today = startOfDayUtc(new Date());
		const orgs = await Org.find({}).select('_id code name').sort({ code: 1 }).lean();

		let created = 0;
		let skipped = 0;

		for (const org of orgs) {
			const siblings = await EnterpriseInsurancePolicy.find({ organizationId: org._id }).lean();
			const effective = findEffective(siblings, today);
			if (effective) {
				skipped++;
				console.log(`[seed:enterprise-insurance] SKIP (already has an effective policy): org=${org.code}`);
				continue;
			}

			const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));
			const doc = {
				organizationId: org._id,
				effectiveFrom: today,
				provider: 'Bảo Việt',
				coverageDescription: 'Bảo hiểm tai nạn con người 24/24 + chăm sóc sức khỏe cơ bản cho toàn bộ nhân viên chính thức',
				premiumPerEmployee: null,
				costBearer: EnterpriseInsuranceCostBearer.EMPLOYER,
				employeeContributionAmount: null,
				note: SEED_NOTE,
				version: nextVersion,
			};

			console.log(`[seed:enterprise-insurance] ${APPLY ? 'CREATE' : 'would CREATE'}: org=${org.code} (v${nextVersion})`);
			if (APPLY) await EnterpriseInsurancePolicy.create(doc);
			created++;
		}

		console.log(`[seed:enterprise-insurance] mode=${APPLY ? 'apply' : 'dry-run'} TOTAL orgs=${orgs.length} created=${created} skipped=${skipped}`);
		if (!APPLY) console.log('[seed:enterprise-insurance] Dry run only — re-run with --apply to write.');
	} finally {
		await closeConnection(connection);
	}
}

void main().catch((error) => {
	console.error('[seed:enterprise-insurance] failed:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
