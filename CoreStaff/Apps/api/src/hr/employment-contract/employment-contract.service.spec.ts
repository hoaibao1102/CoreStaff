import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  EmploymentContractService,
  computeExpiryWarning,
} from './employment-contract.service';
import { ContractStatus, ContractType } from '../../database/schemas/enums';

interface ContractRow {
  _id: string;
  organizationId: string;
  employeeProfileId: string;
  contractType: string;
  status: string;
  effectiveDate: Date;
  expiryDate?: Date;
  endDate?: Date;
  statusReason?: string;
  statusChangedAt?: Date;
  note?: string;
}

interface ProfileRow {
  _id: string;
  organizationId: string;
  userId: string;
  employeeCode: string;
  employmentStatus?: string;
}

interface UserRow {
  _id: string;
  organizationId: string;
  fullName: string;
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => row[k] === v);
}

/** Query-like fake mirroring employee.service.spec.ts: `.lean()` yields the plain row. */
function leanQuery(kind: 'findOne' | 'findOneAndUpdate', getRow: () => Record<string, unknown> | undefined) {
  const query = {
    lean() {
      return query;
    },
    session() {
      return query;
    },
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(getRow()).then(resolve, reject);
    },
  };
  return query;
}

function buildContractModel(rows: ContractRow[]) {
  return {
    async create(doc: Partial<ContractRow>) {
      const row = { _id: String(rows.length + 1), ...doc } as ContractRow;
      rows.push(row);
      return { toObject: () => ({ ...row }) };
    },
    find(filter: Record<string, unknown>) {
      // Chainable: the service calls both `.lean()` and `.sort(...).lean()`.
      const run = async () => rows.filter((r) => filterMatches(r as never, filter));
      const query = { sort: () => query, lean: run };
      return query;
    },
    findOne(filter: Record<string, unknown>) {
      return leanQuery('findOne', () => {
        const row = rows.find((r) => matches(r as never, filter));
        return row ? { ...row } : undefined;
      });
    },
    findOneAndUpdate(filter: Record<string, unknown>, update: { $set: Partial<ContractRow> }) {
      return leanQuery('findOneAndUpdate', () => {
        const row = rows.find((r) => matches(r as never, filter));
        if (!row) return undefined;
        Object.assign(row, { ...update.$set, status: (update.$set.status ?? row.status) as string });
        return { ...row };
      });
    },
  };
}

/** Fakes Mongo comparisons the service emits: `_id: { $in: [...] }` and bare equality. */
function filterMatches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => {
    const cell = (row as never)[k];
    if (v && typeof v === 'object' && Array.isArray((v as { $in?: unknown[] }).$in)) {
      return (v as { $in: unknown[] }).$in.map(String).includes(String(cell));
    }
    if (Array.isArray(v)) {
      return (v as unknown[]).map(String).includes(String(cell));
    }
    return cell === v;
  });
}

function buildEnrichModels(rows: ProfileRow[], users: UserRow[]) {
  return {
    profileModel: {
      /** Fakes Mongo `$in` on scoped `_id` filters the way enrich queries. */
      find(filter: Record<string, unknown>) {
        return {
          select: () => ({
            lean: async () => rows.filter((r) => filterMatches(r as never, filter)),
          }),
        };
      },
      exists(filter: Record<string, unknown>) {
        return Promise.resolve(rows.some((r) => matches(r as never, filter)) ? { _id: rows[0]._id } : null);
      },
    },
    userModel: {
      find(filter: Record<string, unknown>) {
        return {
          select: () => ({
            lean: async () => users.filter((r) => filterMatches(r as never, filter)),
          }),
        };
      },
    },
  };
}

function contractRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    _id: 'c1',
    organizationId: 'org-a',
    employeeProfileId: 'p1',
    contractType: ContractType.FIXED_TERM,
    status: ContractStatus.ACTIVE,
    effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    expiryDate: new Date('2026-12-31T00:00:00.000Z'),
    ...overrides,
  };
}

function buildService(rows: ContractRow[], profiles: ProfileRow[] = [], users: UserRow[] = []) {
  const { profileModel, userModel } = buildEnrichModels(profiles, users);
  return new EmploymentContractService(
    buildContractModel(rows) as never,
    profileModel as never,
    userModel as never,
  );
}

describe('computeExpiryWarning', () => {
  const day = 86_400_000;
  const now = new Date('2026-09-18T00:00:00.000Z');
  const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * day);

  it('flags an ACTIVE contract inside the 30-day window', () => {
    expect(computeExpiryWarning(ContractStatus.ACTIVE, at(15), now)).toEqual({
      isExpiringSoon: true,
      isExpired: false,
      expiryWarningDays: 15,
    });
  });
  it('does not flag contracts outside the window', () => {
    expect(computeExpiryWarning(ContractStatus.ACTIVE, at(31), now)).toEqual({
      isExpiringSoon: false,
      isExpired: false,
      expiryWarningDays: 31,
    });
  });
  it('only flags ACTIVE contracts', () => {
    expect(computeExpiryWarning(ContractStatus.DRAFT, at(10), now)).toEqual({
      isExpiringSoon: false,
      isExpired: false,
      expiryWarningDays: null,
    });
  });
  it('surfaces a past expiry as drift instead of hiding it', () => {
    expect(computeExpiryWarning(ContractStatus.ACTIVE, at(-10), now)).toEqual({
      isExpiringSoon: false,
      isExpired: true,
      expiryWarningDays: 0,
    });
  });
  it('handles an undefined expiryDate', () => {
    expect(computeExpiryWarning(ContractStatus.ACTIVE, undefined, now)).toEqual({
      isExpiringSoon: false,
      isExpired: false,
      expiryWarningDays: null,
    });
  });
});

describe('EmploymentContractService', () => {
  describe('create', () => {
    it('creates as DRAFT and enriches owner names', async () => {
      const rows: ContractRow[] = [];
      const service = buildService(
        rows,
        [{ _id: 'p1', organizationId: 'org-a', userId: 'u1', employeeCode: 'TVS-0001' }],
        [{ _id: 'u1', organizationId: 'org-a', fullName: 'Nguyen Van An' }],
      );
      const out = await service.create('org-a', {
        employeeId: 'p1',
        contractType: ContractType.FIXED_TERM,
        effectiveDate: '2026-01-01',
        expiryDate: '2026-12-31',
      });
      expect(out).toMatchObject({
        status: ContractStatus.DRAFT,
        employeeCode: 'TVS-0001',
        employeeFullName: 'Nguyen Van An',
        isExpiringSoon: false,
      });
    });

    it('rejects an unknown employee (cross-tenant/404 semantics)', async () => {
      const service = buildService([], [{ _id: 'other', organizationId: 'org-b', userId: 'u9', employeeCode: 'X' }], []);
      await expect(
        service.create('org-a', {
          employeeId: 'other',
          contractType: ContractType.FIXED_TERM,
          effectiveDate: '2026-01-01',
          expiryDate: '2026-12-31',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      [ContractType.INDEFINITE_TERM, undefined, undefined, 'ok'],
      [ContractType.FIXED_TERM, undefined, undefined, 'CONTRACT_EXPIRY_REQUIRED'],
      [ContractType.INDEFINITE_TERM, '2026-12-31', undefined, 'CONTRACT_INDEFINITE_TERM_NO_EXPIRY'],
      [ContractType.FIXED_TERM, '2026-06-01', '2026-12-31', 'CONTRACT_EXPIRY_BEFORE_EFFECTIVE'],
    ])('date rule %s expiry=%s effective=%s → %s', async (type, expiry, effective, expectation) => {
      const service = buildService(
        [],
        [{ _id: 'p1', organizationId: 'org-a', userId: 'u1', employeeCode: 'E' }],
        [],
      );
      const dto = {
        employeeId: 'p1',
        // `effective` is the LATER date here: expiry 2026-06-01 after effective 2026-12-31
        // would be fine, but expiry BEFORE effective is the invalid case we assert.
        contractType: type as ContractType,
        effectiveDate: effective ?? (expiry ? '2026-01-01' : '2026-01-01'),
        ...(expiry ? { expiryDate: expiry } : {}),
      };
      if (expectation === 'ok') {
        const out = await service.create('org-a', dto);
        expect(out.contractType).toBe(type);
      } else {
        await expect(service.create('org-a', dto)).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe('findAll / findOne', () => {
    it('lists tenant-scoped rows with filters and derived warning', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.ACTIVE, expiryDate: new Date('2026-09-25T00:00:00.000Z') }),
        contractRow({ _id: 'c2', status: ContractStatus.EXPIRED }),
      ];
      const service = buildService(
        rows,
        [{ _id: 'p1', organizationId: 'org-a', userId: 'u1', employeeCode: 'TVS-0001' }],
        [{ _id: 'u1', organizationId: 'org-a', fullName: 'NVA' }],
      );
      const out = await service.findAll('org-a', {});
      expect(out).toHaveLength(2);
      expect(out[0].employeeCode).toBe('TVS-0001');
      expect(out.some((r) => r.employeeFullName === 'NVA')).toBe(true);
    });

    it('filters by employee and status', async () => {
      const rows = [contractRow({ _id: 'c1' }), contractRow({ _id: 'c2', employeeProfileId: 'p2' })];
      const service = buildService(rows);
      const out = await service.findAll('org-a', { employeeId: 'p1', status: ContractStatus.ACTIVE });
      expect(out).toHaveLength(1);
      expect(out[0]._id).toBe('c1');
    });

    it('returns 404 for a cross-tenant contract (AC-CONTRACT-01)', async () => {
      const service = buildService([contractRow({ _id: 'c1', organizationId: 'org-b' })]);
      await expect(service.findOne('org-a', 'c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeStatus', () => {
    it.each([
      [ContractStatus.DRAFT, ContractStatus.ACTIVE, true, {}],
      [ContractStatus.DRAFT, ContractStatus.TERMINATED, true, { effectiveDate: '2026-03-01' }],
      [ContractStatus.DRAFT, ContractStatus.EXPIRED, false, {}],
    ])('transition %s → %s allowed=%s', async (from, to, allowed, extra) => {
      const service = buildService([contractRow({ status: from })]);
      if (allowed) {
        const out = await service.changeStatus('org-a', 'c1', { newStatus: to as ContractStatus, ...extra });
        expect(out.status).toBe(to);
      } else {
        await expect(service.changeStatus('org-a', 'c1', { newStatus: to as ContractStatus })).rejects.toThrow(
          ConflictException,
        );
      }
    });

    it('termination stamps endDate from effectiveDate', async () => {
      const service = buildService([contractRow()]);
      const out = await service.changeStatus('org-a', 'c1', {
        newStatus: ContractStatus.TERMINATED,
        effectiveDate: '2026-03-01',
        reason: '  Nhân viên nghỉ việc  ',
      });
      expect(out.endDate).toEqual(new Date('2026-03-01T00:00:00.000Z'));
      expect(out.status).toBe(ContractStatus.TERMINATED);
      // TASK-030: the HR-typed reason must be persisted, trimmed, not dropped.
      expect(out.statusReason).toBe('Nhân viên nghỉ việc');
      expect(out.statusChangedAt).toBeInstanceOf(Date);
    });

    it('a later transition without a reason clears the stale one', async () => {
      const service = buildService([
        contractRow({ status: ContractStatus.EXPIRED, statusReason: 'Hết hạn', endDate: new Date('2026-01-01') }),
      ]);
      const out = await service.changeStatus('org-a', 'c1', {
        newStatus: ContractStatus.ACTIVE,
        effectiveDate: '2026-02-01',
        expiryDate: '2026-12-31',
      });
      expect(out.status).toBe(ContractStatus.ACTIVE);
      expect(out.statusReason).toBeUndefined();
    });

    it('renewal EXPIRED→ACTIVE requires new dates', async () => {
      const service = buildService([contractRow({ status: ContractStatus.EXPIRED })]);
      await expect(service.changeStatus('org-a', 'c1', { newStatus: ContractStatus.ACTIVE })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('renewal appends a new row and freezes the expired term (no overwrite)', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.EXPIRED, effectiveDate: new Date('2025-01-01T00:00:00.000Z'), expiryDate: new Date('2025-12-31T00:00:00.000Z') }),
      ];
      const service = buildService(rows);
      const out = await service.changeStatus('org-a', 'c1', {
        newStatus: ContractStatus.ACTIVE,
        effectiveDate: '2026-01-01',
        expiryDate: '2026-12-31',
      });
      // A distinct new row, ACTIVE, with the renewal dates...
      expect(out._id).not.toBe('c1');
      expect(out.status).toBe(ContractStatus.ACTIVE);
      expect(out.effectiveDate).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      // ...and the original term left EXPIRED with its dates intact (§46 severance).
      const old = rows.find((r) => r._id === 'c1');
      expect(old?.status).toBe(ContractStatus.EXPIRED);
      expect(old?.expiryDate).toEqual(new Date('2025-12-31T00:00:00.000Z'));
      expect(rows).toHaveLength(2);
    });

    it('refuses a renewal that overlaps an existing ACTIVE window', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.EXPIRED }),
        contractRow({ _id: 'c2', status: ContractStatus.ACTIVE, effectiveDate: new Date('2026-06-01T00:00:00.000Z'), expiryDate: new Date('2027-06-01T00:00:00.000Z') }),
      ];
      const service = buildService(rows);
      await expect(
        service.changeStatus('org-a', 'c1', { newStatus: ContractStatus.ACTIVE, effectiveDate: '2026-07-01', expiryDate: '2027-07-01' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows back-to-back terms that only touch at the boundary', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.EXPIRED }),
        contractRow({ _id: 'c2', status: ContractStatus.ACTIVE, effectiveDate: new Date('2026-01-01T00:00:00.000Z'), expiryDate: new Date('2026-12-31T00:00:00.000Z') }),
      ];
      const service = buildService(rows);
      // New window starts exactly when c2 ends → not an overlap.
      const out = await service.changeStatus('org-a', 'c1', { newStatus: ContractStatus.ACTIVE, effectiveDate: '2026-12-31', expiryDate: '2027-12-31' });
      expect(out.status).toBe(ContractStatus.ACTIVE);
    });
  });

  describe('findContractAt', () => {
    const p = [{ _id: 'p1', organizationId: 'org-a', userId: 'u1', employeeCode: 'TVS-0001' }];
    const u = [{ _id: 'u1', organizationId: 'org-a', fullName: 'NVA' }];

    it('returns the EXPIRED term that governed a past date, not the newest row', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.EXPIRED, effectiveDate: new Date('2025-01-01T00:00:00.000Z'), expiryDate: new Date('2025-12-31T00:00:00.000Z') }),
        contractRow({ _id: 'c2', status: ContractStatus.ACTIVE, effectiveDate: new Date('2026-01-01T00:00:00.000Z'), expiryDate: new Date('2026-12-31T00:00:00.000Z') }),
      ];
      const service = buildService(rows, p, u);
      const out = await service.findContractAt('org-a', 'p1', new Date('2025-06-15T00:00:00.000Z'));
      expect(out?._id).toBe('c1');
    });

    it('matches half-open windows (expiry day is exclusive)', async () => {
      const rows = [contractRow({ _id: 'c1', effectiveDate: new Date('2026-01-01T00:00:00.000Z'), expiryDate: new Date('2026-12-31T00:00:00.000Z') })];
      const service = buildService(rows, p, u);
      expect((await service.findContractAt('org-a', 'p1', new Date('2026-12-30T00:00:00.000Z')))?._id).toBe('c1');
      expect(await service.findContractAt('org-a', 'p1', new Date('2026-12-31T00:00:00.000Z'))).toBeNull();
    });

    it('returns null outside every window and ignores DRAFT/TERMINATED', async () => {
      const rows = [
        contractRow({ _id: 'c1', status: ContractStatus.DRAFT }),
        contractRow({ _id: 'c2', status: ContractStatus.TERMINATED, effectiveDate: new Date('2024-01-01T00:00:00.000Z'), expiryDate: new Date('2024-12-31T00:00:00.000Z') }),
      ];
      const service = buildService(rows, p, u);
      expect(await service.findContractAt('org-a', 'p1', new Date('2024-06-01T00:00:00.000Z'))).toBeNull();
    });
  });

  describe('findCompliance', () => {
    const now = new Date('2026-09-18T00:00:00.000Z');
    const profile = (id: string, status = 'ACTIVE'): ProfileRow => ({
      _id: id,
      organizationId: 'org-a',
      userId: `u-${id}`,
      employeeCode: id.toUpperCase(),
      employmentStatus: status,
    });

    it('flags a working employee with no ACTIVE contract', async () => {
      const service = buildService([contractRow({ _id: 'c1', status: ContractStatus.EXPIRED })], [profile('p1')]);
      const out = await service.findCompliance('org-a', now);
      expect(out.findings).toEqual([
        expect.objectContaining({ code: 'EXPIRED_NOT_RENEWED', employeeProfileId: 'p1', contractId: 'c1' }),
      ]);
    });

    it('flags a working employee with no contract at all', async () => {
      const service = buildService([], [profile('p1')]);
      const out = await service.findCompliance('org-a', now);
      expect(out.findings[0].code).toBe('NO_CONTRACT');
    });

    it('does not flag covered employees or terminal ones', async () => {
      const service = buildService(
        [contractRow({ _id: 'c1' }), contractRow({ _id: 'c2', employeeProfileId: 'p2' })],
        [profile('p1'), profile('p2', 'ACTIVE'), profile('p3', 'RESIGNED')],
      );
      const out = await service.findCompliance('org-a', now);
      expect(out.findings).toHaveLength(0);
    });

    it('reports ACTIVE-past-expiry with days past, plus probation overdue', async () => {
      const rows = [
        contractRow({ _id: 'c1', expiryDate: new Date('2026-09-08T00:00:00.000Z') }),
        contractRow({ _id: 'c2', employeeProfileId: 'p2', contractType: ContractType.PROBATION, expiryDate: new Date('2026-08-19T00:00:00.000Z') }),
      ];
      const service = buildService(rows, [profile('p1'), profile('p2', 'PROBATION')]);
      const out = await service.findCompliance('org-a', now);
      expect(out.counts.ACTIVE_PAST_EXPIRY).toBe(2);
      expect(out.findings.find((f) => f.employeeProfileId === 'p1')).toEqual(
        expect.objectContaining({ code: 'ACTIVE_PAST_EXPIRY', daysPastExpiry: 10, contractId: 'c1' }),
      );
      // Probation contract + PROBATION employee → both findings for p2.
      expect(out.findings.filter((f) => f.employeeProfileId === 'p2').map((f) => f.code).sort()).toEqual([
        'ACTIVE_PAST_EXPIRY',
        'PROBATION_OVERDUE',
      ]);
    });

    it('ignores DRAFT and TERMINATED contracts when judging coverage', async () => {
      const service = buildService(
        [contractRow({ _id: 'c1', status: ContractStatus.DRAFT }), contractRow({ _id: 'c2', status: ContractStatus.TERMINATED })],
        [profile('p1')],
      );
      const out = await service.findCompliance('org-a', now);
      expect(out.findings[0].code).toBe('NO_CONTRACT');
    });
  });
});