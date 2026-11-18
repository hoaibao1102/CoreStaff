import { closeSiblingRequests } from './close-sibling-requests';

function fakeModel() {
  const calls: any[] = [];
  return {
    calls,
    updateMany: jest.fn(async (filter: any, update: any) => {
      calls.push({ filter, update });
      return { modifiedCount: 2 };
    }),
  } as any;
}

describe('closeSiblingRequests (QC 2.4)', () => {
  it('cancels only the still-open requests for that attendance day', async () => {
    const model = fakeModel();
    const count = await closeSiblingRequests(model, {
      organizationId: 'org1',
      attendanceDayId: 'day1',
      reason: 'FORFEITED_MISSING_PUNCH',
    });
    expect(count).toBe(2);
    expect(model.updateMany).toHaveBeenCalledTimes(1);
    const [{ filter, update }] = model.calls;
    expect(filter).toMatchObject({
      organizationId: 'org1',
      attendanceDayId: 'day1',
      status: { $in: ['PENDING', 'CLARIFICATION_REQUESTED'] },
    });
    expect(filter._id).toBeUndefined();
    expect(update.$set).toMatchObject({ status: 'CANCELLED', closedReason: 'FORFEITED_MISSING_PUNCH' });
    expect(update.$set.closedAt).toBeInstanceOf(Date);
  });

  it('leaves the request that produced the outcome untouched', async () => {
    const model = fakeModel();
    await closeSiblingRequests(model, {
      organizationId: 'org1',
      attendanceDayId: 'day1',
      exceptId: 'req1',
      reason: 'ATTENDANCE_CONFIRMED',
    });
    expect(model.calls[0].filter._id).toEqual({ $ne: 'req1' });
  });

  it('is a no-op when the request is not linked to an attendance day', async () => {
    const model = fakeModel();
    const count = await closeSiblingRequests(model, { organizationId: 'org1', reason: 'ATTENDANCE_CONFIRMED' });
    expect(count).toBe(0);
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
