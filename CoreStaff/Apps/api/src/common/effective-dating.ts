/**
 * Shared helpers for entities versioned by an effective-date range
 * (SalaryProfile, InsuranceProfile, InsurancePolicy — SRS §30D pattern:
 * "effectiveFrom, effectiveTo, version"). Not itself named in the SRS; this is
 * the engineering primitive needed to resolve "the row in effect on date X"
 * uniquely (TASK-042 "Policy audit/version/effective-date tests").
 */

export interface EffectiveRange {
	effectiveFrom: Date | string;
	effectiveTo?: Date | string | null;
}

/** True when [aFrom, aTo) and [bFrom, bTo) share at least one instant. `null`/`undefined` end = open-ended. */
export function rangesOverlap(a: EffectiveRange, b: EffectiveRange): boolean {
	const aFrom = new Date(a.effectiveFrom).getTime();
	const aTo = a.effectiveTo ? new Date(a.effectiveTo).getTime() : Infinity;
	const bFrom = new Date(b.effectiveFrom).getTime();
	const bTo = b.effectiveTo ? new Date(b.effectiveTo).getTime() : Infinity;
	return aFrom <= bTo && bFrom <= aTo;
}

/**
 * The row whose [effectiveFrom, effectiveTo] covers `asOf`, if any. Callers
 * must keep ranges non-overlapping at write time (`rangesOverlap` above) for
 * this to be unique — MongoDB has no native range-exclusion constraint.
 */
export function findEffective<T extends EffectiveRange>(rows: T[], asOf: Date): T | undefined {
	const t = asOf.getTime();
	return rows.find((row) => {
		const from = new Date(row.effectiveFrom).getTime();
		const to = row.effectiveTo ? new Date(row.effectiveTo).getTime() : Infinity;
		return from <= t && t <= to;
	});
}
