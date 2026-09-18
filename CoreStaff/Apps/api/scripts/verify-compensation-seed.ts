/** Read-only verification for compensation demo data. */
import * as mongoose from 'mongoose';
import { resolveEnv, hasMongoUri } from '../src/config/env';
import { OrganizationSchema } from '../src/database/schemas/organization.schema';
import { EmployeeProfileSchema } from '../src/database/schemas/employee-profile.schema';
import {
  AttendanceBonusPolicySchema, KpiPayrollInputSchema, LaborCompliancePolicySchema,
  OrganizationAllowanceSchema, SalaryProfileSchema,
} from '../src/database/schemas/compensation.schema';

async function main() {
  const env = resolveEnv(); if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured');
  const db = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 }); await db.asPromise();
  const Org = db.model('Organization', OrganizationSchema);
  const Profile = db.model('EmployeeProfile', EmployeeProfileSchema);
  const Salary = db.model('SalaryProfile', SalaryProfileSchema);
  const Labor = db.model('LaborCompliancePolicy', LaborCompliancePolicySchema);
  const Allowance = db.model('OrganizationAllowance', OrganizationAllowanceSchema);
  const Bonus = db.model('AttendanceBonusPolicy', AttendanceBonusPolicySchema);
  const Kpi = db.model('KpiPayrollInput', KpiPayrollInputSchema);
  let errors = 0;
  const orgs = await Org.find({}).select('_id code').sort({ code: 1 }).lean();
  for (const org of orgs) {
    const [profiles, salaries, labor, allowances, bonuses, kpis] = await Promise.all([
      Profile.find({ organizationId: org._id }).select('_id employeeCode employmentStatus').lean(),
      Salary.find({ organizationId: org._id }).lean(), Labor.find({ organizationId: org._id }).lean(),
      Allowance.find({ organizationId: org._id }).lean(), Bonus.find({ organizationId: org._id }).lean(),
      Kpi.find({ organizationId: org._id }).lean(),
    ]);
    const profileIds = new Set(profiles.map(p => String(p._id)));
    const allowanceIds = new Set(allowances.map(a => String(a._id)));
    const bonusIds = new Set(bonuses.map(b => String(b._id)));
    for (const s of salaries) {
      if (!profileIds.has(String(s.employeeProfileId))) errors++;
      for (const id of s.organizationAllowanceIds ?? []) if (!allowanceIds.has(String(id))) errors++;
      if (s.attendanceBonusPolicyId && !bonusIds.has(String(s.attendanceBonusPolicyId))) errors++;
    }
    for (const k of kpis) if (!profileIds.has(String(k.employeeProfileId))) errors++;
    const confirmed = kpis.filter(k => k.status === 'CONFIRMED').length;
    const draft = kpis.filter(k => k.status === 'DRAFT').length;
    const probation = profiles.filter(p => p.employmentStatus === 'PROBATION').length;
    console.log(`${org.code}: profiles=${profiles.length} salaries=${salaries.length} labor=${labor.length} allowances=${allowances.length} bonusPolicies=${bonuses.length} kpis=${kpis.length} (confirmed=${confirmed}, draft=${draft}, probation=${probation})`);
  }
  console.log(errors ? `FAILED: ${errors} cross-reference error(s)` : 'Compensation seed references are valid.');
  await db.close(); process.exit(errors ? 2 : 0);
}
main().catch(e => { console.error('[verify-compensation] failed:', e.message); process.exit(1); });
