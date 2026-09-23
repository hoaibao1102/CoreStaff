import { rangesOverlap, findEffective } from './effective-dating';

describe('effective-dating helpers (shared by SalaryProfile/InsuranceProfile/InsurancePolicy)', () => {
	describe('rangesOverlap', () => {
		it('detects overlap between two closed ranges', () => {
			expect(rangesOverlap({ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' }, { effectiveFrom: '2026-06-01', effectiveTo: '2026-12-31' })).toBe(true);
		});

		it('treats adjacent (touching) ranges as overlapping — inclusive boundaries', () => {
			expect(rangesOverlap({ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' }, { effectiveFrom: '2026-06-30', effectiveTo: '2026-12-31' })).toBe(true);
		});

		it('does not overlap when ranges are fully separate', () => {
			expect(rangesOverlap({ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' }, { effectiveFrom: '2026-07-01', effectiveTo: '2026-12-31' })).toBe(false);
		});

		it('treats a missing/null effectiveTo as open-ended', () => {
			expect(rangesOverlap({ effectiveFrom: '2026-01-01', effectiveTo: null }, { effectiveFrom: '2030-01-01', effectiveTo: '2030-12-31' })).toBe(true);
		});
	});

	describe('findEffective', () => {
		const rows = [
			{ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', label: 'A' },
			{ effectiveFrom: '2026-07-01', effectiveTo: null, label: 'B' },
		];

		it('resolves the row covering the given date', () => {
			expect(findEffective(rows, new Date('2026-03-01'))?.label).toBe('A');
			expect(findEffective(rows, new Date('2026-08-01'))?.label).toBe('B');
		});

		it('returns undefined when no row covers the date', () => {
			expect(findEffective(rows, new Date('2025-12-31'))).toBeUndefined();
		});
	});
});
