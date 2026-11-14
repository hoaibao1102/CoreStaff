import { BadRequestException, ConflictException } from '@nestjs/common';
import { TimesheetPeriodService } from './timesheet-period.service';
import { TimesheetPeriodStatus } from '../../database/schemas/timesheet-period.schema';

const ORG = '64f1a2b3c4d5e6f7a8b9c0d1';
const PERIOD = '64f1a2b3c4d5e6f7a8b9c0d2';

function build(status: TimesheetPeriodStatus, updated: any = { _id: PERIOD, status: 'REVIEWING', version: 3 }) {
	const lean = jest.fn().mockResolvedValue(updated);
	const periodModel: any = {
		findOne: jest.fn().mockReturnValue({
			lean: jest.fn().mockResolvedValue({
				_id: PERIOD,
				organizationId: ORG,
				status,
				version: 2,
				startDate: new Date('2026-10-01'),
				endDate: new Date('2026-10-31'),
			}),
		}),
		findOneAndUpdate: jest.fn().mockReturnValue({ lean }),
		findByIdAndUpdate: jest.fn(),
	};
	const none: any = {};
	const service = new TimesheetPeriodService(
		periodModel, none, none, none, none, none, none, none, none, none, none, none, none, none, none,
	);
	return { service, periodModel };
}

describe('TimesheetPeriodService.updateStatus (AUD-C01)', () => {
	it.each([
		[TimesheetPeriodStatus.READY_TO_CLOSE, TimesheetPeriodStatus.CLOSED],
		[TimesheetPeriodStatus.CLOSED, TimesheetPeriodStatus.REVIEWING],
	])('rejects %s -> %s and writes nothing', async (from, to) => {
		const { service, periodModel } = build(from);
		await expect(service.updateStatus(ORG, PERIOD, to, 'u1')).rejects.toThrow(BadRequestException);
		await expect(service.updateStatus(ORG, PERIOD, to, 'u1')).rejects.toThrow(/USE_CLOSE_OR_REOPEN_WORKFLOW/);
		expect(periodModel.findOneAndUpdate).not.toHaveBeenCalled();
		expect(periodModel.findByIdAndUpdate).not.toHaveBeenCalled();
	});

	it('still allows a non-CLOSED transition and scopes the write by tenant, status and version', async () => {
		const { service, periodModel } = build(TimesheetPeriodStatus.READY_TO_CLOSE);
		const result = await service.updateStatus(ORG, PERIOD, TimesheetPeriodStatus.REVIEWING, 'u1');
		expect(result.status).toBe('REVIEWING');
		const [filter, update] = periodModel.findOneAndUpdate.mock.calls[0];
		expect(filter).toMatchObject({
			_id: PERIOD,
			organizationId: ORG,
			status: TimesheetPeriodStatus.READY_TO_CLOSE,
			version: 2,
		});
		expect(update).toEqual({ $set: { status: TimesheetPeriodStatus.REVIEWING } });
	});

	it('throws PERIOD_VERSION_CONFLICT when the compare-and-set loses a race', async () => {
		const { service } = build(TimesheetPeriodStatus.READY_TO_CLOSE, null);
		await expect(
			service.updateStatus(ORG, PERIOD, TimesheetPeriodStatus.REVIEWING, 'u1'),
		).rejects.toThrow(ConflictException);
	});
});
