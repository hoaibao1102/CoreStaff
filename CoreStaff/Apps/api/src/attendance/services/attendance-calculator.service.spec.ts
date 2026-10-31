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

  it('REGRESSION: morning-only punch must not subtract a lunch break outside the punch span', () => {
    // Exact lunch boundaries must come from the shift, never from aggregate breakMinutes.
    const result = service.calculate('2026-09-22',
      new Date('2026-09-22T01:00:00Z'), new Date('2026-09-22T05:00:00Z'),
      { startTime: '08:00', endTime: '17:00', breakMinutes: 60, ...{ breakStartTime: '12:00', breakEndTime: '13:00' }, gracePeriodMinutes: 0 });
    expect(result.requiredWorkingMinutes).toBe(480);
    expect(result.workingMinutes).toBe(240);
  });

  it('counts 240 morning minutes when canonical required intervals explicitly exclude lunch', () => {
    const result = service.calculate('2026-09-22',
      new Date('2026-09-22T01:00:00Z'), new Date('2026-09-22T05:00:00Z'),
      { startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 0,
        requiredWorkingIntervals: [{ from: '08:00', to: '12:00' }, { from: '13:00', to: '17:00' }] });
    expect(result).toMatchObject({ requiredWorkingMinutes: 480, workingMinutes: 240, earlyMinutes: 300 });
  });

  it.each([
    ['morning', '08:00', '12:00', 240],
    ['afternoon', '13:00', '17:00', 240],
    ['inside lunch', '12:15', '12:45', 0],
    ['partial lunch overlap', '11:30', '12:30', 30],
    ['full day plus OT', '07:00', '19:00', 480],
    ['before lunch', '08:00', '10:00', 120],
  ])('uses exact break intersection: %s', (_name, from, to, expected) => {
    const time = (value: string) => new Date(`2026-09-22T${value}:00+07:00`);
    const result = service.calculate('2026-09-22', time(from as string), time(to as string), {
      startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15,
      breakStartTime: '12:00', breakEndTime: '13:00',
    });
    expect(result.workingMinutes).toBe(expected);
    expect(result.requiredWorkingMinutes).toBe(480);
  });

  it('keeps aggregate-only legacy deduction rather than inventing a lunch location', () => {
    const result = service.calculate('2026-09-22', new Date('2026-09-22T08:00:00+07:00'), new Date('2026-09-22T12:00:00+07:00'), {
      startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 0,
    });
    expect(result.workingMinutes).toBe(180);
  });

  it('does not infer noon for a configured 10–11 break and keeps grace metrics unchanged', () => {
    const result = service.calculate('2026-09-22', new Date('2026-09-22T09:00:00+07:00'), new Date('2026-09-22T12:00:00+07:00'), {
      startTime: '08:00', endTime: '17:00', breakMinutes: 60, gracePeriodMinutes: 15,
      breakStartTime: '10:00', breakEndTime: '11:00',
    });
    expect(result).toMatchObject({ workingMinutes: 120, lateMinutes: 45, earlyMinutes: 300 });
  });

  const at = (time: string) => new Date(`2026-09-22T${String(Number(time.slice(0,2))-7).padStart(2,'0')}:${time.slice(3)}:00Z`);
  const partial = (requiredWorkingIntervals: Array<{from:string;to:string}>, approvedLeaveIntervals: Array<{from:string;to:string}>) => ({
    startTime:'08:00',endTime:'17:00',breakMinutes:60,gracePeriodMinutes:0,requiredWorkingIntervals,approvedLeaveIntervals,
  });

  it.each([
    ['morning leave on time', at('13:00'), undefined, partial([{from:'13:00',to:'17:00'}],[{from:'08:00',to:'12:00'}]), 0, 0],
    ['morning leave late', at('13:20'), undefined, partial([{from:'13:00',to:'17:00'}],[{from:'08:00',to:'12:00'}]), 20, 0],
    ['morning leave early arrival', at('12:50'), undefined, partial([{from:'13:00',to:'17:00'}],[{from:'08:00',to:'12:00'}]), 0, 0],
    ['afternoon leave normal check-in', at('08:00'), undefined, partial([{from:'08:00',to:'12:00'}],[{from:'13:00',to:'17:00'}]), 0, 0],
    ['afternoon leave late', at('08:15'), undefined, partial([{from:'08:00',to:'12:00'}],[{from:'13:00',to:'17:00'}]), 15, 0],
  ])('%s', (_name, checkIn, checkOut, configured, late, early) => {
    const result=service.calculate('2026-09-22',checkIn as Date,checkOut as Date|undefined,configured as any);
    expect(result.lateMinutes).toBe(late);expect(result.earlyMinutes).toBe(early);
  });

  it.each([
    ['morning leave complete',at('13:00'),at('17:00'),[{from:'13:00',to:'17:00'}],[{from:'08:00',to:'12:00'}],0,240],
    ['morning leave early checkout',at('13:00'),at('16:30'),[{from:'13:00',to:'17:00'}],[{from:'08:00',to:'12:00'}],30,210],
    ['afternoon leave complete',at('08:00'),at('12:00'),[{from:'08:00',to:'12:00'}],[{from:'13:00',to:'17:00'}],0,240],
    ['afternoon leave early checkout',at('08:00'),at('11:40'),[{from:'08:00',to:'12:00'}],[{from:'13:00',to:'17:00'}],20,220],
    ['afternoon leave checkout after boundary',at('08:00'),at('12:10'),[{from:'08:00',to:'12:00'}],[{from:'13:00',to:'17:00'}],0,240],
  ])('%s',(_name,checkIn,checkOut,required,approved,early,worked)=>{
    const result=service.calculate('2026-09-22',checkIn as Date,checkOut as Date,partial(required as any,approved as any));
    expect(result.earlyMinutes).toBe(early);expect(result.workingMinutes).toBe(worked);expect(result.approvedLeaveMinutes).toBe(240);
  });

  it('requires no punch and creates no violations for effective full-day leave',()=>{
    const result=service.calculate('2026-09-22',at('15:00'),at('15:01'),partial([],[{from:'08:00',to:'12:00'},{from:'13:00',to:'17:00'}]));
    expect(result).toMatchObject({lateMinutes:0,earlyMinutes:0,workingMinutes:0,effectiveCheckInTime:null,effectiveCheckOutTime:null,requiredWorkingMinutes:0,approvedLeaveMinutes:480});
  });

  it('counts actual work only inside multiple remaining intervals',()=>{
    const result=service.calculate('2026-09-22',at('08:00'),at('17:00'),partial([{from:'08:00',to:'10:00'},{from:'15:00',to:'17:00'}],[{from:'10:00',to:'12:00'},{from:'13:00',to:'15:00'}]));
    expect(result).toMatchObject({workingMinutes:240,approvedLeaveMinutes:240,requiredWorkingMinutes:240});
  });
});
