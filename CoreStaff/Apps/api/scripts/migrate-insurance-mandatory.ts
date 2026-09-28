import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { EmployeeProfileSchema } from '../src/database/schemas/employee-profile.schema';
import { InsuranceProfileSchema } from '../src/database/schemas/insurance-profile.schema';
import { WORKING_EMPLOYMENT_STATUSES } from '../src/database/schemas/enums';
import { rangesOverlap, findEffective } from '../src/common/effective-dating';

/**
 * D40 (2026-09-28) follow-up. `InsuranceProfile.participates*` now defaults
 * `true` for records created going forward — this script is the one-off
 * correction for records that already exist in the database (created back
 * when the default was `false`/HR-chosen), plus employees who never got an
 * InsuranceProfile at all. Dry-run by default; pass --apply to write.
 *
 * Why this can't just call InsuranceProfileService.create(): that service
 * rejects any new period overlapping an existing one, and an existing
 * open-ended record (no effectiveTo) overlaps every possible future period —
 * so a non-compliant open-ended record can never be "corrected" through the
 * normal API. This script closes such a record (sets effectiveTo = ngày hôm
 * trước) directly on the collection before inserting the compliant version.
 *
 * D42 (2026-09-28) later added `PATCH .../:id/close` precisely for this gap —
 * for a ONE-OFF correction, use that endpoint (or the "Kết thúc hiệu lực"
 * button in the web UI) instead of a script. This script stays useful for a
 * bulk pass across every employee/org at once, which the UI has no batch form
 * for.
 */

const APPLY = process.argv.includes('--apply');
const MIGRATION_NOTE = 'Migration 2026-09-28 (D40): chuyển sang bắt buộc BHXH/BHYT/BHTN theo luật lao động hiện hành.';

function startOfDayUtc(d: Date): Date {
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function dayBefore(d: Date): Date {
	return new Date(d.getTime() - 24 * 60 * 60 * 1000);
}
function isFullyMandatory(row: { participatesSocialInsurance: boolean; participatesHealthInsurance: boolean; participatesUnemploymentInsurance: boolean }): boolean {
	return row.participatesSocialInsurance && row.participatesHealthInsurance && row.participatesUnemploymentInsurance;
}

interface Counters {
	alreadyCompliant: number;
	createdInitial: number;
	correctedWithNewVersion: number;
	skippedFutureRecord: number;
	skippedNotWorking: number;
}

async function main() {
	const env = resolveEnv();
	if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');
	const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });

	try {
		await connection.asPromise();
		const Org = connection.model('Organization', OrganizationSchema);
		const Profile = connection.model('EmployeeProfile', EmployeeProfileSchema);
		const InsuranceProfile = connection.model('InsuranceProfile', InsuranceProfileSchema);

		const today = startOfDayUtc(new Date());
		const yesterday = dayBefore(today);

		const orgs = await Org.find({}).select('_id code name').sort({ code: 1 }).lean();
		const totals: Counters = { alreadyCompliant: 0, createdInitial: 0, correctedWithNewVersion: 0, skippedFutureRecord: 0, skippedNotWorking: 0 };

		for (const org of orgs) {
			const employees = await Profile.find({ organizationId: org._id }).select('_id employeeCode fullName employmentStatus').lean();
			const perOrg: Counters = { alreadyCompliant: 0, createdInitial: 0, correctedWithNewVersion: 0, skippedFutureRecord: 0, skippedNotWorking: 0 };

			for (const employee of employees) {
				if (!WORKING_EMPLOYMENT_STATUSES.includes(employee.employmentStatus)) {
					perOrg.skippedNotWorking++;
					continue;
				}

				const siblings = await InsuranceProfile.find({ organizationId: org._id, employeeId: employee._id }).lean();
				// Strictly AFTER today — a record starting today is today's effective record, not "future".
				const futureRecord = siblings.find((row) => new Date(row.effectiveFrom).getTime() > today.getTime());
				if (futureRecord) {
					// A record already scheduled to start today/later — don't guess at its intent, leave for manual review.
					perOrg.skippedFutureRecord++;
					console.warn(`[migrate:insurance-mandatory] SKIP (future-dated record exists): org=${org.code} employee=${employee.employeeCode}`);
					continue;
				}

				const effective = findEffective(siblings, today);
				if (effective && isFullyMandatory(effective)) {
					perOrg.alreadyCompliant++;
					continue;
				}

				const nextVersion = 1 + Math.max(0, ...siblings.map((row) => row.version ?? 0));
				const newDoc = {
					organizationId: org._id,
					employeeId: employee._id,
					effectiveFrom: today,
					participatesSocialInsurance: true,
					participatesHealthInsurance: true,
					participatesUnemploymentInsurance: true,
					note: MIGRATION_NOTE,
					version: nextVersion,
				};

				if (effective) {
					// Sanity check: the close date must land strictly before `today`, and must not
					// re-open overlap with any OTHER sibling (shouldn't happen if siblings were
					// already non-overlapping, but verify rather than assume).
					const closedRange = { effectiveFrom: effective.effectiveFrom, effectiveTo: yesterday };
					const reopensOverlap = siblings.some((row) => String(row._id) !== String(effective._id) && rangesOverlap(closedRange, row));
					if (yesterday.getTime() < new Date(effective.effectiveFrom).getTime() || reopensOverlap) {
						perOrg.skippedFutureRecord++;
						console.warn(`[migrate:insurance-mandatory] SKIP (cannot safely close current record): org=${org.code} employee=${employee.employeeCode}`);
						continue;
					}
					console.log(`[migrate:insurance-mandatory] ${APPLY ? 'CLOSE+CORRECT' : 'would CLOSE+CORRECT'}: org=${org.code} employee=${employee.employeeCode} (v${effective.version} -> v${nextVersion})`);
					if (APPLY) {
						await InsuranceProfile.updateOne({ _id: effective._id }, { $set: { effectiveTo: yesterday } });
						await InsuranceProfile.create(newDoc);
					}
					perOrg.correctedWithNewVersion++;
				} else {
					console.log(`[migrate:insurance-mandatory] ${APPLY ? 'CREATE' : 'would CREATE'}: org=${org.code} employee=${employee.employeeCode} (v${nextVersion})`);
					if (APPLY) await InsuranceProfile.create(newDoc);
					perOrg.createdInitial++;
				}
			}

			console.log(`[migrate:insurance-mandatory] org=${org.code} employees=${employees.length} alreadyCompliant=${perOrg.alreadyCompliant} createdInitial=${perOrg.createdInitial} correctedWithNewVersion=${perOrg.correctedWithNewVersion} skippedFutureOrUnsafe=${perOrg.skippedFutureRecord} skippedNotWorking=${perOrg.skippedNotWorking}`);
			for (const key of Object.keys(totals) as Array<keyof Counters>) totals[key] += perOrg[key];
		}

		console.log(`[migrate:insurance-mandatory] mode=${APPLY ? 'apply' : 'dry-run'} TOTAL orgs=${orgs.length} alreadyCompliant=${totals.alreadyCompliant} createdInitial=${totals.createdInitial} correctedWithNewVersion=${totals.correctedWithNewVersion} skippedFutureOrUnsafe=${totals.skippedFutureRecord} skippedNotWorking=${totals.skippedNotWorking}`);
		if (!APPLY) console.log('[migrate:insurance-mandatory] Dry run only — re-run with --apply to write.');
	} finally {
		await closeConnection(connection);
	}
}

void main().catch((error) => {
	console.error('[migrate:insurance-mandatory] failed:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
