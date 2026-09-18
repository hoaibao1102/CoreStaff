import { NotFoundException } from '@nestjs/common';
import { EmployeeDocumentService } from './employee-document.service';
import { StorageService } from '../../storage/storage.service';
import { Readable } from 'node:stream';

interface DocRow {
  _id: string;
  organizationId: string;
  employeeProfileId: string;
  contractId?: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
  createdAt?: Date;
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => row[k] === v);
}

function buildDocModel(rows: DocRow[]) {
  let nextId = rows.length + 1;
  return {
    async create(doc: Partial<DocRow>) {
      const row = { _id: String(nextId++), ...doc } as DocRow;
      rows.push(row);
      return { toObject: () => ({ ...row }) };
    },
    find(filter: Record<string, unknown>) {
      return { sort: () => ({ lean: async () => rows.filter((r) => matches(r as never, filter)) }) };
    },
    findOne(filter: Record<string, unknown>) {
      const row = rows.find((r) => matches(r as never, filter));
      return { lean: async () => (row ? { ...row } : null) };
    },
    deleteOne(filter: Record<string, unknown>) {
      const idx = rows.findIndex((r) => matches(r as never, filter));
      if (idx >= 0) rows.splice(idx, 1);
      return { lean: async () => ({ deletedCount: idx >= 0 ? 1 : 0 }) };
    },
  };
}

function buildProfileModel(profiles: { _id: string; organizationId: string; userId: string }[]) {
  return {
    exists(filter: Record<string, unknown>) {
      const p = profiles.find((r) => matches(r as never, filter));
      return Promise.resolve(p ? { _id: p._id } : null);
    },
    findOne(filter: Record<string, unknown>) {
      const p = profiles.find((r) => matches(r as never, filter));
      return { select: () => ({ lean: async () => (p ? { _id: p._id } : null) }) };
    },
  };
}

function buildContractModel(contracts: { _id: string; organizationId: string }[]) {
  return {
    exists(filter: Record<string, unknown>) {
      return Promise.resolve(
        contracts.find((r) => matches(r as never, filter)) ? { _id: '1' } : null,
      );
    },
  };
}

function mockStorage(rows: Map<string, Buffer>) {
  return {
    upload: jest.fn(async (key: string, body: Buffer) => {
      rows.set(key, body);
    }),
    download: jest.fn(async (key: string) => {
      if (!rows.has(key)) throw new Error('NoSuchKey');
      return Readable.from(rows.get(key) as Buffer);
    }),
    remove: jest.fn(async (key: string) => {
      rows.delete(key);
    }),
  } as unknown as StorageService;
}

function docRow(overrides: Partial<DocRow> = {}): DocRow {
  return {
    _id: 'd1',
    organizationId: 'org-a',
    employeeProfileId: 'p1',
    originalName: 'HDLD.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    storageKey: 'org-a/d1',
    uploadedBy: 'u1',
    ...overrides,
  };
}

const profile = { _id: 'p1', organizationId: 'org-a', userId: 'u1' };
const contract = { _id: 'c1', organizationId: 'org-a' };

function buildService(rows: DocRow[]) {
  const storageRows = new Map<string, Buffer>();
  // Pre-existing rows must have a real object behind their key for download tests.
  for (const r of rows) storageRows.set(r.storageKey, Buffer.from('pdf'));
  const storage = mockStorage(storageRows);
  const service = new EmployeeDocumentService(
    buildDocModel(rows) as never,
    buildProfileModel([profile]) as never,
    buildContractModel([contract]) as never,
    storage,
  );
  return { service, storage, storageRows };
}

describe('EmployeeDocumentService', () => {
  describe('upload', () => {
    it('uploads then records metadata with a tenant-scoped key', async () => {
      const { service, storage, storageRows } = buildService([]);
      const row = await service.upload('org-a', 'u1', { employeeProfileId: 'p1', contractId: 'c1' }, {
        originalname: '../evil/Hợp đồng.pdf',
        mimetype: 'application/pdf',
        size: 42,
        buffer: Buffer.from('pdf'),
      });
      // Key = org/_id, tenant prefix first; name sanitized of path traversal.
      expect(storage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^org-a\/[0-9a-f]+$/),
        Buffer.from('pdf'),
        'application/pdf',
      );
      const key = (storage.upload as jest.Mock).mock.calls[0][0];
      expect(storageRows.get(key)).toEqual(Buffer.from('pdf'));
      // Sanitized: '/' '+' '\' → '_'; control chars stripped. Never a path.
      expect(row.originalName).toBe('.._evil_Hợp đồng.pdf');
    });

    it('requires a file', async () => {
      const { service } = buildService([]);
      await expect(service.upload('org-a', 'u1', { employeeProfileId: 'p1' })).rejects.toThrow('EMPLOYEE_DOCUMENT_FILE_REQUIRED');
    });

    it('rejects an employee of another tenant (AC-CONTRACT-01)', async () => {
      const { service } = buildService([]);
      await expect(
        service.upload('org-a', 'u1', { employeeProfileId: 'p2' }, {
          originalname: 'x.pdf', mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x'),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates a DB failure and still attempts object cleanup', async () => {
      const { storage } = buildService([]);
      const failingDocModel: any = { create: async () => { throw new Error('db down'); } };
      const re = new EmployeeDocumentService(
        failingDocModel,
        buildProfileModel([profile]) as never,
        buildContractModel([contract]) as never,
        storage,
      );
      await expect(
        re.upload('org-a', 'u1', { employeeProfileId: 'p1' }, {
          originalname: 'x.pdf', mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x'),
        }),
      ).rejects.toThrow('db down');
      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(storage.remove).toHaveBeenCalledWith(expect.stringMatching(/^org-a\//));
    });
  });

  describe('access control', () => {
    it('404s a document of another tenant', async () => {
      const { service } = buildService([docRow({ _id: 'd1', organizationId: 'org-b' })]);
      await expect(service.getWithAccessCheck('org-a', 'd1')).rejects.toThrow(NotFoundException);
    });

    it('scopes self access to the owner profile', async () => {
      const { service } = buildService([docRow({ _id: 'd1', employeeProfileId: 'p1' })]);
      await expect(service.getWithAccessCheck('org-a', 'd1', 'p2')).rejects.toThrow(NotFoundException);
      const ok = await service.getWithAccessCheck('org-a', 'd1', 'p1');
      expect(ok._id).toBe('d1');
    });

    it('strips storageKey from list responses', async () => {
      const { service } = buildService([docRow({ _id: 'd1' })]);
      const rows = await service.findAll('org-a', {});
      expect(rows[0].storageKey).toBeUndefined();
      expect(rows[0].originalName).toBe('HDLD.pdf');
    });

    it('streams a stored download for the owner and not for non-owners', async () => {
      const { service } = buildService([docRow({ _id: 'd1' })]);
      const { stream } = await service.getStream('org-a', 'd1', 'p1');
      const buf = await new Promise<string>((resolve, reject) => {
        let acc = '';
        stream.on('data', (c: Buffer) => (acc += c.toString()));
        stream.on('end', () => resolve(acc));
        stream.on('error', reject);
      });
      expect(buf).toBe('pdf');
      await expect(service.getStream('org-a', 'd1', 'p2')).rejects.toThrow(NotFoundException);
    });

    it('deletes the row and best-effort removes the S3 object', async () => {
      const { service, storage } = buildService([docRow({ _id: 'd1' })]);
      await service.remove('org-a', 'd1');
      expect(storage.remove).toHaveBeenCalledWith('org-a/d1');
      await expect(service.getWithAccessCheck('org-a', 'd1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOwnProfile', () => {
    it('returns the caller profile id', async () => {
      const { service } = buildService([]);
      expect(await service.findOwnProfile('org-a', 'u1')).toEqual({ _id: 'p1' });
    });
  });
});