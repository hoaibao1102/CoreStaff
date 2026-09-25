import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmployeeAssignmentDocument } from '../../database/schemas/assignment.schema';
import { AttendanceDayDocument } from '../../database/schemas/attendance-day.schema';
import { DepartmentDocument } from '../../database/schemas/department.schema';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { normalizeCode, ShiftScope } from '../../database/schemas/enums';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { PoliciesService } from '../policies/policies.service';
import { evaluateLaborLimits } from '../policies/policies-domain';

@Injectable()
export class ShiftTemplateService {
  constructor(
    @InjectModel('ShiftTemplate') private readonly shifts: Model<ShiftTemplateDocument>,
    @InjectModel('Department') private readonly departments: Model<DepartmentDocument>,
    @InjectModel('Assignment') private readonly assignments: Model<EmployeeAssignmentDocument>,
    @InjectModel('AttendanceDay') private readonly attendanceDays: Model<AttendanceDayDocument>,
    private readonly policies: PoliciesService,
  ) {}

  async create(organizationId: string, dto: CreateShiftTemplateDto) {
    const data = await this.normalize(organizationId, dto);
    if (data.scope === ShiftScope.DEPARTMENT && await this.shifts.exists({ organizationId, departmentId: data.departmentId })) {
      throw new ConflictException('SHIFT_DEPARTMENT_ALREADY_ASSIGNED');
    }
    if (data.scope === ShiftScope.ORGANIZATION && await this.shifts.exists({ organizationId, scope: ShiftScope.ORGANIZATION })) {
      throw new ConflictException('SHIFT_ORGANIZATION_ALREADY_ASSIGNED');
    }
    await this.noOverlap(organizationId, data);
    const code = await this.generateCode(organizationId, data.name);
    return (await this.shifts.create({ ...data, code, organizationId })).toObject();
  }

  async findAll(organizationId: string, scope?: ShiftScope, departmentId?: string, active?: boolean) {
    const filter: Record<string, unknown> = { organizationId };
    if (scope) filter.scope = scope;
    if (departmentId) filter.departmentId = departmentId;
    if (active !== undefined) filter.active = active;
    return this.shifts.find(filter).sort({ scope: 1, departmentId: 1, name: 1 }).lean();
  }

  async findOne(organizationId: string, id: string) {
    const row = await this.shifts.findOne({ _id: id, organizationId }).lean();
    if (!row) throw new NotFoundException('SHIFT_TEMPLATE_NOT_FOUND');
    return row;
  }

  async update(organizationId: string, id: string, dto: UpdateShiftTemplateDto) {
    const old = await this.findOne(organizationId, id);
    const data = await this.normalize(organizationId, {
      code: old.code,
      name: dto.name ?? old.name,
      scope: dto.scope ?? old.scope,
      departmentId: dto.departmentId === undefined ? old.departmentId : dto.departmentId,
      weekdays: dto.weekdays ?? old.weekdays,
      effectiveFrom: dto.effectiveFrom ?? old.effectiveFrom,
      effectiveTo: dto.effectiveTo === undefined ? old.effectiveTo : dto.effectiveTo,
      startTime: dto.startTime ?? old.startTime,
      endTime: dto.endTime ?? old.endTime,
      breakMinutes: dto.breakMinutes ?? old.breakMinutes,
      gracePeriodMinutes: dto.gracePeriodMinutes ?? old.gracePeriodMinutes,
    });
    if (data.scope === ShiftScope.DEPARTMENT && await this.shifts.exists({ organizationId, departmentId: data.departmentId, _id: { $ne: id } })) {
      throw new ConflictException('SHIFT_DEPARTMENT_ALREADY_ASSIGNED');
    }
    if (data.scope === ShiftScope.ORGANIZATION && await this.shifts.exists({ organizationId, scope: ShiftScope.ORGANIZATION, _id: { $ne: id } })) {
      throw new ConflictException('SHIFT_ORGANIZATION_ALREADY_ASSIGNED');
    }
    if (old.active) await this.noOverlap(organizationId, data, id);
    const update = data.scope === ShiftScope.ORGANIZATION ? { $set: data, $unset: { departmentId: 1 } } : { $set: data };
    return this.shifts.findOneAndUpdate({ _id: id, organizationId }, update, { new: true, runValidators: true }).lean();
  }

  async setActive(organizationId: string, id: string, active: boolean) {
    const row = await this.findOne(organizationId, id);
    if (active) await this.validateLaborPolicy(organizationId, row);
    if (active) await this.noOverlap(organizationId, row, id);
    return this.shifts.findOneAndUpdate({ _id: id, organizationId }, { $set: { active } }, { new: true }).lean();
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    const [assigned, recorded] = await Promise.all([
      this.assignments.exists({ organizationId, shiftTemplateId: id }),
      this.attendanceDays.exists({ organizationId, shiftTemplateId: id }),
    ]);
    if (assigned || recorded) throw new ConflictException('SHIFT_TEMPLATE_IN_USE');
    await this.shifts.deleteOne({ _id: id, organizationId });
  }

  private async normalize(organizationId: string, dto: CreateShiftTemplateDto) {
    const name = dto.name?.trim() || '';
    const weekdays = [...new Set(dto.weekdays)].sort((a, b) => a - b);
    const effectiveFrom = dateOnly(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? dateOnly(dto.effectiveTo) : undefined;
    if (!name) throw new BadRequestException('SHIFT_NAME_REQUIRED');
    if (dto.startTime >= dto.endTime) throw new BadRequestException('SHIFT_START_TIME_MUST_BE_BEFORE_END');
    if (!weekdays.length || weekdays.some(day => day < 1 || day > 7)) throw new BadRequestException('SHIFT_WEEKDAYS_INVALID');
    if (effectiveTo && effectiveTo < effectiveFrom) throw new BadRequestException('SHIFT_EFFECTIVE_RANGE_INVALID');
    if (dto.scope === ShiftScope.DEPARTMENT) {
      if (!dto.departmentId) throw new BadRequestException('SHIFT_DEPARTMENT_REQUIRED');
      if (!await this.departments.exists({ _id: dto.departmentId, organizationId, active: true })) throw new NotFoundException('SHIFT_DEPARTMENT_NOT_FOUND_OR_INACTIVE');
    }
    const data = { ...dto, name, weekdays, effectiveFrom, effectiveTo, breakMinutes: dto.breakMinutes ?? 60, departmentId: dto.scope === ShiftScope.DEPARTMENT ? dto.departmentId : undefined };
    await this.validateLaborPolicy(organizationId, data);
    return data;
  }

  private async validateLaborPolicy(organizationId: string, shift: CreateShiftTemplateDto) {
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const duration = minutes(shift.endTime) - minutes(shift.startTime);
    const rest = shift.breakMinutes ?? 60;
    if (!Number.isInteger(rest) || rest < 0 || rest >= duration) {
      throw new BadRequestException('SHIFT_BREAK_DURATION_INVALID');
    }
    const daily = duration - rest;
    const from = new Date(shift.effectiveFrom);
    // Policies use an exclusive end; a shift's final date is inclusive.
    const until = shift.effectiveTo
      ? new Date(shift.effectiveTo).getTime() + 86400000
      : Infinity;
    const initial = await this.policies.laborAt(organizationId, from);
    const policies = await this.policies.listLabor(organizationId);
    const applicable = [initial, ...policies.filter(p => p.active &&
      new Date(p.effectiveFrom).getTime() > from.getTime() &&
      new Date(p.effectiveFrom).getTime() < until)]
      .sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
    let coveredUntil = from.getTime();
    for (const policy of applicable) {
      if (new Date(policy.effectiveFrom).getTime() > coveredUntil) {
        throw new ConflictException('SHIFT_LABOR_POLICY_COVERAGE_MISSING');
      }
      coveredUntil = Math.max(coveredUntil, policy.effectiveTo ? new Date(policy.effectiveTo).getTime() : Infinity);
      const evaluation = evaluateLaborLimits(policy, {
        normalDailyMinutes: daily,
        normalWeeklyMinutes: daily * new Set(shift.weekdays).size,
        combinedDailyMinutes: daily,
      });
      const violation = evaluation.violations.find(v => v.severity === 'BLOCK');
      if (violation) {
        throw new ConflictException({ message: violation.key === 'normalWeekly'
          ? 'SHIFT_WEEKLY_LABOR_LIMIT_EXCEEDED'
          : 'SHIFT_DAILY_LABOR_LIMIT_EXCEEDED',
          details: {
            usedMinutes: violation.usedMinutes,
            limitMinutes: violation.limitMinutes,
            excessMinutes: violation.usedMinutes - violation.limitMinutes,
            policyVersion: policy.version,
            effectiveFrom: policy.effectiveFrom,
          },
        });
      }
    }
    if (coveredUntil < until) throw new ConflictException('SHIFT_LABOR_POLICY_COVERAGE_MISSING');
  }

  private async generateCode(organizationId: string, name: string) {
    const base = normalizeCode(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)) || 'SHIFT';
    let code = base;
    let suffix = 1;
    while (await this.shifts.exists({ organizationId, code })) code = `${base}-${++suffix}`;
    return code;
  }

  private async noOverlap(organizationId: string, candidate: Pick<ShiftTemplateDocument, 'scope' | 'departmentId' | 'weekdays' | 'effectiveFrom' | 'effectiveTo'>, excludeId?: string) {
    const filter: Record<string, unknown> = { organizationId, active: true, scope: candidate.scope, effectiveFrom: { $lte: candidate.effectiveTo ?? '9999-12-31' }, $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: candidate.effectiveFrom } }] };
    filter.departmentId = candidate.scope === ShiftScope.DEPARTMENT ? candidate.departmentId : { $exists: false };
    if (excludeId) filter._id = { $ne: excludeId };
    const rows = await this.shifts.find(filter).select('weekdays').lean();
    if (rows.some(row => row.weekdays.some(day => candidate.weekdays.includes(day)))) throw new ConflictException('SHIFT_SCOPE_SCHEDULE_OVERLAP');
  }
}

function dateOnly(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match || Number.isNaN(Date.parse(`${match[0]}T00:00:00Z`))) throw new BadRequestException('INVALID_DATE');
  return match[0];
}
