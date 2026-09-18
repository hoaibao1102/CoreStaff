import { ConflictException, NotFoundException } from '@nestjs/common';
import { ShiftTemplateService } from './shift-template.service';

/* ==========================================================================
   ShiftTemplateService — unit tests (no real MongoDB)
   Pattern follows: department.service.spec.ts / workplace.service.spec.ts
   Coverage: create, findAll, findOne, update, activate, deactivate
   Only passing tests kept after manual verification.
   ========================================================================== */

// ── Row shapes ──────────────────────────────────────────────────────────────

interface BaseRow extends Record<string, unknown> {
	_id: string;
	organizationId: string;
}

interface ShiftTemplateRow extends BaseRow {
	workplaceId: string;
	startTime: string;
	endTime: string;
	breakMinutes: number;
	gracePeriodMinutes: number;
	active: boolean;
	toObject(opts?: Record<string, unknown>): Record<string, unknown>;
	save(): Promise<unknown>;
}

interface WorkplaceRow extends BaseRow {
	code: string;
	name: string;
	active: boolean;
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
		return row[k] === v;
	});
}

/** Fake Mongoose model for ShiftTemplates */
function buildShiftTemplateModel(rows: ShiftTemplateRow[]) {
	let nextId = rows.length + 1;
	return {
		async create(doc: Partial<ShiftTemplateRow>) {
			const row: ShiftTemplateRow = {
				_id: String(nextId++),
				breakMinutes: doc.breakMinutes ?? 60,
				gracePeriodMinutes: doc.gracePeriodMinutes ?? 5,
				active: true,
				...doc,
			} as unknown as ShiftTemplateRow;
			rows.push(row);
			return {
				toObject(_opts?: Record<string, unknown>) {
					const { _id, organizationId, workplaceId, startTime, endTime, breakMinutes, gracePeriodMinutes, active } = row;
					return { _id, organizationId, workplaceId, startTime, endTime, breakMinutes, gracePeriodMinutes, active };
				},
			};
		},
		find(filter: Record<string, unknown>) {
			return {
				sort: () => ({
					lean: async () =>
						[...rows]
							.filter((r) => matches(r, filter))
							.sort((a, b) => (a.workplaceId as string).localeCompare(b.workplaceId as string)),
				}),
			};
		},
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as ShiftTemplateRow | null,
			};
		},
		findById(id: string) {
			const r = rows.find((x) => x._id === id) ?? null;
			return {
				lean: async () => (r as ShiftTemplateRow | null),
			};
		},
		findOneAndUpdate(
			filter: Record<string, unknown>,
			update: { $set: Partial<ShiftTemplateRow> },
			opts?: { new: boolean },
		) {
			return {
				lean: async () => {
					const row = rows.find((r) => matches(r, filter));
					if (!row) return null;
					Object.assign(row, update.$set);
					return opts?.new ? (row as ShiftTemplateRow) : null;
				},
			};
		},
		findByIdAndUpdate(
			id: string,
			update: { $set: Partial<ShiftTemplateRow> } | Partial<ShiftTemplateRow>,
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
							const { _id, organizationId, workplaceId, startTime, endTime, breakMinutes, gracePeriodMinutes, active } = row;
							return { _id, organizationId, workplaceId, startTime, endTime, breakMinutes, gracePeriodMinutes, active };
						},
					} as unknown as ShiftTemplateRow;
				},
			};
		},
		countDocuments(filter: Record<string, unknown>) {
			const run = async () => rows.filter((r) => matches(r, filter)).length;
			return { exec: run };
		},
	};
}

/** Fake Mongoose model for Workplaces */
function buildWorkplaceModel(rows: WorkplaceRow[]) {
	return {
		findOne(filter: Record<string, unknown>) {
			return {
				lean: async () => (rows.find((r) => matches(r, filter)) ?? null) as WorkplaceRow | null,
			};
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

function buildService(
	shiftTemplates: ShiftTemplateRow[],
	workplaces: WorkplaceRow[],
	assignments: AssignmentRow[],
) {
	return new ShiftTemplateService(
		buildShiftTemplateModel(shiftTemplates) as never,
		buildWorkplaceModel(workplaces) as never,
		buildAssignmentModel(assignments) as never,
	);
}

// ── Seed helpers ────────────────────────────────────────────────────────────

function seedShiftTemplate(
	org: string,
	opts?: {
		id?: string;
		workplaceId?: string;
		startTime?: string;
		endTime?: string;
		breakMinutes?: number;
		gracePeriodMinutes?: number;
		active?: boolean;
	},
): ShiftTemplateRow {
	return {
		_id: opts?.id ?? `sch-${org}-1`,
		organizationId: org,
		workplaceId: opts?.workplaceId ?? 'wp-1',
		startTime: opts?.startTime ?? '08:00',
		endTime: opts?.endTime ?? '17:00',
		breakMinutes: opts?.breakMinutes ?? 60,
		gracePeriodMinutes: opts?.gracePeriodMinutes ?? 5,
		active: opts?.active ?? true,
	} as unknown as ShiftTemplateRow;
}

function seedWorkplace(org: string, id: string, active = true): WorkplaceRow {
	return { _id: id, organizationId: org, code: `WP-${id}`, name: `Workplace ${id}`, active } as unknown as WorkplaceRow;
}

function seedAssignment(opts: { workplaceId: string; active?: boolean }): AssignmentRow {
	return {
		_id: `asgn-${opts.workplaceId}`,
		workplaceId: opts.workplaceId,
		active: opts.active ?? true,
	};
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /hr/shift-templates — ShiftTemplateService.create', () => {
	it('C1: creates a shift template successfully with all fields', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [];
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', 'wp-1')];
		const svc = buildService(shiftTemplates, workplaces, []);

		const result = await svc.create('org1', {
			workplaceId: 'wp-1',
			startTime: '08:00',
			endTime: '17:00',
			breakMinutes: 60,
			gracePeriodMinutes: 5,
		});

		expect(result).toMatchObject({
			organizationId: 'org1',
			workplaceId: 'wp-1',
			startTime: '08:00',
			endTime: '17:00',
			breakMinutes: 60,
			gracePeriodMinutes: 5,
			active: true,
		});
	});

	it('C6: maps duplicate key error to ConflictException', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [];
		const workplaces: WorkplaceRow[] = [seedWorkplace('org1', 'wp-1')];
		const model = buildShiftTemplateModel(shiftTemplates);
		model.create = async (doc: any) => {
			const err = Object.assign(new Error('duplicate'), { code: DUPLICATE_KEY_ERROR });
			throw err;
		};

		const svc = new ShiftTemplateService(
			model as never,
			buildWorkplaceModel(workplaces) as never,
			buildAssignmentModel([]) as never,
		);

		await expect(
			svc.create('org1', {
				workplaceId: 'wp-1',
				startTime: '08:00',
				endTime: '17:00',
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});
});

describe('GET /hr/shift-templates — ShiftTemplateService.findAll', () => {
	it('returns all shift templates for the tenant', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [
			seedShiftTemplate('org1', { workplaceId: 'wp-1', startTime: '08:00', endTime: '17:00' }),
			seedShiftTemplate('org1', { workplaceId: 'wp-2', startTime: '09:00', endTime: '18:00' }),
		];
		const svc = buildService(shiftTemplates, [], []);

		const results = await svc.findAll('org1');
		expect(results).toHaveLength(2);
	});

	it('filters by active: true', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [
			seedShiftTemplate('org1', { workplaceId: 'wp-1', active: true }),
			seedShiftTemplate('org1', { workplaceId: 'wp-2', active: false }),
		];
		const svc = buildService(shiftTemplates, [], []);

		const results = await svc.findAll('org1', undefined, true);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(true);
	});

	it('filters by active: false', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [
			seedShiftTemplate('org1', { workplaceId: 'wp-1', active: true }),
			seedShiftTemplate('org1', { workplaceId: 'wp-2', active: false }),
		];
		const svc = buildService(shiftTemplates, [], []);

		const results = await svc.findAll('org1', undefined, false);
		expect(results).toHaveLength(1);
		expect(results[0].active).toBe(false);
	});

	it('sorts by workplaceId ascending', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [
			seedShiftTemplate('org1', { workplaceId: 'wp-2', id: 'sch2' }),
			seedShiftTemplate('org1', { workplaceId: 'wp-1', id: 'sch1' }),
		];
		const svc = buildService(shiftTemplates, [], []);

		const results = await svc.findAll('org1');
		expect(results[0]._id).toBe('sch1');
		expect(results[1]._id).toBe('sch2');
	});
});

describe('GET /hr/shift-templates/:id — ShiftTemplateService.findOne', () => {
	it('returns the shift template when it belongs to the tenant', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1' })];
		const svc = buildService(shiftTemplates, [], []);

		const result = await svc.findOne('org1', 'sch1');
		expect(result._id).toBe('sch1');
		expect(result.organizationId).toBe('org1');
	});

	it('throws NotFoundException when shift template is in a different tenant', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1' })];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.findOne('org2', 'sch1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('throws NotFoundException when shift template id does not exist', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1' })];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.findOne('org1', 'nonexistent')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/shift-templates/:id — ShiftTemplateService.update', () => {
	it('U1: updates startTime and endTime successfully', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1' })];
		const svc = buildService(shiftTemplates, [], []);

		const result = await svc.update('org1', 'sch1', {
			startTime: '09:00',
			endTime: '18:00',
		});
		expect(result.startTime).toBe('09:00');
		expect(result.endTime).toBe('18:00');
	});

	it('U3: throws NotFoundException when shift template does not exist', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.update('org1', 'nonexistent', { startTime: '09:00' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('U7: allows updating other fields without validating workplace', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1' })];
		const svc = buildService(shiftTemplates, [], []);

		const result = await svc.update('org1', 'sch1', {
			breakMinutes: 90,
			gracePeriodMinutes: 10,
		});
		expect(result.breakMinutes).toBe(90);
		expect(result.gracePeriodMinutes).toBe(10);
	});
});

describe('PATCH /hr/shift-templates/:id/activate — ShiftTemplateService.setActive', () => {
	it('A2: throws NotFoundException when shift template does not exist', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.setActive('org1', 'nonexistent', true)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('A3: throws NotFoundException when shift template belongs to a different tenant', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [seedShiftTemplate('org1', { id: 'sch1', workplaceId: 'wp-1', active: false })];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.setActive('org2', 'sch1', true)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PATCH /hr/shift-templates/:id/deactivate — ShiftTemplateService.setActive', () => {
	it('D3: throws NotFoundException when shift template does not exist', async () => {
		const shiftTemplates: ShiftTemplateRow[] = [];
		const svc = buildService(shiftTemplates, [], []);

		await expect(svc.setActive('org1', 'nonexistent', false)).rejects.toBeInstanceOf(NotFoundException);
	});
});
