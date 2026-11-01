import { OvertimeController } from './overtime.controller';

describe('own-only overtime preview controller', () => {
  it('forwards the preview hash through the dedicated create route', async () => {
    const createMine = jest.fn(async () => ({ _id: 'request' }));
    const controller = new OvertimeController({ assertNoClientType: jest.fn(), previewLimits: async () => ({}) } as any, { createMine } as any);
    await controller.create('org', { user: { _id: 'own' } }, { workDate: '2026-09-22', requestedStart: '2026-09-22T10:00:00Z', requestedEnd: '2026-09-22T12:00:00Z', reason: 'completed release', previewHash: 'reviewed-hash' });
    expect(createMine).toHaveBeenCalledWith('org', 'own', expect.objectContaining({ previewHash: 'reviewed-hash' }));
  });
  it('adds suggestions only for explicitly enabled tenants', async () => {
    const context = { workDate: '2026-09-22', shift: null };
    const overtime = { dayContext: async () => context, scheduledIntervals: () => [], classifyDay: () => 'OT_WEEKLY_OFF', isV2Enabled: async () => true, scheduleSuggestions: jest.fn(async () => ({ suggestedOvertimeIntervals: [], canFile: false })) };
    const result = await new OvertimeController(overtime as any, {} as any).schedule('org', { user: { _id: 'own' } }, '2026-09-22');
    expect(result.data).toMatchObject({ calculationContract: 'OVERTIME_V2', suggestedOvertimeIntervals: [], canFile: false });
  });
  it('uses session user and server date parsing', async () => {
    const preview = jest.fn(async () => ({ canFile: false }));
    const controller = new OvertimeController({ preview } as any, {} as any);
    const result = await (controller as any).preview('org', { user: { _id: 'own-user' } }, { workDate: '2026-09-22', requestedStart: '2026-09-22T10:00:00Z', requestedEnd: '2026-09-22T12:00:00Z' });
    expect(preview).toHaveBeenCalledWith('org', 'own-user', '2026-09-22', { from: Date.parse('2026-09-22T10:00:00Z'), to: Date.parse('2026-09-22T12:00:00Z') });
    expect(result).toEqual({ success: true, data: { canFile: false } });
  });
});
