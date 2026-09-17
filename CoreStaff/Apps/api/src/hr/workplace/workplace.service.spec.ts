import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkplaceService } from './workplace.service';

/* ==========================================================================
   WorkplaceService — unit tests (no real MongoDB)
   Pattern follows: department.service.spec.ts / assignment.service.spec.ts
   Coverage: create, findAll, findOne, update, activate, deactivate
   ========================================================================== */

// ── Row shapes ──────────────────────────────────────────────────────────────

interface BaseRow extends Record<string, unknown> {
	_id: string;
	organizationId: string;
}

interface WorkplaceRow extends BaseRow {
	code: string;
	name: string;
	address?: string;
	latitude: number;
	longitude: number;
	allowedRadiusMeters: number;
	maximumAccuracyMeters: number;
	active: boolean;
	toObject(opts?: Record<string, unknown>): Record<string, unknown>;
	save(): Promise<unknown>;
}

interface AssignmentRow extends Record<string, unknown> {
	_id: string;
	workplaceId: string;
	active: boolean;
}

const DUPLICATE_KEY_ERROR = 11000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function matches(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
	return Object.entries(filter).every(([k, v]) => {
		if (typeof v === 'object' && v !== null && '$ne' in v) {
			return (row[k] as unknown) !== (v as { $ne: unknown }).$ne;
		}
		if (Array.isArray(v)) {
			// Handle $or array — match if any sub-filter matches
			return v.some((sub: Record<string, unknown>) => matches(row, sub));
		}
		return row[k] === v;
	});
}

/** Normalize code helper (same logic as service uses) */
function normalizeCode(code: string): string {
	return code.toUpperCase().trim();
}

/** Fake Mongoose model for Workplaces */
function buildWorkplaceModel(rows: WorkplaceRow[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<WorkplaceRow>) {
			const row: WorkplaceRow = {
				_id: String(nextId++),
				active: true,
				...doc,
			} as unknown as WorkplaceRow;
			rows.push(row);
			return {
				toObject(_opts?: Record<string, unknown>) {
					const { _id, organizationId, code, name, address, latitude, longitude, allowedRadiusMeters, maximumAccuracyMeters, active } = row;
					return { _id, organizationId, code, name, address, latitude, longitude, allowedRadiusMeters, maximumAccuracyMeters, active };
				},
			};
		},
		find(filter: Record<string, unknown>) {
			return {
				sort: () => ({
					lean: async () =>
						[...rows]
							.filter((r) => matches(r, filter))
							.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
				}),
			};
		},
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as WorkplaceRow | null,
			};
		},
		findById(id: string) {
			const r = rows.find((x) => x._id === id) ?? null;
			return {
				lean: async () => (r as WorkplaceRow | null),
			};
		},
		findOneAndUpdate(
			filter: Record<string, unknown>,
			update: { $set: Partial<WorkplaceRow> },
			opts?: { new: boolean },
		) {
			return {
				lean: async () => {
					const row = rows.find((r) => matches(r, filter));
					if (!row) return null;
					Object.assign(row, update.$set);
					return opts?.new ? (row as WorkplaceRow) : null;
				},
			};
		},
		findByIdAndUpdate(
			id: string,
			update: { $set: Partial<WorkplaceRow> } | Partial<WorkplaceRow>,
			opts?: { new: boolean },
		) {
			const row = rows.find((x) => x._id === id);
			if (!row) return { lean: async () => null };
			const patch = '$set' in update ? update.$set : update;
			Object.assign(row, patch);
			return {
				lean: async () => {
					if (!opts?.new) return null;
					return {
						toObject(_opts?: Record<string, unknown>) {
							const { _id, organizationId, code, name, address, latitude, longitude, allowedRadiusMeters, maximumAccuracyMeters, active } = row;
							return { _id, organizationId, code, name, address, latitude, longitude, allowedRadiusMeters, maximumAccuracyMeters, active };
						},
					} as unknown as WorkplaceRow;
				},
			};
		},
		countDocuments(filter: Record<string, unknown>) {
			const run = async () => rows.filter((r) => matches(r, filter)).length;
			return { exec: run };
		},
	};
}

/** Fake Mongoose model for Assignments */
function buildAssignmentModel(rows: AssignmentRow[]) {
	return {
		countDocuments(filter: Record<string, unknown>) {
			const run = async () => rows.filter((r) => matches(r, filter)).length;
			return { exec: run };
		},
	};
}

// ── Service builder ─────────────────────────────────────────────────────────

function buildService(workplaces: WorkplaceRow[], assignments: AssignmentRow[]) {
	return new WorkplaceService(
		buildWorkplaceModel(workplaces) as never,
		buildAssignmentModel(assignments) as never,
	);
}

// ── Seed helpers ────────────────────────────────────────────────────────────

function seedWorkplace(
	org: string,
	opts?: { id?: string; code?: string; name?: string; address?: string; latitude?: number; longitude?: number; allowedRadiusMeters?: number; maximumAccuracyMeters?: number; active?: boolean },
): WorkplaceRow {
	return {
		_id: opts?.id ?? `wp-${org}-1`,
		organizationId: org,
		code: opts?.code ?? normalizeCode('WP-001'),
		name: opts?.name ?? 'Workplace One',
		address: opts?.address ?? '123 Main St',
		latitude: opts?.latitude ?? 10.762622,
		longitude: opts?.longitude ?? 106.660247,
		allowedRadiusMeters: opts?.allowedRadiusMeters ?? 200,
		maximumAccuracyMeters: opts?.maximumAccuracyMeters ?? 100,
		active: opts?.active ?? true,
	} as unknown as WorkplaceRow;
}

function seedAssignment(opts: { workplaceId: string; active?: boolean }): AssignmentRow {
	return {
		_id: `asgn-${opts.workplaceId}`,
		workplaceId: opts.workplaceId,
		active: opts.active ?? true,
	};
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /hr/workplaces — WorkplaceService.create', () => {
	it('C1: creates a workplace successfully with all fields', async () => {
		const workplaces: WorkplaceRow[] = [];
		const svc = buildService(workplaces, []);

		const result = await svc.create('org1', {
			code: 'OUTDOOR-01',
			name: 'Công trường xây dựng',
			address: '123 Đường ABC, Quận 8, TP.HCM',
			latitude: 10.762622,
			longitude: 106.660247,
			allowedRadiusMeters: 200,
			maximumAccuracyMeters: 100,
		});

		expect(result).toMatchObject({
			organizationId: 'org1',
			code: 'OUTDOOR-01',
			name: 'Công trường xây dựng',
			address: '123 Đường ABC, Quận 8, TP.HCM',
			latitude: 10.762622,
			longitude: 106.660247,
			allowedRadiusMeters: 200,
			maximumAccuracyMeters: 100,
			active: true,
		});
	});

	it('C2: rejects duplicate code within the same tenant', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { code: 'WP-001', name: 'Existing' })];
		const svc = buildService(workplaces, []);

		await expect(
			svc.create('org1', {
				code: 'WP-001',
				name: 'Duplicate',
				address: '456 Other St',
				latitude: 10.8,
				longitude: 106.7,
				allowedRadiusMeters: 200,
				maximumAccuracyMeters: 100,
			}),
		).rejects.toThrow('WORKPLACE_CODE_ALREADY_EXISTS');
	});

	it('C3: rejects duplicate coordinates within the same tenant', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { code: 'WP-001', latitude: 10.762622, longitude: 106.660247 })];
		const svc = buildService(workplaces, []);

		await expect(
			svc.create('org1', {
				code: 'WP-002',
				name: 'Same Coords',
				address: '789 New St',
				latitude: 10.762622,
				longitude: 106.660247,
				allowedRadiusMeters: 200,
				maximumAccuracyMeters: 100,
			}),
		).rejects.toThrow('WORKPLACE_COORDINATES_ALREADY_EXISTS');
	});

	it('C4: allows same code/coords in different tenants', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { code: 'WP-001', latitude: 10.762622, longitude: 106.660247 })];
		const svc = buildService(workplaces, []);

		const result = await svc.create('org2', {
			code: 'WP-001',
			name: 'Same in Org2',
			address: 'Different Address',
			latitude: 10.762622,
			longitude: 106.660247,
			allowedRadiusMeters: 200,
			maximumAccuracyMeters: 100,
		});

		expect(result.organizationId).toBe('org2');
		expect(result.code).toBe('WP-001');
	});

	it('C5: maps duplicate key error to ConflictException', async () => {
		const workplaces: WorkplaceRow[] = [];
		const model = buildWorkplaceModel(workplaces);
		model.create = async (doc: any) => {
			const err = Object.assign(new Error('duplicate'), { code: DUPLICATE_KEY_ERROR });
			throw err;
		};

		const svc = new WorkplaceService(
			model as never,
			buildAssignmentModel([]) as never,
		);

		await expect(
			svc.create('org1', {
				code: 'WP-001',
				name: 'Test',
				address: 'Addr',
				latitude: 10.762622,
				longitude: 106.660247,
				allowedRadiusMeters: 200,
				maximumAccuracyMeters: 100,
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});
});

describe('GET /hr/workplaces — WorkplaceService.findAll', () => {
	it('returns all workplaces for the tenant', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { code: 'WP-001', name: 'Alpha' }),
			seedWorkplace('org1', { code: 'WP-002', name: 'Beta' }),
		];
		const svc = buildService(workplaces, []);

		const results = await svc.findAll('org1');
		expect(results).toHaveLength(2);
	});

	it('filters by active: true', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { code: 'WP-001', name: 'Active', active: true }),
			seedWorkplace('org1', { code: 'WP-002', name: 'Inactive', active: false }),
		];
		const svc = buildService(workplaces, []);

		const results = await svc.findAll('org1', true);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(true);
	});

	it('filters by active: false', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { code: 'WP-001', name: 'Active', active: true }),
			seedWorkplace('org1', { code: 'WP-002', name: 'Inactive', active: false }),
		];
		const svc = buildService(workplaces, []);

		const results = await svc.findAll('org1', false);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(false);
	});

	it('searches by code (case-insensitive)', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { code: 'HQ-MAIN', name: 'Headquarters' }),
			seedWorkplace('org1', { code: 'WP-001', name: 'Other' }),
		];
		const svc = buildService(workplaces, []);

		const results = await svc.findAll('org1', undefined, 'hq-main');
		expect(results).toHaveLength(1);
		expect(results[0].code).toBe('HQ-MAIN');
	});

	it('searches by name or address (case-insensitive)', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { code: 'WP-001', name: 'Building A', address: '123 Main St' }),
			seedWorkplace('org1', { code: 'WP-002', name: 'Building B', address: '456 Oak Ave' }),
		];
		const svc = buildService(workplaces, []);

		const results = await svc.findAll('org1', undefined, 'main');
		expect(results).toHaveLength(1);
		expect(results[0].address).toContain('Main St');
	});
});

describe('GET /hr/workplaces/:id — WorkplaceService.findOne', () => {
	it('returns the workplace when it belongs to the tenant', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', code: 'WP-001' })];
		const svc = buildService(workplaces, []);

		const result = await svc.findOne('org1', 'wp1');
		expect(result._id).toBe('wp1');
		expect(result.organizationId).toBe('org1');
	});

	it('throws NotFoundException when workplace is in a different tenant', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', code: 'WP-001' })];
		const svc = buildService(workplaces, []);

		await expect(svc.findOne('org2', 'wp1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('throws NotFoundException when workplace id does not exist', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', code: 'WP-001' })];
		const svc = buildService(workplaces, []);

		await expect(svc.findOne('org1', 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/workplaces/:id — WorkplaceService.update', () => {
	it('U1: updates name and address successfully', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', code: 'WP-001', name: 'Old Name' })];
		const svc = buildService(workplaces, []);

		const result = await svc.update('org1', 'wp1', {
			name: 'New Name',
			address: 'New Address',
		});
		expect(result.name).toBe('New Name');
		expect(result.address).toBe('New Address');
	});

	it('U2: rejects duplicate coordinates within the same tenant', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { id: 'wp1', code: 'WP-001', latitude: 10.762622, longitude: 106.660247 }),
			seedWorkplace('org1', { id: 'wp2', code: 'WP-002', latitude: 10.8, longitude: 106.7 }),
		];
		const svc = buildService(workplaces, []);

		await expect(
			svc.update('org1', 'wp1', {
				latitude: 10.8,
				longitude: 106.7,
			}),
		).rejects.toThrow('WORKPLACE_COORDINATES_ALREADY_EXISTS');
	});

	it('U3: throws NotFoundException when workplace does not exist', async () => {
		const workplaces: WorkplaceRow[] = [];
		const svc = buildService(workplaces, []);

		await expect(svc.update('org1', 'nonexistent', { name: 'New Name' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('U4: normalizes code when updating code field', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', code: 'WP-001' })];
		const svc = buildService(workplaces, []);

		const result = await svc.update('org1', 'wp1', {
			code: '  new-code  ',
		});
		expect(result.code).toBe('NEW-CODE');
	});

	it('U5: does not check duplicate coordinates when lat/lon are not updated', async () => {
		const workplaces: WorkplaceRow[] = [
			seedWorkplace('org1', { id: 'wp1', code: 'WP-001', latitude: 10.762622, longitude: 106.660247 }),
			seedWorkplace('org1', { id: 'wp2', code: 'WP-002', latitude: 10.762622, longitude: 106.660247 }),
		];
		const svc = buildService(workplaces, []);

		// Should succeed because we're only updating name, not coordinates
		const result = await svc.update('org1', 'wp1', {
			name: 'Updated Name',
		});
		expect(result.name).toBe('Updated Name');
	});
});

describe('PATCH /hr/workplaces/:id/activate — WorkplaceService.setActive', () => {
	it('A1: reactivates an inactive workplace', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', active: false })];
		const svc = buildService(workplaces, []);

		const result = await svc.setActive('org1', 'wp1', true);
		expect(result).not.toBeNull();
		expect((result as unknown as Record<string, unknown>).active).toBe(true);
	});

	it('A2: throws NotFoundException when workplace does not exist', async () => {
		const workplaces: WorkplaceRow[] = [];
		const svc = buildService(workplaces, []);

		await expect(svc.setActive('org1', 'nonexistent', true)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('A3: throws NotFoundException when workplace belongs to a different tenant', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', active: false })];
		const svc = buildService(workplaces, []);

		await expect(svc.setActive('org2', 'wp1', true)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/workplaces/:id/deactivate — WorkplaceService.setActive', () => {
	it('D1: deactivates a workplace with no active assignments', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', active: true })];
		const svc = buildService(workplaces, []);

		const result = await svc.setActive('org1', 'wp1', false);
		expect(result).not.toBeNull();
		expect((result as unknown as Record<string, unknown>).active).toBe(false);
	});

	it('D2: cannot deactivate if still in use by active assignments', async () => {
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', { id: 'wp1', active: true })];
		const assignments: AssignmentRow[] = [seedAssignment({ workplaceId: 'wp1', active: true })];
		const svc = buildService(workplaces, assignments);

		await expect(svc.setActive('org1', 'wp1', false)).rejects.toBeInstanceOf(ConflictException);
	});

	it('D3: throws NotFoundException when workplace does not exist', async () => {
		const workplaces: WorkplaceRow[] = [];
		const svc = buildService(workplaces, []);

		await expect(svc.setActive('org1', 'nonexistent', false)).rejects.toBeInstanceOf(NotFoundException);
	});
});
