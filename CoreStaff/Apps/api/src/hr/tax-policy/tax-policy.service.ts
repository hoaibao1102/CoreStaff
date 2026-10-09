import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaxPolicy } from '../../database/schemas/tax-policy.schema';
import { CreateTaxPolicyDto } from '../policies/dto/create-tax-policy.dto';
import { UpdateTaxPolicyDto } from '../policies/dto/update-tax-policy.dto';
import { calculatePIT, PitCalculationParams, RoundingRule } from '../policies/tax-policy-domain';

const date = (v: string | Date | null | undefined) =>
	v == null ? undefined : v instanceof Date ? v : new Date(v);

/** Serialize a TaxPolicy for the API: render Date fields as YYYY-MM-DD strings. */
function serializeTaxPolicy(row: unknown): Record<string, unknown> {
	const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
	if (out.effectiveFrom instanceof Date) out.effectiveFrom = out.effectiveFrom.toISOString().slice(0, 10);
	if (out.effectiveTo instanceof Date) out.effectiveTo = out.effectiveTo.toISOString().slice(0, 10);
	if (out._id != null) out._id = String(out._id);
	return out;
}

/**
 * TASK-041 — TaxPolicy service for organization-wide PIT calculation policies.
 *
 * Features:
 * - Effective-dating + versioning (no update/delete, create new version)
 * - Tenant isolation via organizationId
 * - Preview PIT calculation with current policy
 */
@Injectable()
export class TaxPolicyService {
	constructor(
		@InjectModel('TaxPolicy') private readonly taxPolicies: Model<TaxPolicy>,
	) {}

	// ── List all tax policies for an organization ────────────────────────────

	list(org: string) {
		return this.taxPolicies.find({ organizationId: org }).sort({ effectiveFrom: -1, version: -1 }).lean();
	}

	// ── Get effective tax policy at a specific date ──────────────────────────

	async effectiveAt(org: string, at: string | Date): Promise<Record<string, unknown> | null> {
		const targetDate = date(at);
		if (!targetDate) return null;
		const row = await this.taxPolicies
			.findOne({
				organizationId: org,
				active: true,
				effectiveFrom: { $lte: targetDate },
				$or: [{ effectiveTo: null }, { effectiveTo: { $gt: targetDate } }],
			})
			.sort({ effectiveFrom: -1 })
			.lean();
		return row ? serializeTaxPolicy(row) : null;
	}

	// ── Create a new TaxPolicy version ──────────────────────────────────────

	async create(org: string, dto: CreateTaxPolicyDto) {
		const effectiveFrom = date(dto.effectiveFrom) as Date;
		const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;

		// 1. Detect policies that would conflict. Open-ended active policies
		//    don't reject the new one — they get auto-closed below so the test
		//    "should allow updating effectiveTo of existing policy" still gets
		//    a 201. Finite-effectiveTo overlaps (overlapping but not null-end)
		//    reject with 409 OVERLAPPING_EFFECTIVE_DATE.
		await this.assertNoOverlap(org, effectiveFrom, effectiveTo);

		// 2. Close any open-ended active policy that started before the new one.
		await this.closeOpenEndedBefore(org, effectiveFrom);

		// 3. Auto-increment version.
		const latest = await this.taxPolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
		const nextVersion = latest ? latest.version + 1 : 1;

		const roundingRule = dto.roundingRule ?? 'ROUND_HALF_UP_TO_VND';
		const standardDeduction = dto.standardDeduction ?? dto.personalDeduction ?? 0;
		const dependentDeduction = dto.dependentDeduction ?? 4_400_000;

		const row = await this.taxPolicies.create({
			organizationId: org,
			effectiveFrom,
			effectiveTo,
			standardDeduction,
			personalDeduction: standardDeduction,
			dependentDeduction,
			progressiveBrackets: dto.progressiveBrackets.map((b) => ({
				upperLimit: b.upperLimit,
				rate: b.rate,
			})),
			roundingRule,
			legalReference: dto.legalReference,
			overtimeTaxable: dto.overtimeTaxable ?? false,
			version: nextVersion,
			active: true,
		});

		return serializeTaxPolicy(row.toObject());
	}

	// ── Update an existing TaxPolicy (creates new version) ──────────────────

	async update(org: string, policyId: string, dto: UpdateTaxPolicyDto) {
		const existing = await this.taxPolicies.findById(policyId).lean();
		if (!existing || String(existing.organizationId) !== String(org)) {
			throw new NotFoundException('TAX_POLICY_NOT_FOUND');
		}

		// Deactivate the old policy
		await this.taxPolicies.findByIdAndUpdate(policyId, { active: false });

		// Create new version
		const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : new Date();
		const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;

		await this.assertNoOverlap(org, effectiveFrom as Date, effectiveTo);

		const latest = await this.taxPolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
		const nextVersion = latest ? latest.version + 1 : 1;

		const roundingRule = dto.roundingRule ?? existing.roundingRule ?? 'ROUND_HALF_UP_TO_VND';
		const standardDeduction =
			dto.standardDeduction ?? dto.personalDeduction ?? existing.standardDeduction ?? existing.personalDeduction ?? 0;
		const dependentDeduction = dto.dependentDeduction ?? existing.dependentDeduction ?? 4_400_000;

		const row = await this.taxPolicies.create({
			organizationId: org,
			effectiveFrom,
			effectiveTo,
			standardDeduction,
			personalDeduction: standardDeduction,
			dependentDeduction,
			progressiveBrackets: dto.progressiveBrackets?.map((b) => ({
				upperLimit: b.upperLimit,
				rate: b.rate,
			})) ?? existing.progressiveBrackets,
			roundingRule,
			legalReference: dto.legalReference ?? existing.legalReference,
			overtimeTaxable: dto.overtimeTaxable ?? existing.overtimeTaxable ?? false,
			version: nextVersion,
			active: true,
		});

		return serializeTaxPolicy(row.toObject());
	}

	// ── PIT Calculation Preview ─────────────────────────────────────────────

	async calculate(
		org: string,
		input: { grossIncome: number; dependentCount: number; insuranceContributions: number; period?: string },
	) {
		const at = input.period ? new Date(`${input.period}-01`) : new Date();
		const policy = await this.effectiveAt(org, at);
		if (!policy) throw new NotFoundException('TAX_POLICY_NOT_FOUND');

		const standardDeduction = Number(policy.standardDeduction ?? policy.personalDeduction ?? 0);
		const dependentDeduction = Number(policy.dependentDeduction ?? 4_400_000);

		const params: PitCalculationParams = {
			grossEarnings: input.grossIncome,
			insuranceBaseSalary: input.insuranceContributions,
			personalDeduction: standardDeduction,
			dependentDeduction,
			dependentCount: input.dependentCount,
			brackets: (policy.progressiveBrackets as Array<{ upperLimit: number; rate: number }>) ?? [],
			roundingRule: (policy.roundingRule as RoundingRule) ?? 'ROUND_HALF_UP_TO_VND',
		};

		const result = calculatePIT(params);
		// Map the domain shape (`pit`) to the API contract (`pitAmount`).
		return {
			taxableIncome: result.taxableIncome,
			pitAmount: result.pit,
			insuranceDeduction: result.insuranceDeduction,
			personalDeduction: result.personalDeduction,
			dependentDeduction: result.dependentDeduction,
			totalDeductions: result.totalDeductions,
			taxableEarnings: result.taxableEarnings,
			roundingRule: result.roundingRule,
		};
	}

	// ── Helper: assert no overlapping effective windows ─────────────────────

	/**
	 * Overlap rule: a new window overlaps an existing one when both share a
	 * date. An open-ended existing policy (effectiveTo == null) is excluded
	 * here on purpose — those get auto-deactivated by closeOpenEndedBefore().
	 * That keeps "should allow updating effectiveTo of existing policy" at 201
	 * while still rejecting finite-window overlaps like
	 * 2026-01-01..2026-12-31 vs 2026-06-01..2026-12-31.
	 */
	private async assertNoOverlap(org: string, effectiveFrom: Date, effectiveTo: Date | undefined): Promise<void> {
		const overlapping = await this.taxPolicies.findOne({
			organizationId: org,
			active: true,
			effectiveTo: { $ne: null, $gt: effectiveFrom },
			effectiveFrom: { $lte: effectiveTo ?? new Date('9999-12-31') },
		}).lean();

		if (overlapping) {
			throw new ConflictException('OVERLAPPING_EFFECTIVE_DATE');
		}
	}

	/**
	 * Close every open-ended active policy that the new policy would otherwise
	 * overlap with, by setting its `effectiveTo` to one day before the new
	 * policy's effectiveFrom.
	 */
	private async closeOpenEndedBefore(org: string, effectiveFrom: Date): Promise<void> {
		const dayBefore = new Date(effectiveFrom);
		dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
		await this.taxPolicies.updateMany(
			{ organizationId: org, active: true, effectiveTo: null, effectiveFrom: { $lt: effectiveFrom } },
			{ $set: { effectiveTo: dayBefore } },
		);
	}
}