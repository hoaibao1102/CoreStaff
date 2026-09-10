import { describe, expect, it, beforeEach } from 'vitest';
import { closePeriod, createShift, exportPeriodSnapshot, fetchShifts, reopenPeriod, resetShifts, updateShift } from './hrService';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  },
});

/**
 * Seeds (mockData.ts):
 *  KP-2026-08 REVIEWING w/ 2 blockers  → close must fail PERIOD_NOT_READY
 *  KP-2026-07 READY_TO_CLOSE, 0 blockers, all confirmed → close succeeds
 *  KP-2026-06 CLOSED, exportedAt set → reopen invalidates export
 */
describe('hrService period closing', () => {
  beforeEach(() => localStorage.clear());

  it('refuses to close a period that still has blockers', async () => {
    await expect(closePeriod('KP-2026-08')).rejects.toMatchObject({ code: 'PERIOD_NOT_READY' });
  });

  it('closes a READY_TO_CLOSE period and generates the snapshot', async () => {
    const periods = await closePeriod('KP-2026-07');
    const closed = periods.find((p) => p.id === 'KP-2026-07')!;
    expect(closed.status).toBe('CLOSED');
    expect(closed.summaries.length).toBeGreaterThan(0);
    expect(closed.version).toBe(3);
  });

  it('rejects a reopen reason shorter than 10 characters', async () => {
    await expect(reopenPeriod('KP-2026-06', 'lỗi')).rejects.toMatchObject({ code: 'REOPEN_REASON_REQUIRED' });
  });

  it('reopen clears confirmations and invalidates the old export snapshot', async () => {
    const periods = await reopenPeriod('KP-2026-06', 'Phát hiện ngày công chưa duyệt sau khi chốt');
    const reopened = periods.find((p) => p.id === 'KP-2026-06')!;
    expect(reopened.status).toBe('REVIEWING');
    expect(reopened.exportedAt).toBeUndefined();
    expect(reopened.confirmations.every((c) => !c.confirmedBy)).toBe(true);
  });

  it('exports CSV only from a closed period', async () => {
    await expect(exportPeriodSnapshot('KP-2026-08')).rejects.toMatchObject({ code: 'EXPORT_NOT_READY' });
    const closed = await closePeriod('KP-2026-07');
    expect(closed.find((p) => p.id === 'KP-2026-07')!.status).toBe('CLOSED');
    const { csv } = await exportPeriodSnapshot('KP-2026-07');
    expect(csv.split('\n').length).toBeGreaterThan(1);
  });
});

const OFFICE = {
  name: 'Ca hành chính', code: 'OFFICE', startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15,
};

describe('hrService ShiftTemplate config (SRS §6)', () => {
  beforeEach(() => resetShifts());

  it('creates a shift for the tenant, active by default', async () => {
    const shifts = await createShift({ ...OFFICE, name: 'Ca gãy ca chiều', code: 'PM-SPLIT', startTime: '13:00', endTime: '21:00' });
    const created = shifts.find((s) => s.code === 'PM-SPLIT')!;
    expect(created).toMatchObject({ startTime: '13:00', endTime: '21:00', active: true });
  });

  it('refuses an overnight shift — end must be after start in the same day', async () => {
    await expect(createShift({ ...OFFICE, code: 'NIGHT', startTime: '22:00', endTime: '06:00' }))
      .rejects.toMatchObject({ code: 'SHIFT_INVALID' });
  });

  it('refuses a break that is not shorter than the shift span', async () => {
    await expect(createShift({ ...OFFICE, code: 'LONG-BREAK', breakMinutes: 540 }))
      .rejects.toMatchObject({ code: 'SHIFT_INVALID' });
  });

  it('refuses a duplicate shift code within the tenant', async () => {
    await expect(createShift({ ...OFFICE, name: 'Ca khác' })).rejects.toMatchObject({ code: 'SHIFT_INVALID' });
  });

  it('deactivates instead of deleting a referenced shift', async () => {
    const before = await fetchShifts();
    const after = await updateShift(before[0].id, { active: false });
    expect(after.find((s) => s.id === before[0].id)!.active).toBe(false);
    expect(after.length).toBe(before.length);
  });

  it('keeps an edit valid against the shift rules', async () => {
    const before = await fetchShifts();
    await expect(updateShift(before[0].id, { endTime: '07:00' })).rejects.toMatchObject({ code: 'SHIFT_INVALID' });
    const after = await updateShift(before[0].id, { gracePeriodMinutes: 5 });
    expect(after.find((s) => s.id === before[0].id)!.gracePeriodMinutes).toBe(5);
  });
});
