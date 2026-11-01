jest.mock('../src/services/hrService', () => ({ hrRequest: jest.fn() }));
import { hrRequest } from '../src/services/hrService';
import * as service from '../src/services/manager.service';
const api = service as any;
describe('attendance confirmation contract', () => {
  beforeEach(() => { jest.resetAllMocks(); (hrRequest as jest.Mock).mockResolvedValue({}); });
  it('classifies confirmation before actionType/selfie and never sends approval times for it', async () => {
    expect(typeof api.managerRequestKind).toBe('function');
    const confirmation={_id:'c',type:'ATTENDANCE',version:2,source:'ATTENDANCE_CONFIRMATION',metadata:{actionType:'CHECK_OUT'},requestedStart:'forbidden'};
    expect(api.managerRequestKind(confirmation)).toBe('CONFIRMATION');
    expect(api.managerRequestKind({type:'ATTENDANCE',metadata:{adjustmentSource:'MANUAL_ADJUSTMENT',actionType:'CHECK_IN'}})).toBe('MANUAL');
    expect(api.managerRequestKind({type:'ATTENDANCE',evidenceId:'e'})).toBe('SELFIE');
    expect(api.managerRequestKind({type:'OVERTIME'})).toBe('OVERTIME');
    await api.decideManagerRequest('base','c','approve',{expectedVersion:2,approvedStart:'forbidden',operationId:'op'},'ATTENDANCE_CONFIRMATION');
    const options=(hrRequest as jest.Mock).mock.calls.at(-1)[2];
    expect(JSON.parse(options.body)).toEqual({expectedVersion:2,operationId:'op'});
    expect(api.canApproveConfirmation({...confirmation,contextValidity:{valid:false}})).toBe(false);
    expect(api.canApproveConfirmation({...confirmation,period:{canMutate:false}})).toBe(false);
    expect(api.canApproveConfirmation(confirmation)).toBe(false);
    expect(api.canApproveConfirmation({...confirmation,canApprove:true,contextValidity:{valid:true},period:{canMutate:true}})).toBe(true);
  });
  it('adapts the backend contextHash and nested calculator without enabling tenant cutover', async () => {
    (hrRequest as jest.Mock).mockResolvedValueOnce({workDate:'2026-09-14',contextHash:'ctx',canSubmit:true,proposedChanges:{checkOutAt:'2026-09-14T10:00:00Z',calculation:{workingMinutes:465,lateMinutes:10,earlyMinutes:0}},blockedReasons:[]});
    const preview=await api.getAttendanceConfirmationPreview('base','2026-09-14');
    expect(preview.previewHash).toBe('ctx');
    expect(preview.workingMinutes).toBe(465);
    expect(preview.enabled).not.toBe(true);
  });
  it('normalizes actual backend intervals, snapshot and endpoint provenance without inferring enablement', async () => {
    (hrRequest as jest.Mock).mockResolvedValueOnce({enabled:true,workDate:'2026-09-14',contextHash:'ctx',requiredWorkingIntervals:[{from:'08:00',to:'12:00'}],snapshot:{shift:{startTime:'08:00',endTime:'17:00',breakMinutes:60},approvedLeaveIntervals:[{from:'13:00',to:'14:00'}]},existingPunches:{checkInProvenance:{source:'SELFIE',eventId:'e'},checkOutProvenance:{source:'LEGACY_UNKNOWN'}}});
    const p=await api.getAttendanceConfirmationPreview('base','2026-09-14');
    expect(p.obligation.requiredWorkingIntervals).toEqual([{from:'08:00',to:'12:00'}]);
    expect(p.obligation.breakMinutes).toBe(60);
    expect(p.existingPunches.checkInProvenance).toBe('SELFIE');
    expect(p.existingPunches.checkOutProvenance).toBe('LEGACY_UNKNOWN');
  });
  it('normalizes manager detail confirmation and its nested period contract', async () => {
    (hrRequest as jest.Mock).mockResolvedValueOnce({_id:'c',canApprove:true,contextValidity:{valid:true},confirmation:{workDate:'2026-09-14',requiredWorkingIntervals:[{from:'08:00',to:'17:00'}],period:{canMutate:true},existingPunches:{checkInProvenance:{source:'OBSERVED'}}}});
    const detail=await api.getManagerRequestDetail('base','c');
    expect(api.canApproveConfirmation(detail)).toBe(true);
    expect(detail.confirmation.obligation.requiredWorkingIntervals).toHaveLength(1);
    expect(detail.confirmation.existingPunches.checkInProvenance).toBe('OBSERVED');
  });
  it('previews OT using only the server-owned window contract', async () => {
    expect(typeof api.getOvertimePreview).toBe('function');
    await api.getOvertimePreview('base',{workDate:'2026-09-14',requestedStart:'2026-09-14T18:00:00+07:00',requestedEnd:'2026-09-14T20:00:00+07:00'});
    expect(hrRequest).toHaveBeenLastCalledWith('base','/api/overtime/preview',{method:'POST',body:JSON.stringify({workDate:'2026-09-14',requestedStart:'2026-09-14T18:00:00+07:00',requestedEnd:'2026-09-14T20:00:00+07:00'})});
  });
  it('reads own preview and submits only server-hash variant with retry identity', async () => {
    expect(typeof api.getAttendanceConfirmationPreview).toBe('function');
    await api.getAttendanceConfirmationPreview('base', '2026-10-29');
    expect(hrRequest).toHaveBeenLastCalledWith('base', '/api/requests/attendance-confirmation-preview?date=2026-10-29', { method: 'GET' });
    await api.createAttendanceConfirmation('base', { workDate: '2026-10-29', reason: 'Quên chấm công', previewHash: 'hash', requestedStart: 'forbidden' }, 'retry-key');
    const options = (hrRequest as jest.Mock).mock.calls.at(-1)[2];
    expect(options.headers).toEqual({ 'Idempotency-Key': 'retry-key' });
    expect(JSON.parse(options.body)).toEqual({ requestKind: 'ATTENDANCE_CONFIRMATION', type: 'ATTENDANCE', workDate: '2026-10-29', reason: 'Quên chấm công', previewHash: 'hash' });
  });
});
