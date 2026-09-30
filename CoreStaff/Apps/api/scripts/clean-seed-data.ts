/**
 * Clean Seed Data Script
 *
 * Xóa dữ liệu seed được tạo từ ngày 28/09/2026 đến ngày 30/09/2026.
 * Chạy: npm run seed:clean (từ Apps/api)
 */

import * as mongoose from 'mongoose';
import { resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

const env = resolveEnv();
if (!env.mongodbUri) {
  console.error('[seed:clean] No MONGODB_URI configured.');
  process.exit(1);
}

const connection = mongoose.createConnection(env.mongodbUri, {
  serverSelectionTimeoutMS: 15000,
});

async function cleanSeedData(): Promise<void> {
  const startDate = new Date('2026-09-28T00:00:00.000Z');
  const endDate = new Date('2026-09-30T23:59:59.999Z');

  console.log('🧹 Starting Clean Seed Data...');
  console.log(`   Cleaning data created from 2026-09-28 to 2026-09-30\n`);

  try {
    await connection.asPromise();
    if (!connection.db) {
      throw new Error('Database connection is not established');
    }
    console.log('✅ Connected to MongoDB\n');

    // Get all collections
    const collections = await connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📋 Found collections:', collectionNames.length);

    // Define test data patterns to clean
    const testPatterns = {
      organizations: ['AUG_TEST', 'FLOW_TEST', 'TEST_ORG', 'FULL_TEST'],
      users: ['@augtest.com', '@flowtest.com', '@test.com', '@fulltest.com'],
      employees: ['AUG-', 'FLOW-', 'TEST-', 'FULL-'],
      departments: ['AUG_', 'FLOW_', 'TEST_', 'FULL_'],
      periods: ['2026-08', '2026-09', '2026-10'],
    };

    let totalDeleted = 0;

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Find periodIds BEFORE deleting periods
    // ═══════════════════════════════════════════════════════════════
    console.log('\n🔍 Finding period IDs...');
    const periods = await connection.db.collection('timesheet_periods').find({
      createdAt: { $gte: startDate, $lte: endDate },
      period: { $in: testPatterns.periods },
    }).toArray();
    const periodIds = periods.map(p => p._id);
    console.log(`   ✅ Found ${periodIds.length} periods to clean`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Clean child collections FIRST (before parent)
    // ═══════════════════════════════════════════════════════════════

    // Clean AttendanceDays
    console.log('\n⏰ Cleaning AttendanceDays...');
    const attendanceResult = await connection.db.collection('attendance_days').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      periodId: { $in: periodIds },
    });
    console.log(`   ✅ Deleted ${attendanceResult.deletedCount} attendance days`);
    totalDeleted += attendanceResult.deletedCount;

    // Clean TimesheetSummaries
    console.log('\n📊 Cleaning TimesheetSummaries...');
    const summaryResult = await connection.db.collection('timesheet_summaries').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      periodId: { $in: periodIds },
    });
    console.log(`   ✅ Deleted ${summaryResult.deletedCount} timesheet summaries`);
    totalDeleted += summaryResult.deletedCount;

    // Clean PayrollInputSnapshots
    console.log('\n📦 Cleaning PayrollInputSnapshots...');
    const snapshotResult = await connection.db.collection('payroll_input_snapshots').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${snapshotResult.deletedCount} payroll input snapshots`);
    totalDeleted += snapshotResult.deletedCount;

    // Clean Payslips
    console.log('\n📄 Cleaning Payslips...');
    const payslipResult = await connection.db.collection('payslips').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${payslipResult.deletedCount} payslips`);
    totalDeleted += payslipResult.deletedCount;

    // Clean PayrollRuns
    console.log('\n💼 Cleaning PayrollRuns...');
    const payrollResult = await connection.db.collection('payroll_runs').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${payrollResult.deletedCount} payroll runs`);
    totalDeleted += payrollResult.deletedCount;

    // Clean LeaveRequests
    console.log('\n🏖️  Cleaning LeaveRequests...');
    const leaveResult = await connection.db.collection('leave_requests').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${leaveResult.deletedCount} leave requests`);
    totalDeleted += leaveResult.deletedCount;

    // Clean CalendarExceptions
    console.log('\n📅 Cleaning CalendarExceptions...');
    const calendarResult = await connection.db.collection('calendar_exceptions').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${calendarResult.deletedCount} calendar exceptions`);
    totalDeleted += calendarResult.deletedCount;

    // Clean ShiftTemplates
    console.log('\n🕐 Cleaning ShiftTemplates...');
    const shiftResult = await connection.db.collection('shift_templates').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${shiftResult.deletedCount} shift templates`);
    totalDeleted += shiftResult.deletedCount;

    // Clean ManagerAssignments
    console.log('\n👔 Cleaning ManagerAssignments...');
    const managerResult = await connection.db.collection('manager_assignments').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${managerResult.deletedCount} manager assignments`);
    totalDeleted += managerResult.deletedCount;

    // Clean EmployeeAssignments
    console.log('\n👥 Cleaning EmployeeAssignments...');
    const assignmentResult = await connection.db.collection('employee_assignments').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${assignmentResult.deletedCount} employee assignments`);
    totalDeleted += assignmentResult.deletedCount;

    // Clean EmploymentContracts
    console.log('\n📝 Cleaning EmploymentContracts...');
    const contractResult = await connection.db.collection('employment_contracts').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${contractResult.deletedCount} employment contracts`);
    totalDeleted += contractResult.deletedCount;

    // Clean InsuranceProfiles
    console.log('\n🛡️  Cleaning InsuranceProfiles...');
    const insuranceProfileResult = await connection.db.collection('insurance_profiles').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${insuranceProfileResult.deletedCount} insurance profiles`);
    totalDeleted += insuranceProfileResult.deletedCount;

    // Clean SalaryProfiles
    console.log('\n💰 Cleaning SalaryProfiles...');
    const salaryResult = await connection.db.collection('salary_profiles').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${salaryResult.deletedCount} salary profiles`);
    totalDeleted += salaryResult.deletedCount;

    // Clean KpiPayrollInputs
    console.log('\n📈 Cleaning KpiPayrollInputs...');
    const kpiInputResult = await connection.db.collection('kpi_payroll_inputs').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${kpiInputResult.deletedCount} KPI payroll inputs`);
    totalDeleted += kpiInputResult.deletedCount;

    // Clean KpiPolicies
    console.log('\n🎯 Cleaning KpiPolicies...');
    const kpiPolicyResult = await connection.db.collection('kpi_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${kpiPolicyResult.deletedCount} KPI policies`);
    totalDeleted += kpiPolicyResult.deletedCount;

    // Clean AttendanceBonusPolicies
    console.log('\n🎁 Cleaning AttendanceBonusPolicies...');
    const bonusResult = await connection.db.collection('attendance_bonus_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${bonusResult.deletedCount} attendance bonus policies`);
    totalDeleted += bonusResult.deletedCount;

    // Clean OvertimePayPolicies
    console.log('\n⏱️  Cleaning OvertimePayPolicies...');
    const otResult = await connection.db.collection('overtime_pay_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${otResult.deletedCount} overtime pay policies`);
    totalDeleted += otResult.deletedCount;

    // Clean LaborCompliancePolicies
    console.log('\n⚖️  Cleaning LaborCompliancePolicies...');
    const laborResult = await connection.db.collection('labor_compliance_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${laborResult.deletedCount} labor compliance policies`);
    totalDeleted += laborResult.deletedCount;

    // Clean OrganizationAllowances
    console.log('\n🏢 Cleaning OrganizationAllowances...');
    const orgAllowanceResult = await connection.db.collection('organization_allowances').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${orgAllowanceResult.deletedCount} organization allowances`);
    totalDeleted += orgAllowanceResult.deletedCount;

    // Clean AllowanceCatalogs
    console.log('\n📋 Cleaning AllowanceCatalogs...');
    const allowanceResult = await connection.db.collection('allowance_catalogs').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${allowanceResult.deletedCount} allowance catalogs`);
    totalDeleted += allowanceResult.deletedCount;

    // Clean TaxPolicies
    console.log('\n💵 Cleaning TaxPolicies...');
    const taxResult = await connection.db.collection('tax_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${taxResult.deletedCount} tax policies`);
    totalDeleted += taxResult.deletedCount;

    // Clean InsurancePolicies
    console.log('\n🛡️  Cleaning InsurancePolicies...');
    const insurancePolicyResult = await connection.db.collection('insurance_policies').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    console.log(`   ✅ Deleted ${insurancePolicyResult.deletedCount} insurance policies`);
    totalDeleted += insurancePolicyResult.deletedCount;

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Clean parent collections LAST
    // ═══════════════════════════════════════════════════════════════

    // Clean TimesheetPeriods
    console.log('\n📅 Cleaning TimesheetPeriods...');
    const periodResult = await connection.db.collection('timesheet_periods').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      period: { $in: testPatterns.periods },
    });
    console.log(`   ✅ Deleted ${periodResult.deletedCount} timesheet periods`);
    totalDeleted += periodResult.deletedCount;

    // Clean EmployeeProfiles
    console.log('\n👥 Cleaning EmployeeProfiles...');
    const empResult = await connection.db.collection('employee_profiles').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      employeeCode: { $regex: `^(${testPatterns.employees.join('|')})` },
    });
    console.log(`   ✅ Deleted ${empResult.deletedCount} employee profiles`);
    totalDeleted += empResult.deletedCount;

    // Clean Users
    console.log('\n👤 Cleaning Users...');
    const userResult = await connection.db.collection('users').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      $or: testPatterns.users.map(email => ({ email: { $regex: email.replace('@', '\\@').replace('.', '\\.') + '$' } })),
    });
    console.log(`   ✅ Deleted ${userResult.deletedCount} users`);
    totalDeleted += userResult.deletedCount;

    // Clean Departments
    console.log('\n🏛️  Cleaning Departments...');
    const deptResult = await connection.db.collection('departments').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      code: { $regex: `^(${testPatterns.departments.join('|')})` },
    });
    console.log(`   ✅ Deleted ${deptResult.deletedCount} departments`);
    totalDeleted += deptResult.deletedCount;

    // Clean Positions
    console.log('\n💼 Cleaning Positions...');
    const positionResult = await connection.db.collection('positions').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      code: { $regex: `^(${testPatterns.departments.join('|')})` },
    });
    console.log(`   ✅ Deleted ${positionResult.deletedCount} positions`);
    totalDeleted += positionResult.deletedCount;

    // Clean Workplaces
    console.log('\n📍 Cleaning Workplaces...');
    const workplaceResult = await connection.db.collection('workplaces').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      code: { $regex: `^(${testPatterns.departments.join('|')})` },
    });
    console.log(`   ✅ Deleted ${workplaceResult.deletedCount} workplaces`);
    totalDeleted += workplaceResult.deletedCount;

    // Clean Organizations
    console.log('\n🏢 Cleaning Organizations...');
    const orgResult = await connection.db.collection('organizations').deleteMany({
      createdAt: { $gte: startDate, $lte: endDate },
      code: { $in: testPatterns.organizations },
    });
    console.log(`   ✅ Deleted ${orgResult.deletedCount} organizations`);
    totalDeleted += orgResult.deletedCount;

    // Final Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 Clean Seed Data Complete!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`📊 Total deleted: ${totalDeleted} records`);
    console.log('\n✅ All test data has been cleaned successfully!');
    console.log('\n💡 You can now run seed scripts to create fresh test data.\n');

  } catch (error) {
    console.error('\n❌ Clean failed:', error);
    throw error;
  } finally {
    await closeConnection(connection);
    console.log('✅ Database connection closed');
  }
}

// Run the clean
cleanSeedData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
