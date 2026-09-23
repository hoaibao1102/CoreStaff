import { NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AttendanceService } from './attendance.service';

type Row = Record<string, any>;

function queryOne(row: Row | null) {
  return { lean: async () => row };
}

function build(options: {
  evidence?: Row | null;
  request?: Row | null;
  managerAssignments?: Row[];
} = {}) {
  const evidence = options.evidence === undefined
    ? { _id: '507f1f77bcf86cd799439011', organizationId: '507f1f77bcf86cd799439012', ownerUserId: '507f1f77bcf86cd799439013', storageKey: 'org/evidence/file.jpg', mimeType: 'image/jpeg', originalFileName: 'selfie.jpg' }
    : options.evidence;
  const evidenceModel = { findOne: jest.fn(() => queryOne(evidence ?? null)) };
  const managerRequestModel = { findOne: jest.fn(() => queryOne(options.request ?? null)) };
  const managerAssignmentModel = {
    findOne: jest.fn((filter: Row) => queryOne((options.managerAssignments ?? []).find((row) =>
      String(row.organizationId) === String(filter.organizationId)
      && String(row.managerUserId) === String(filter.managerUserId)
      && String(row.departmentId) === String(filter.departmentId)
      && row.active === true,
    ) ?? null)),
  };
  const storage = { download: jest.fn(async () => Readable.from('bytes')), isConfigured: jest.fn(() => true) };
  const inertModel = {} as any;
  const service = new AttendanceService(
    inertModel,
    inertModel,
    evidenceModel as any,
    inertModel,
    inertModel,
    inertModel,
    managerAssignmentModel as any,
    managerRequestModel as any,
    inertModel,
    { findOne: jest.fn(() => queryOne(null)), create: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    storage as any,
  );
  return { service, storage };
}

const evidenceId = '507f1f77bcf86cd799439011';
const organizationId = '507f1f77bcf86cd799439012';
const ownerId = '507f1f77bcf86cd799439013';
const managerId = '507f1f77bcf86cd799439014';

describe('AttendanceService evidence authorization', () => {
  it('allows the evidence owner in the same tenant', async () => {
    const { service, storage } = build();
    await expect(service.getEvidenceStream(evidenceId, { userId: ownerId, organizationId, role: 'EMPLOYEE' }))
      .resolves.toMatchObject({ mimeType: 'image/jpeg', originalFileName: 'selfie.jpg' });
    expect(storage.download).toHaveBeenCalledWith('org/evidence/file.jpg');
  });

  it('returns resource not found to another employee in the same tenant', async () => {
    const { service, storage } = build();
    await expect(service.getEvidenceStream(evidenceId, {
      userId: '507f1f77bcf86cd799439099', organizationId, role: 'EMPLOYEE',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('returns resource not found across tenants', async () => {
    const { service } = build({ evidence: null });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: ownerId, organizationId: '507f1f77bcf86cd799439099', role: 'EMPLOYEE',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a manager with an effective assignment for the request department', async () => {
    const departmentId = '507f1f77bcf86cd799439015';
    const { service } = build({
      request: { evidenceId, organizationId, departmentId },
      managerAssignments: [{ organizationId, managerUserId: managerId, departmentId, active: true, effectiveFrom: new Date('2020-01-01') }],
    });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'DEPARTMENT_MANAGER',
    })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
  });

  it('blocks a manager outside the effective department scope', async () => {
    const departmentId = '507f1f77bcf86cd799439015';
    const { service } = build({
      request: { evidenceId, organizationId, departmentId },
      managerAssignments: [{ organizationId, managerUserId: managerId, departmentId, active: true, effectiveFrom: new Date('2020-01-01'), effectiveTo: new Date('2021-01-01') }],
    });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'DEPARTMENT_MANAGER',
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows HR in the same tenant but not SYSTEM_ADMIN by default', async () => {
    const { service } = build();
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'HR',
    })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    await expect(service.getEvidenceStream(evidenceId, {
      userId: managerId, organizationId, role: 'SYSTEM_ADMIN',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
