import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaxPolicy } from '../../database/schemas/tax-policy.schema';
import { CreateTaxPolicyDto } from '../policies/dto/create-tax-policy.dto';
import { UpdateTaxPolicyDto } from '../policies/dto/update-tax-policy.dto';
import { calculatePIT, PitCalculationParams, RoundingRule } from '../policies/tax-policy-domain';

const date = (v: string | Date) => (v instanceof Date ? v : new Date(v));

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

	async effectiveAt(org: string, at: string | Date): Promise<TaxPolicy | null> {
		const targetDate = date(at);
		return this.taxPolicies
			.findOne({
				organizationId: org,
				active: true,
				effectiveFrom: { $lte: targetDate },
				$or: [{ effectiveTo: null }, { effectiveTo: { $gt: targetDate } }],
			})
			.sort({ effectiveFrom: -1 })
			.lean();
	}

	// ── Create a new TaxPolicy version ──────────────────────────────────────

	async create(org: string, dto: CreateTaxPolicyDto) {
		const effectiveFrom = date(dto.effectiveFrom);
		const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;

		// Validate no overlapping effective windows
		await this.assertNoOverlap(org, effectiveFrom, effectiveTo);

		// Auto-increment version
		const latest = await this.taxPolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
		const nextVersion = latest ? latest.version + 1 : 1;

		const roundingRule = dto.roundingRule ?? 'ROUND_HALF_UP_TO_VND';

		const row = await this.taxPolicies.create({
			...dto,
			organizationId: org,
			effectiveFrom,
			effectiveTo,
			version: nextVersion,
			active: true,
			progressiveBrackets: dto.progressiveBrackets.map((b) => ({
				upperLimit: b.upperLimit,
				rate: b.rate,
			})),
			roundingRule,
		});

		return row.toObject();
	}

	// ── Update an existing TaxPolicy (creates new version) ──────────────────

	async update(org: string, policyId: string, dto: UpdateTaxPolicyDto) {
		const existing = await this.taxPolicies.findById(policyId).lean();
		if (!existing || existing.organizationId !== org) {
			throw new NotFoundException('TAX_POLICY_NOT_FOUND');
		}

		// Deactivate the old policy
		await this.taxPolicies.findByIdAndUpdate(policyId, { active: false });

		// Create new version
		const effectiveFrom = dto.effectiveFrom ? date(dto.effectiveFrom) : new Date();
		const effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;

		await this.assertNoOverlap(org, effectiveFrom, effectiveTo);

		const latest = await this.taxPolicies.findOne({ organizationId: org }).sort({ version: -1 }).lean();
		const nextVersion = latest ? latest.version + 1 : 1;

		const roundingRule = dto.roundingRule ?? existing.roundingRule ?? 'ROUND_HALF_UP_TO_VND';

		const row = await this.taxPolicies.create({
			organizationId: org,
			effectiveFrom,
			effectiveTo,
			personalDeduction: dto.personalDeduction ?? existing.personalDeduction,
			dependentDeduction: dto.dependentDeduction ?? existing.dependentDeduction,
			progressiveBrackets: dto.progressiveBrackets?.map((b) => ({
				upperLimit: b.upperLimit,
				rate: b.rate,
			})) ?? existing.progressiveBrackets,
			roundingRule,
			legalReference: dto.legalReference ?? existing.legalReference,
			version: nextVersion,
			active: true,
		});

		return row.toObject();
	}

	// ── Helper: assert no overlapping effective windows ─────────────────────

	private async assertNoOverlap(org: string, effectiveFrom: Date, effectiveTo: Date | undefined): Promise<void> {
		const overlapping = await this.taxPolicies.findOne({
			organizationId: org,
			active: true,
			effectiveFrom: { $lte: effectiveTo ?? new Date('9999-12-31') },
			$or: [
				{ effectiveTo: null },
				{ effectiveTo: { $gt: effectiveFrom } },
			],
		}).lean();

		if (overlapping) {
			throw new NotFoundException('TAX_POLICY_OVERLAPS_EXISTING');
		}
	}
}
