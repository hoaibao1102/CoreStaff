import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AllowanceCatalog, AttendanceBonusPolicy, AttendanceBonusTemplate,
  LaborCompliancePolicy, OrganizationAllowance, SalaryProfile,
} from '../../database/schemas/compensation.schema';
import { EmployeeProfile } from '../../database/schemas/employee-profile.schema';
import { assertNoEffectiveOverlap, calculateProbationRate, evaluateAttendanceBonus } from './compensation-domain';
import { CreateAllowanceDto, CreateBonusPolicyDto, CreateSalaryProfileDto, UpdateAllowanceDto, UpdateBonusPolicyDto, UpdateSalaryProfileDto } from './dto/compensation.dto';
import { deriveInsuranceSalary } from '../timesheet/payroll-snapshot.service';

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

  /**
   * Lương đóng bảo hiểm là số DẪN XUẤT: lương cơ bản − tổng phụ cấp gán cho nhân viên
   * (không âm). HR không nhập tay nữa. Snapshot lương tính lại lần nữa khi chốt kỳ,
   * nhưng ghi ở đây để màn hồ sơ lương hiện được số khớp với payroll.
   */
  private deriveInsuranceSalary(baseSalary: number, allowances: Array<{ amount?: number }>): number {
    return deriveInsuranceSalary(baseSalary, allowances.reduce((sum, item) => sum + (item?.amount ?? 0), 0));
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
      insuranceSalary: this.deriveInsuranceSalary(dto.baseSalary, allowances),
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
      { $set: { ...dto, insuranceSalary: this.deriveInsuranceSalary(merged.baseSalary, allowances), organizationAllowanceIds: allowanceIds, allowances, effectiveFrom: start, effectiveTo: end, probationRate } },
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
    try { const row = await this.allowances.create({ organizationId: org, catalogId: dto.catalogId, code: (dto.code ?? seed!.code).trim().toUpperCase(), name: dto.name ?? seed!.defaultName, description: dto.description ?? seed?.description, amount: dto.amount ?? 0, taxable: dto.taxable ?? seed?.defaultTaxable ?? true, insuranceBased: dto.insuranceBased ?? seed?.defaultInsuranceBased ?? false, prorated: dto.prorated ?? false, effectiveFrom: start, effectiveTo: end }); return row.toObject(); } catch (e) { return duplicate(e, 'ALLOWANCE_CODE_TAKEN'); }
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
}
