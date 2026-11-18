import { ConflictException } from '@nestjs/common';
import { pickEffectiveAssignment } from './attendance.service';

describe('pickEffectiveAssignment (AUD-H03)', () => {
  const row = (id: string, effectiveFrom?: string, effectiveTo?: string) => ({ _id: id, effectiveFrom, effectiveTo });

  it('ignores a future-dated assignment', () => {
    expect(pickEffectiveAssignment([row('future', '2030-01-01')], '2026-11-14')).toBeNull();
  });

  it('ignores an expired assignment', () => {
    expect(pickEffectiveAssignment([row('old', '2020-01-01', '2021-01-01')], '2026-11-14')).toBeNull();
  });

  it('prefers the most recently started effective assignment', () => {
    const picked = pickEffectiveAssignment(
      [row('old', '2020-01-01'), row('new', '2026-06-01'), row('future', '2030-01-01')],
      '2026-11-14',
    );
    expect(picked._id).toBe('new');
  });

  it('treats missing dates as open-ended and end date as inclusive', () => {
    expect(pickEffectiveAssignment([row('open')], '2026-11-14')._id).toBe('open');
    expect(pickEffectiveAssignment([row('edge', '2026-01-01', '2026-11-14')], '2026-11-14')._id).toBe('edge');
  });

  it('fails closed when two assignments start on the same day', () => {
    expect(() => pickEffectiveAssignment([row('a', '2026-01-01'), row('b', '2026-01-01')], '2026-11-14'))
      .toThrow(ConflictException);
  });
});
