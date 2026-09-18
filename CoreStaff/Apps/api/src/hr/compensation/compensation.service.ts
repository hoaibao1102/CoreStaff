import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AllowanceCatalog, AttendanceBonusPolicy, AttendanceBonusTemplate, KpiPayrollInput,
  KpiStatus, LaborCompliancePolicy, OrganizationAllowance, SalaryProfile,
} from '../../database/schemas/compensation.schema';
import { EmployeeProfile } from '../../database/schemas/employee-profile.schema';
import { assertNoEffectiveOverlap, calculateProbationRate, evaluateAttendanceBonus, resolveConfirmedKpiAmount } from './compensation-domain';
import { CreateAllowanceDto, CreateBonusPolicyDto, CreateKpiInputDto, CreateSalaryProfileDto, UpdateAllowanceDto, UpdateBonusPolicyDto, UpdateKpiInputDto, UpdateSalaryProfileDto } from './dto/compensation.dto';

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
    if (dto.organizationAllowanceIds?.length) {
      const count = await this.allowances.countDocuments({ _id: { $in: dto.organizationAllowanceIds }, organizationId: org, active: true, effectiveFrom: { $lte: at }, $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }] });
      if (count !== new Set(dto.organizationAllowanceIds).size) throw new BadRequestException('ALLOWANCE_CROSS_TENANT_FORBIDDEN');
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
    const row = await this.salaries.create({ ...dto, employeeProfileId: dto.employeeId, organizationId: org, effectiveFrom: start, effectiveTo: end, probationRate, version: (latest?.version ?? 0) + 1 });
    return row.toObject();
  }
  listSalaries(org: string, employeeId?: string) { return this.salaries.find({ organizationId: org, ...(employeeId && { employeeProfileId: employeeId }) }).sort({ effectiveFrom: -1 }).lean(); }
  async effectiveSalary(org: string, employeeId: string, at: Date) {
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
    return this.salaries.findOneAndUpdate({ _id: id, organizationId: org }, { $set: { ...dto, effectiveFrom: start, effectiveTo: end, probationRate } }, { new: true, runValidators: true }).lean();
  }

  listCatalog() { return this.catalog.find({ active: true }).sort({ code: 1 }).lean(); }
  listAllowances(org: string) { return this.allowances.find({ organizationId: org }).sort({ code: 1 }).lean(); }
  async createAllowance(org: string, dto: CreateAllowanceDto) {
    let seed: AllowanceCatalog | null = null;
    if (dto.catalogId) { seed = await this.catalog.findOne({ _id: dto.catalogId, active: true }).lean(); if (!seed) throw new NotFoundException('ALLOWANCE_CATALOG_NOT_FOUND'); }
    if (!seed && (!dto.code || !dto.name)) throw new BadRequestException('ALLOWANCE_CODE_NAME_REQUIRED');
    const start = date(dto.effectiveFrom), end = dto.effectiveTo ? date(dto.effectiveTo) : undefined; assertNoEffectiveOverlap([], start, end);
    try { const row = await this.allowances.create({ organizationId: org, catalogId: dto.catalogId, code: (dto.code ?? seed!.code).trim().toUpperCase(), name: dto.name ?? seed!.defaultName, amount: dto.amount, taxable: dto.taxable ?? seed?.defaultTaxable ?? true, insuranceBased: dto.insuranceBased ?? seed?.defaultInsuranceBased ?? false, prorated: dto.prorated ?? false, effectiveFrom: start, effectiveTo: end }); return row.toObject(); } catch (e) { return duplicate(e, 'ALLOWANCE_CODE_TAKEN'); }
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
  async previewBonus(org: string, id: string, metrics: Record<string, number>) { const row = await this.bonusPolicies.findOne({ _id: id, organizationId: org, active: true }).lean(); if (!row) throw new NotFoundException('ATTENDANCE_BONUS_POLICY_NOT_FOUND'); return evaluateAttendanceBonus(row, metrics); }

  listKpis(org: string, period?: string) { return this.kpis.find({ organizationId: org, ...(period && { period }) }).sort({ period: -1 }).lean(); }
  async createKpi(org: string, dto: CreateKpiInputDto) { await this.assertEmployee(org, dto.employeeId); try { const row = await this.kpis.create({ ...dto, employeeProfileId: dto.employeeId, organizationId: org }); return row.toObject(); } catch (e) { return duplicate(e, 'KPI_INPUT_ALREADY_EXISTS'); } }
  async updateKpi(org: string, id: string, dto: UpdateKpiInputDto) { const old = await this.kpis.findOne({ _id: id, organizationId: org }).lean(); if (!old) throw new NotFoundException('KPI_INPUT_NOT_FOUND'); if (old.status === KpiStatus.CONFIRMED) throw new ConflictException('KPI_INPUT_CONFIRMED_IMMUTABLE'); const row = await this.kpis.findOneAndUpdate({ _id: id, organizationId: org }, { $set: dto, $inc: { version: 1 } }, { new: true, runValidators: true }).lean(); return row; }
  async confirmKpi(org: string, id: string, actorId: string) { const row = await this.kpis.findOneAndUpdate({ _id: id, organizationId: org, status: KpiStatus.DRAFT }, { $set: { status: KpiStatus.CONFIRMED, confirmedAt: new Date(), confirmedBy: actorId }, $inc: { version: 1 } }, { new: true }).lean(); if (!row) throw new ConflictException('KPI_INPUT_NOT_DRAFT'); return row; }
  async kpiAmountForSnapshot(org: string, employeeId: string, period: string) { const row = await this.kpis.findOne({ organizationId: org, employeeProfileId: employeeId, period }).lean(); return resolveConfirmedKpiAmount(row ?? undefined); }
}
