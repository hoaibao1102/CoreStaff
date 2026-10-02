import { PayslipService } from './payslip.service';

describe('PayslipService employee profile lookup', () => {
  it('allows both active and probation employees to use payslip self-service', async () => {
    const lean = jest.fn().mockResolvedValue({ _id: 'profile-1', employmentStatus: 'PROBATION' });
    const findOne = jest.fn().mockReturnValue({ lean });
    const service = new PayslipService(
      {} as any,
      {} as any,
      {} as any,
      { findOne } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.findEmployeeProfileByUserId('507f1f77bcf86cd799439011'))
      .resolves.toMatchObject({ _id: 'profile-1', employmentStatus: 'PROBATION' });
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      employmentStatus: { $in: ['ACTIVE', 'PROBATION'] },
    }));
  });
});
