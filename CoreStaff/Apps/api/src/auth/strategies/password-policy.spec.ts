import { isWeakPassword, generateTempPassword } from './password-policy';

describe('isWeakPassword (SRS §4.4)', () => {
	it.each(['short1', 'allletters', '12345678', '', 'onlyletters'])('rejects %p', (pw) => {
		expect(isWeakPassword(pw)).toBe(true);
	});

	it.each(['Passw0rd', 'AAAAAAAA1', 'a_b_C_12'])('accepts %p', (pw) => {
		expect(isWeakPassword(pw)).toBe(false);
	});
});

describe('generateTempPassword', () => {
	it('produces passwords that satisfy the policy, every time', () => {
		// 2000 draws: composition guarantees the letter+digit pair, so any failure
		// here would mean the slots or the shuffle are wrong, not unlucky RNG.
		for (let i = 0; i < 2000; i++) {
			const pw = generateTempPassword();
			expect(pw).toHaveLength(12);
			expect(isWeakPassword(pw)).toBe(false);
		}
	});

	it('stays inside the relay-friendly charset (no I/O/l/0)', () => {
		for (let i = 0; i < 500; i++) {
			expect(generateTempPassword()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789]+$/);
		}
	});

	it('does not pin the guaranteed letter+digit to the first two slots', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 500; i++) {
			const pw = generateTempPassword();
			seen.add(`${/\d/.test(pw[0])}:${/\d/.test(pw[1])}`);
		}
		expect(seen.size).toBeGreaterThan(1);
	});

	it('varies across calls', () => {
		expect(new Set(Array.from({ length: 50 }, () => generateTempPassword())).size).toBeGreaterThan(1);
	});

	it('honours a longer length and rejects an impossible one', () => {
		expect(generateTempPassword(20)).toHaveLength(20);
		expect(() => generateTempPassword(1)).toThrow(/length >= 2/);
	});
});
