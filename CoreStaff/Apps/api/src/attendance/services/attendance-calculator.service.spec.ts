import { AttendanceCalculatorService } from './attendance-calculator.service';

describe('AttendanceCalculatorService', () => {
  let service: AttendanceCalculatorService;

  beforeEach(() => {
    service = new AttendanceCalculatorService();
  });

  const shift = {
    startTime: '08:30',
    endTime: '17:30',
    breakMinutes: 60,
    gracePeriodMinutes: 15,
  };

  it('should not mark late if checked in within grace period (08:40 <= 08:30 + 15m)', () => {
    // 08:40 sáng VN = 01:40 UTC
    const checkInAt = new Date('2026-09-22T01:40:00Z');
    const result = service.calculate('2026-09-22', checkInAt, undefined, shift);
    expect(result.lateMinutes).toBe(0);
    expect(result.workingMinutes).toBeNull();
  });

  it('should calculate late minutes when checking in after grace period (08:50 => late 5m)', () => {
    // 08:50 sáng VN = 01:50 UTC (trễ 5 phút so với 08:45)
    const checkInAt = new Date('2026-09-22T01:50:00Z');
    const result = service.calculate('2026-09-22', checkInAt, undefined, shift);
    expect(result.lateMinutes).toBe(5);
  });

  it('should calculate early minutes when leaving early (17:10 => early 20m)', () => {
    const checkInAt = new Date('2026-09-22T01:30:00Z'); // 08:30 VN
    const checkOutAt = new Date('2026-09-22T10:10:00Z'); // 17:10 VN (sớm 20 phút so với 17:30)
    const result = service.calculate('2026-09-22', checkInAt, checkOutAt, shift);
    expect(result.earlyMinutes).toBe(20);
    expect(result.lateMinutes).toBe(0);
    // Tổng 8 tiếng 40 phút = 520 phút - 60 phút nghỉ = 460 phút
    expect(result.workingMinutes).toBe(460);
  });

  it('should calculate exact full day working minutes (08:30 -> 17:30 = 9h - 1h break = 480m)', () => {
    const checkInAt = new Date('2026-09-22T01:30:00Z'); // 08:30 VN
    const checkOutAt = new Date('2026-09-22T10:30:00Z'); // 17:30 VN
    const result = service.calculate('2026-09-22', checkInAt, checkOutAt, shift);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyMinutes).toBe(0);
    expect(result.workingMinutes).toBe(480);
  });
});
