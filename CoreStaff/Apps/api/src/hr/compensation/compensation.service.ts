import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AllowanceCatalog, AttendanceBonusPolicy, AttendanceBonusTemplate, KpiPayrollInput, KpiPolicy,
  KpiStatus, LaborCompliancePolicy, OrganizationAllowance, SalaryProfile,
} from '../../database/schemas/compensation.schema';
import { EmployeeProfile } from '../../database/schemas/employee-profile.schema';
import { assertNoEffectiveOverlap, calculateProbationRate, evaluateAttendanceBonus, resolveConfirmedKpiAmount } from './compensation-domain';
import { CreateAllowanceDto, CreateBonusPolicyDto, CreateKpiInputDto, CreateKpiPolicyDto, CreateSalaryProfileDto, UpdateAllowanceDto, UpdateBonusPolicyDto, UpdateKpiInputDto, UpdateKpiPolicyDto, UpdateSalaryProfileDto } from './dto/compensation.dto';

const duplicate = (e: unknown, code: string): never => {
  if (e && typeof e === 'object' && (e as { code?: number }).code === 11000) throw new ConflictException(code);
  throw e;
};
const date = (v: string | Date) => v instanceof Date ? v : new Date(v);

@Injectable()
export class CompensationService {
  constructor(
    @InjectModel('SalaryProfile') private readonly salaries: Model<SalaryProfile>,
    @InjectModel('LaborCompliancePolicy') private readonly laborPolicies: Model<LaborCompliancePolicy>,
    @InjectModel('AllowanceCatalog') private readonly catalog: Model<AllowanceCatalog>,
    @InjectModel('OrganizationAllowance') private readonly allowances: Model<OrganizationAllowance>,
    @InjectModel('AttendanceBonusTemplate') private readonly bonusTemplates: Model<AttendanceBonusTemplate>,
    @InjectModel('AttendanceBonusPolicy') private readonly bonusPolicies: Model<AttendanceBonusPolicy>,
    @InjectModel('KpiPayrollInput') private readonly kpis: Model<KpiPayrollInput>,
    @InjectModel('KpiPolicy') private readonly kpiPolicies: Model<KpiPolicy>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfile>,
  ) {}

  private async assertEmployee(org: string, id: string) {
    if (!(await this.employees.exists({ _id: id, organizationId: org }))) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');
  }
  private async effectivePolicy(org: string, at: Date) {
    const row = await this.laborPolicies.findOne({ organizationId: org, active: true, effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] }).sort({ effectiveFrom: -1 }).lean();
    if (!row) throw new NotFoundException('LABOR_POLICY_NOT_FOUND');
    return row;
  }
  private async validateRefs(org: string, dto: CreateSalaryProfileDto) {
    const at = date(dto.effectiveFrom);
    const allowanceIds = dto.organizationAllowanceIds?.length
      ? dto.organizationAllowanceIds
      : (dto.allowances?.map(a => a.allowanceId) ?? []);
    if (allowanceIds.length) {
      const count = await this.allowances.countDocuments({ _id: { $in: allowanceIds }, organizationId: org, active: true, effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] });
      if (count !== new Set(allowanceIds).size) throw new BadRequestException('ALLOWANCE_CROSS_TENANT_FORBIDDEN');
    }
    if (dto.attendanceBonusPolicyId && !(await this.bonusPolicies.exists({ _id: dto.attendanceBonusPolicyId, organizationId: org, active: true }))) throw new BadRequestException('ATTENDANCE_BONUS_POLICY_INVALID');
  }

  async createSalary(org: string, dto: CreateSalaryProfileDto) {
    await this.assertEmployee(org, dto.employeeId); await this.validateRefs(org, dto);
    const start = date(dto.effectiveFrom), end = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const existing = await this.salaries.find({ organizationId: org, employeeProfileId: dto.employeeId, active: true }).lean();
    assertNoEffectiveOverlap(existing.map(x => ({ effectiveFrom: x.effectiveFrom, effectiveTo: x.effectiveTo })), start, end);
    let probationRate: number | undefined;
    if (dto.probationJobSalary !== undefined || dto.probationAgreedSalary !== undefined) {
      if (!dto.probationJobSalary || !dto.probationAgreedSalary) throw new BadRequestException('INVALID_PROBATION_SALARY');
      probationRate = calculateProbationRate(dto.probationJobSalary, dto.probationAgreedSalary, (await this.effectivePolicy(org, start)).probationMinimumRate);
    }
    const latest = await this.salaries.findOne({ organizationId: org, employeeProfileId: dto.employeeId }).sort({ version: -1 }).lean();
    const allowanceIds = dto.organizationAllowanceIds?.length
      ? dto.organizationAllowanceIds
      : (dto.allowances?.map(a => a.allowanceId) ?? []);
    const allowances = dto.allowances ?? allowanceIds.map(id => ({ allowanceId: id, amount: 0 }));
    const row = await this.salaries.create({
      ...dto,
      organizationAllowanceIds: allowanceIds,
      allowances,
      employeeProfileId: dto.employeeId,
      organizationId: org,
      effectiveFrom: start,
      effectiveTo: end,
      probationRate,
      version: (latest?.version ?? 0) + 1,
    });
    return row.toObject();
  }
  async listSalaries(org: string, employeeId?: string) {
    const list = await this.salaries.find({ organizationId: org, ...(employeeId && { employeeProfileId: employeeId }) }).sort({ effectiveFrom: -1 }).lean();
    if (!list.length) return [];
    const empIds = [...new Set(list.map(s => s.employeeProfileId))];
    const empDocs = await this.employees.find({ organizationId: org, _id: { $in: empIds } }).select('_id employeeCode').lean();
    const empMap = new Map(empDocs.map(e => [String(e._id), e]));
    return list.map(item => {
      const emp = empMap.get(String(item.employeeProfileId));
      return {
        ...item,
        employeeCode: emp?.employeeCode ?? null,
      };
    });
  }
  async effectiveSalary(org: string, employeeId: string, at: Date) {
    await this.assertEmployee(org, employeeId);
    return this.salaries.findOne({ organizationId: org, employeeProfileId: employeeId, active: true, effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] }).sort({ effectiveFrom: -1 }).lean();
  }
  async updateSalary(org: string, id: string, dto: UpdateSalaryProfileDto) {
    const old = await this.salaries.findOne({ _id: id, organizationId: org }).lean(); if (!old) throw new NotFoundException('SALARY_PROFILE_NOT_FOUND');
    const merged = { ...old, ...dto, employeeId: String(old.employeeProfileId), effectiveFrom: dto.effectiveFrom ?? old.effectiveFrom.toISOString(), effectiveTo: dto.effectiveTo ?? old.effectiveTo?.toISOString() } as CreateSalaryProfileDto;
    await this.validateRefs(org, merged);
    const start = date(merged.effectiveFrom), end = merged.effectiveTo ? date(merged.effectiveTo) : undefined;
    const others = await this.salaries.find({ organizationId: org, employeeProfileId: old.employeeProfileId, active: true, _id: { $ne: id } }).lean();
    assertNoEffectiveOverlap(others.map(x => ({ effectiveFrom: x.effectiveFrom, effectiveTo: x.effectiveTo })), start, end);
    let probationRate = old.probationRate;
    if (merged.probationJobSalary && merged.probationAgreedSalary) probationRate = calculateProbationRate(merged.probationJobSalary, merged.probationAgreedSalary, (await this.effectivePolicy(org, start)).probationMinimumRate);
    const allowanceIds = merged.organizationAllowanceIds?.length
      ? merged.organizationAllowanceIds
      : (merged.allowances?.map(a => a.allowanceId) ?? []);
    const allowances = merged.allowances ?? old.allowances ?? allowanceIds.map(aId => ({ allowanceId: aId, amount: 0 }));
    return this.salaries.findOneAndUpdate(
      { _id: id, organizationId: org },
      { $set: { ...dto, organizationAllowanceIds: allowanceIds, allowances, effectiveFrom: start, effectiveTo: end, probationRate } },
      { new: true, runValidators: true },
    ).lean();
  }

  listCatalog() { return this.catalog.find({ active: true }).sort({ code: 1 }).lean(); }
  listAllowances(org: string) { return this.allowances.find({ organizationId: org }).sort({ code: 1 }).lean(); }
  async createAllowance(org: string, dto: CreateAllowanceDto) {
    let seed: AllowanceCatalog | null = null;
    if (dto.catalogId) { seed = await this.catalog.findOne({ _id: dto.catalogId, active: true }).lean(); if (!seed) throw new NotFoundException('ALLOWANCE_CATALOG_NOT_FOUND'); }
    if (!seed && (!dto.code || !dto.name)) throw new BadRequestException('ALLOWANCE_CODE_NAME_REQUIRED');
    const start = date(dto.effectiveFrom), end = dto.effectiveTo ? date(dto.effectiveTo) : undefined; assertNoEffectiveOverlap([], start, end);
    try { const row = await this.allowances.create({ organizationId: org, catalogId: dto.catalogId, code: (dto.code ?? seed!.code).trim().toUpperCase(), name: dto.name ?? seed!.defaultName, amount: dto.amount ?? 0, taxable: dto.taxable ?? seed?.defaultTaxable ?? true, insuranceBased: dto.insuranceBased ?? seed?.defaultInsuranceBased ?? false, prorated: dto.prorated ?? false, effectiveFrom: start, effectiveTo: end }); return row.toObject(); } catch (e) { return duplicate(e, 'ALLOWANCE_CODE_TAKEN'); }
  }
  async updateAllowance(org: string, id: string, dto: UpdateAllowanceDto) {
    const patch: Record<string, unknown> = { ...dto }; if (dto.code) patch.code = dto.code.trim().toUpperCase(); if (dto.effectiveFrom) patch.effectiveFrom = date(dto.effectiveFrom); if (dto.effectiveTo) patch.effectiveTo = date(dto.effectiveTo);
    try { const row = await this.allowances.findOneAndUpdate({ _id: id, organizationId: org }, { $set: patch, $inc: { version: 1 } }, { new: true, runValidators: true }).lean(); if (!row) throw new NotFoundException('ORGANIZATION_ALLOWANCE_NOT_FOUND'); return row; } catch (e) { if (e instanceof NotFoundException) throw e; return duplicate(e, 'ALLOWANCE_CODE_TAKEN'); }
  }

  listBonusTemplates() { return this.bonusTemplates.find({ active: true }).sort({ code: 1 }).lean(); }
  listBonusPolicies(org: string) { return this.bonusPolicies.find({ organizationId: org }).sort({ effectiveFrom: -1 }).lean(); }
  async createBonusPolicy(org: string, dto: CreateBonusPolicyDto) {
    if (dto.templateId && !(await this.bonusTemplates.exists({ _id: dto.templateId, active: true }))) throw new NotFoundException('ATTENDANCE_BONUS_TEMPLATE_NOT_FOUND');
    assertNoEffectiveOverlap([], date(dto.effectiveFrom), dto.effectiveTo ? date(dto.effectiveTo) : undefined);
    const row = await this.bonusPolicies.create({ ...dto, organizationId: org, effectiveFrom: date(dto.effectiveFrom), effectiveTo: dto.effectiveTo ? date(dto.effectiveTo) : undefined }); return row.toObject();
  }
  async cloneBonusPolicy(org: string, templateId: string, dto: Omit<CreateBonusPolicyDto, 'templateId' | 'tiers'>) {
    const template = await this.bonusTemplates.findOne({ _id: templateId, active: true }).lean(); if (!template) throw new NotFoundException('ATTENDANCE_BONUS_TEMPLATE_NOT_FOUND');
    return this.createBonusPolicy(org, { ...dto, templateId, tiers: template.tiers });
  }
  async updateBonusPolicy(org: string, id: string, dto: UpdateBonusPolicyDto) { const row = await this.bonusPolicies.findOneAndUpdate({ _id: id, organizationId: org }, { $set: { ...dto, ...(dto.effectiveFrom && { effectiveFrom: date(dto.effectiveFrom) }), ...(dto.effectiveTo && { effectiveTo: date(dto.effectiveTo) }) }, $inc: { version: 1 } }, { new: true, runValidators: true }).lean(); if (!row) throw new NotFoundException('ATTENDANCE_BONUS_POLICY_NOT_FOUND'); return row; }
  async previewBonus(org: string, id: string, metrics?: Record<string, number>) {
    const row = await this.bonusPolicies.findOne({ _id: id, organizationId: org, active: true }).lean();
    if (!row) throw new NotFoundException('ATTENDANCE_BONUS_POLICY_NOT_FOUND');
    return evaluateAttendanceBonus(row, metrics ?? {});
  }

  // ── KPI Policies ────────────────────────────────────────────────────────
  async createKpiPolicy(org: string, dto: CreateKpiPolicyDto) {
    const start = date(dto.effectiveFrom);
    const end = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const row = await this.kpiPolicies.create({
      ...dto,
      organizationId: org,
      effectiveFrom: start,
      effectiveTo: end,
    });
    return row.toObject();
  }

  async listKpiPolicies(org: string, activeOnly = false) {
    const filter: any = { organizationId: org };
    if (activeOnly) filter.active = true;
    return this.kpiPolicies.find(filter).sort({ effectiveFrom: -1 }).lean();
  }

  async updateKpiPolicy(org: string, id: string, dto: UpdateKpiPolicyDto) {
    const setPayload: any = { ...dto };
    if (dto.effectiveFrom) setPayload.effectiveFrom = date(dto.effectiveFrom);
    if (dto.effectiveTo !== undefined) setPayload.effectiveTo = dto.effectiveTo ? date(dto.effectiveTo) : undefined;
    const row = await this.kpiPolicies.findOneAndUpdate(
      { _id: id, organizationId: org },
      { $set: setPayload, $inc: { version: 1 } },
      { new: true }
    ).lean();
    if (!row) throw new NotFoundException('KPI_POLICY_NOT_FOUND');
    return row;
  }

  async getApplicableKpiPolicy(org: string, departmentId?: string) {
    const now = new Date();
    if (departmentId) {
      const deptPolicy = await this.kpiPolicies.findOne({
        organizationId: org,
        active: true,
        scope: 'DEPARTMENT',
        departmentIds: departmentId,
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
      }).sort({ effectiveFrom: -1 }).lean();
      if (deptPolicy) return deptPolicy;
    }

    const allPolicy = await this.kpiPolicies.findOne({
      organizationId: org,
      active: true,
      scope: 'ALL',
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
    }).sort({ effectiveFrom: -1 }).lean();

    return allPolicy ?? null;
  }

  private async getManagerDepartmentId(org: string, userId: string): Promise<string | null> {
    const mgrEmp = await this.employees.findOne({ organizationId: org, userId }).select('departmentId').lean();
    return mgrEmp?.departmentId ? String(mgrEmp.departmentId) : null;
  }

  // ── KPI Inputs ──────────────────────────────────────────────────────────
  async listKpis(org: string, period?: string, actor?: { role: string; id: string }) {
    const filter: any = { organizationId: org, ...(period && { period }) };

    if (actor?.role === 'DEPARTMENT_MANAGER') {
      const deptId = await this.getManagerDepartmentId(org, actor.id);
      if (deptId) {
        const deptEmps = await this.employees.find({ organizationId: org, departmentId: deptId }).select('_id').lean();
        filter.employeeProfileId = { $in: deptEmps.map(e => e._id) };
      } else {
        return [];
      }
    }

    const list = await this.kpis.find(filter).sort({ period: -1 }).lean();
    if (!list.length) return [];
    const empIds = [...new Set(list.map(k => k.employeeProfileId))];
    const empDocs = await this.employees.find({ organizationId: org, _id: { $in: empIds } }).select('_id employeeCode departmentId').lean();
    const empMap = new Map(empDocs.map(e => [String(e._id), e]));
    return list.map(item => {
      const emp = empMap.get(String(item.employeeProfileId));
      return {
        ...item,
        employeeCode: emp?.employeeCode ?? null,
        departmentId: emp?.departmentId ? String(emp.departmentId) : null,
      };
    });
  }

  async createKpi(org: string, dto: CreateKpiInputDto, actorId?: string, actorRole?: string) {
    const emp = await this.employees.findOne({ _id: dto.employeeId, organizationId: org }).lean();
    if (!emp) throw new NotFoundException('EMPLOYEE_PROFILE_NOT_FOUND');

    if (actorRole === 'DEPARTMENT_MANAGER' && actorId) {
      const deptId = await this.getManagerDepartmentId(org, actorId);
      if (!deptId || String(emp.departmentId) !== String(deptId)) {
        throw new ForbiddenException('CANNOT_EVALUATE_EMPLOYEE_OUTSIDE_DEPARTMENT');
      }
    }

    let finalAmount = dto.amount;
    if (dto.baseAmount !== undefined && dto.tierPercentage !== undefined) {
      finalAmount = Math.round((dto.baseAmount * dto.tierPercentage) / 100);
    }

    try {
      const row = await this.kpis.create({
        ...dto,
        amount: finalAmount,
        departmentId: emp.departmentId,
        employeeProfileId: dto.employeeId,
        organizationId: org,
        evaluatedBy: actorId,
        evaluatedAt: new Date(),
      });
      return row.toObject();
    } catch (e) {
      return duplicate(e, 'KPI_INPUT_ALREADY_EXISTS');
    }
  }

  async updateKpi(org: string, id: string, dto: UpdateKpiInputDto, actorId?: string, actorRole?: string) {
    const old = await this.kpis.findOne({ _id: id, organizationId: org }).lean();
    if (!old) throw new NotFoundException('KPI_INPUT_NOT_FOUND');
    if (old.status === KpiStatus.CONFIRMED) throw new ConflictException('KPI_INPUT_CONFIRMED_IMMUTABLE');

    if (actorRole === 'DEPARTMENT_MANAGER' && actorId) {
      const deptId = await this.getManagerDepartmentId(org, actorId);
      if (!deptId || String(old.departmentId) !== String(deptId)) {
        throw new ForbiddenException('CANNOT_EVALUATE_EMPLOYEE_OUTSIDE_DEPARTMENT');
      }
    }

    const setPayload: any = { ...dto };
    if (dto.baseAmount !== undefined && dto.tierPercentage !== undefined) {
      setPayload.amount = Math.round((dto.baseAmount * dto.tierPercentage) / 100);
    }
    if (actorId) {
      setPayload.evaluatedBy = actorId;
      setPayload.evaluatedAt = new Date();
    }

    const row = await this.kpis.findOneAndUpdate(
      { _id: id, organizationId: org },
      { $set: setPayload, $inc: { version: 1 } },
      { new: true, runValidators: true }
    ).lean();
    return row;
  }

  async confirmKpi(org: string, id: string, actorId: string) {
    const row = await this.kpis.findOneAndUpdate(
      { _id: id, organizationId: org, status: KpiStatus.DRAFT },
      { $set: { status: KpiStatus.CONFIRMED, confirmedAt: new Date(), confirmedBy: actorId }, $inc: { version: 1 } },
      { new: true }
    ).lean();
    if (!row) throw new ConflictException('KPI_INPUT_NOT_DRAFT');
    return row;
  }

  async kpiAmountForSnapshot(org: string, employeeId: string, period: string) {
    const row = await this.kpis.findOne({ organizationId: org, employeeProfileId: employeeId, period }).lean();
    return resolveConfirmedKpiAmount(row ?? undefined);
  }
}
