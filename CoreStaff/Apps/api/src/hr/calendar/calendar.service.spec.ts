import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarExceptionType } from '../../database/schemas/enums';

const dto = { date: '2026-09-02', type: CalendarExceptionType.PUBLIC_HOLIDAY, name: 'Quốc khánh' };
function setup() {
  const calendar = {
    create: jest.fn(async (data: unknown) => ({ toObject: () => data })),
    findOne: jest.fn(() => ({ lean: async () => ({ ...dto, _id: 'c1' }) })),
    findOneAndUpdate: jest.fn(() => ({ lean: async () => ({ ...dto, _id: 'c1' }) })),
  };
  const policies = { overtimeAt: jest.fn(async () => ({ publicHolidayRate: 3 })) };
  return { service: new CalendarService(calendar as never, policies as never), calendar, policies };
}

describe('Calendar overtime policy enforcement', () => {
  it('resolves the policy for the tenant and calendar date before creating', async () => {
    const { service, policies } = setup();
    await service.create('org', 'hr', dto);
    expect(policies.overtimeAt).toHaveBeenCalledWith('org', new Date(dto.date));
  });
  it('does not write a calendar day without an effective overtime policy', async () => {
    const { service, policies, calendar } = setup();
    policies.overtimeAt.mockRejectedValueOnce(new NotFoundException('OVERTIME_POLICY_NOT_FOUND'));
    await expect(service.create('org', 'hr', dto)).rejects.toThrow('OVERTIME_POLICY_NOT_FOUND');
    expect(calendar.create).not.toHaveBeenCalled();
  });
  it('rechecks the policy on the changed date and blocks the update when absent', async () => {
    const { service, policies, calendar } = setup();
    policies.overtimeAt.mockRejectedValueOnce(new NotFoundException('OVERTIME_POLICY_NOT_FOUND'));
    await expect(service.update('org', 'hr', 'c1', { date: '2027-01-01' })).rejects.toThrow('OVERTIME_POLICY_NOT_FOUND');
    expect(policies.overtimeAt).toHaveBeenCalledWith('org', new Date('2027-01-01'));
    expect(calendar.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
