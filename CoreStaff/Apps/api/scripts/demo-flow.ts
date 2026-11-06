/**
 * Script bổ sung cho buổi demo kỳ công đang rà soát (mặc định 2026-10).
 * Mọi thao tác gọi đúng service mà Web/Mobile gọi, với tài khoản người có
 * thẩm quyền tương ứng (nhân viên tự giải trình/xác nhận, QL duyệt, HR chốt).
 *
 *   npm run demo:status                 # Xem blocker, đơn chờ duyệt, tiến độ xác nhận
 *   npm run demo:resolve                # Gỡ blocker của mọi tài khoản TRỪ tài khoản demo
 *   npm run demo:ack                    # Nhân viên xác nhận bảng công (trừ --skip-ack)
 *   npm run demo:confirm                # QL xác nhận công các phòng chưa xác nhận
 *   npm run demo:close                  # HR chốt kỳ + tạo/tính/khóa/phát hành lương
 *   npm run demo:rollback               # Về trạng thái "main": còn đúng 1 blocker
 *   npm run demo:rollback -- --to=alt   # Về trạng thái "alt": đủ 4 blocker để demo nhánh phụ
 *   npm run demo:all                    # Chạy trọn luồng (diễn tập)
 *
 * Seed xong tenant đã ở trạng thái "main": chỉ còn ĐÚNG MỘT blocker cho demo tay
 * (selfie NV-KD-002 15/10) — tài khoản demo gói gọn: HR + QL KD + 1 nhân viên.
 *
 * Tùy chọn: --keep=NV-KD-003             (tài khoản giữ blocker để demo tay; mặc định NV-KD-002)
 *           --skip-ack=NV-KD-002          (tài khoản tự bấm "Xác nhận bảng công" khi demo)
 *           --period=2026-10 --org-code=ANPHAT
 *
 * Thứ tự đúng khi demo: gỡ blocker (tay + resolve) → ack → confirm → close.
 * Mọi thao tác sửa dữ liệu công (duyệt giải trình, OT, xử lý vắng) làm tăng
 * phiên bản kỳ và vô hiệu các xác nhận bảng công trước đó.
 * Hội đồng hỏi thêm kịch bản khác giữa buổi: `demo:rollback` rồi demo lại.
 */
import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../src/database/schemas/enums';
import { TimesheetPeriodStatus } from '../src/database/schemas/timesheet-period.schema';
import { createDemoApp, DemoApp } from './lib/demo-app';
import { ACTIVE_PERIOD, DEMO_KEEP, DEMO_SKIP_ACK } from './lib/demo-scenario';
import { restoreOrgSnapshot, SnapshotStage } from './lib/demo-snapshot';

type Step = 'status' | 'resolve' | 'ack' | 'confirm' | 'close' | 'rollback' | 'all';
export interface FlowOptions { orgCode: string; step: Step; keep: string[]; skipAck: string[]; period?: string; to: SnapshotStage }

interface People {
  orgId: Types.ObjectId;
  org: string;
  hr: string;
  byCode: Map<string, { userId: string; profileId: string; departmentId: string; fullName: string; role: string }>;
  codeByUser: Map<string, string>;
  managerOfDept: Map<string, string>;
  deptName: Map<string, string>;
}

async function loadPeople(demo: DemoApp, orgCode: string): Promise<People> {
  const org: any = await demo.model('Organization').findOne({ code: orgCode }).lean();
  if (!org) throw new Error(`Tenant ${orgCode} chưa tồn tại — chạy "npm run seed:demo:reset" trước.`);
  const [users, profiles, assignments, departments]: any[][] = await Promise.all([
    demo.model('User').find({ organizationId: org._id }).lean(),
    demo.model('EmployeeProfile').find({ organizationId: org._id }).lean(),
    demo.model('ManagerAssignment').find({ organizationId: org._id, active: true }).lean(),
    demo.model('Department').find({ organizationId: org._id }).lean(),
  ]);
  const people: People = {
    orgId: org._id, org: String(org._id), hr: String(users.find(u => u.role === Role.HR)?._id ?? ''),
    byCode: new Map(), codeByUser: new Map(), managerOfDept: new Map(), deptName: new Map(departments.map(d => [String(d._id), d.name])),
  };
  for (const p of profiles) {
    const user = users.find(u => String(u._id) === String(p.userId));
    people.byCode.set(p.employeeCode, { userId: String(p.userId), profileId: String(p._id), departmentId: String(p.departmentId), fullName: user?.fullName ?? '', role: user?.role ?? '' });
    people.codeByUser.set(String(p.userId), p.employeeCode);
  }
  for (const a of assignments) people.managerOfDept.set(String(a.departmentId), String(a.managerUserId));
  return people;
}

const say = (message: string) => console.log(`  ${message}`);
const errorText = (error: any) => {
  const message = error?.response?.message ?? error?.message ?? String(error);
  return Array.isArray(message) ? message.join(', ') : message;
};

async function findPeriod(demo: DemoApp, people: People, periodKey: string) {
  const period: any = await demo.model('TimesheetPeriod').findOne({ organizationId: people.orgId, period: periodKey, active: true }).lean();
  if (!period) throw new Error(`Không có kỳ công ${periodKey}.`);
  return period;
}

function periodDateRange(period: any) {
  return { from: new Date(period.startDate), to: new Date(new Date(period.endDate).getTime() + 86_399_999) };
}

/** Blocker theo đúng 2 nguồn hệ thống dùng: AttendanceDay (getBlockers) và projection (MISSING_ATTENDANCE_DAY). */
async function collectOpenItems(demo: DemoApp, people: People, period: any) {
  const blockers = await demo.periods.getBlockers(people.org, String(period._id), { role: 'HR', limit: 200 });
  const projection = await demo.obligations.loadPeriod({
    organizationId: people.org, periodKey: period.period, startDate: new Date(period.startDate).toISOString().slice(0, 10),
    endDate: new Date(period.endDate).toISOString().slice(0, 10), overtimeStatus: 'REVIEWABLE',
  });
  const missingDays = projection.days.filter(d => d.blockers.includes('MISSING_ATTENDANCE_DAY'));
  const range = periodDateRange(period);
  const pending: any[] = await demo.model('ManagerRequest').find({
    organizationId: people.orgId, status: { $in: ['PENDING', 'CLARIFICATION_REQUESTED'] }, workDate: { $gte: range.from, $lte: range.to },
  }).sort({ workDate: 1 }).lean();
  return { blockers: blockers.items, missingDays, pending };
}

async function resolve(demo: DemoApp, people: People, period: any, keep: Set<string>) {
  console.log(`\n▶ Gỡ blocker kỳ ${period.period}${keep.size ? ` (giữ nguyên cho demo: ${[...keep].join(', ')})` : ''}`);
  const managerFor = (code: string) => people.managerOfDept.get(people.byCode.get(code)!.departmentId)!;
  let { blockers, missingDays, pending } = await collectOpenItems(demo, people, period);
  const isKept = (userId: string) => keep.has(people.codeByUser.get(userId) ?? '');
  let done = 0;

  // 1. Selfie chờ duyệt (phải xong trước giải trình: giải trình yêu cầu ngày công đã được xác minh).
  for (const row of pending.filter(r => r.type === 'ATTENDANCE' && r.source !== 'ATTENDANCE_CONFIRMATION' && r.evidenceId)) {
    if (isKept(String(row.employeeUserId))) continue;
    const code = people.codeByUser.get(String(row.employeeUserId))!;
    try {
      await demo.requests.decide(people.org, managerFor(code), String(row._id), 'APPROVED', row.version, 'Đã kiểm tra ảnh selfie và vị trí, xác nhận có mặt');
      say(`✓ QL duyệt selfie ${row.metadata?.actionType ?? ''} ${code} ngày ${new Date(row.workDate).toISOString().slice(0, 10)}`); done++;
    } catch (error) { say(`✗ Duyệt selfie ${code}: ${errorText(error)}`); }
  }

  // 2. Giải trình đang chờ duyệt.
  ({ blockers, missingDays, pending } = await collectOpenItems(demo, people, period));
  for (const row of pending.filter(r => r.source === 'ATTENDANCE_CONFIRMATION' && r.status === 'PENDING')) {
    if (isKept(String(row.employeeUserId))) continue;
    const code = people.codeByUser.get(String(row.employeeUserId))!;
    const date = new Date(row.workDate).toISOString().slice(0, 10);
    try {
      await demo.requests.decide(people.org, managerFor(code), String(row._id), 'APPROVED', row.version, 'Đã xác minh với quản lý trực tiếp, đồng ý bổ sung công', undefined, undefined, `demo-flow-approve-${row._id}`);
      say(`✓ QL duyệt giải trình ${code} ngày ${date}`); done++;
    } catch (error) { say(`✗ Duyệt giải trình ${code} ${date}: ${errorText(error)}`); }
  }

  // 3. Thiếu chấm công chưa có giải trình: NV tự giải trình rồi QL duyệt.
  ({ blockers, missingDays, pending } = await collectOpenItems(demo, people, period));
  const explained = new Set(pending.filter(r => r.source === 'ATTENDANCE_CONFIRMATION').map(r => `${r.employeeUserId}|${new Date(r.workDate).toISOString().slice(0, 10)}`));
  const punchGaps = [
    ...blockers.filter(b => b.type === 'MISSING_CHECK_IN' || b.type === 'MISSING_CHECK_OUT').map(b => ({ userId: b.employeeId, date: b.date })),
    ...missingDays.map(d => ({ userId: d.userId, date: d.workDate })),
  ];
  for (const gap of punchGaps) {
    const code = people.codeByUser.get(gap.userId)!;
    if (isKept(gap.userId) || explained.has(`${gap.userId}|${gap.date}`)) continue;
    try {
      const preview: any = await demo.requests.attendanceConfirmationPreview(people.org, gap.userId, gap.date);
      if (!preview.canSubmit) throw new Error(preview.blockedReasons.join(', '));
      const row: any = await demo.requests.createMine(people.org, gap.userId, {
        requestKind: 'ATTENDANCE_CONFIRMATION', type: 'ATTENDANCE', workDate: gap.date, previewHash: preview.contextHash,
        reason: 'Quên thao tác chấm công trên ứng dụng, vẫn làm việc đủ giờ theo ca tại văn phòng',
      } as any, `demo-flow-${gap.userId}-${gap.date}`);
      await demo.requests.decide(people.org, managerFor(code), String(row._id), 'APPROVED', row.version, 'Đã xác minh với quản lý trực tiếp, đồng ý bổ sung công', undefined, undefined, `demo-flow-approve-${row._id}`);
      say(`✓ ${code} giải trình + QL duyệt ngày ${gap.date}`); done++;
    } catch (error) { say(`✗ Thiếu chấm công ${code} ${gap.date}: ${errorText(error)}`); }
  }

  // 4. OT đã khai nhưng chưa duyệt (không phải blocker, nhưng chưa duyệt thì không được trả).
  ({ pending } = await collectOpenItems(demo, people, period));
  for (const row of pending.filter(r => r.type === 'OVERTIME' && r.status === 'PENDING')) {
    if (isKept(String(row.employeeUserId))) continue;
    const code = people.codeByUser.get(String(row.employeeUserId))!;
    try {
      await demo.requests.decide(people.org, managerFor(code), String(row._id), 'APPROVED', row.version, 'Đồng ý làm thêm giờ');
      say(`✓ QL duyệt OT ${code} ngày ${new Date(row.workDate).toISOString().slice(0, 10)}`); done++;
    } catch (error) { say(`✗ Duyệt OT ${code}: ${errorText(error)}`); }
  }
  if (!done) say('Không còn mục nào cần xử lý.');
}

async function acknowledge(demo: DemoApp, people: People, periodKey: string, skip: Set<string>) {
  let period = await findPeriod(demo, people, periodKey);
  console.log(`\n▶ Nhân viên xác nhận bảng công kỳ ${periodKey}${skip.size ? ` (tự xác nhận khi demo: ${[...skip].join(', ')})` : ''}`);
  if (period.status === TimesheetPeriodStatus.OPEN) {
    await demo.periods.updateStatus(people.org, String(period._id), TimesheetPeriodStatus.REVIEWING, people.hr);
    say('✓ HR chuyển kỳ sang REVIEWING (mở cho nhân viên xác nhận)');
    period = await findPeriod(demo, people, periodKey);
  }
  for (const [code, person] of [...people.byCode.entries()].sort()) {
    try {
      const review = await demo.reviews.getOwnReview(people.org, String(period._id), person.userId);
      if (review.state === 'ACKNOWLEDGED') { say(`· ${code} ${person.fullName}: đã xác nhận trước đó`); continue; }
      if (skip.has(code)) { say(`· ${code} ${person.fullName}: để tự xác nhận khi demo`); continue; }
      if (review.hasUnresolvedDays) { say(`✗ ${code} ${person.fullName}: còn ngày chưa xử lý (blocker) → chưa thể xác nhận`); continue; }
      await demo.reviews.acknowledge(people.org, String(period._id), person.userId, { expectedPeriodVersion: review.periodVersion, projectionHash: review.projectionHash });
      say(`✓ ${code} ${person.fullName}: ${review.payableWorkUnits}/${review.standardWorkUnits} công`);
    } catch (error) { say(`✗ ${code}: ${errorText(error)}`); }
  }
}

async function confirmDepartments(demo: DemoApp, people: People, periodKey: string) {
  console.log(`\n▶ Quản lý xác nhận công các phòng còn lại kỳ ${periodKey}`);
  for (const [departmentId, managerUserId] of people.managerOfDept) {
    const period = await findPeriod(demo, people, periodKey);
    const done = await demo.model('DepartmentTimesheetConfirmation')
      .exists({ organizationId: people.orgId, periodId: period._id, periodVersion: period.version, departmentId });
    if (done) { say(`· ${people.deptName.get(departmentId)}: đã xác nhận trước đó`); continue; }
    try {
      await demo.periods.confirmDepartment(people.org, String(period._id), managerUserId, { departmentId, expectedPeriodVersion: period.version });
      say(`✓ ${people.deptName.get(departmentId)} đã xác nhận (phiên bản ${period.version})`);
    } catch (error) { say(`✗ ${people.deptName.get(departmentId)}: ${errorText(error)}`); }
  }
}

async function closeAndPay(demo: DemoApp, people: People, periodKey: string) {
  console.log(`\n▶ HR chốt kỳ ${periodKey} và chạy lương`);
  const period = await findPeriod(demo, people, periodKey);
  if (period.status !== TimesheetPeriodStatus.CLOSED) {
    const result = await demo.periods.hrClosePeriod(people.org, String(period._id), people.hr);
    say(`✓ Đã chốt kỳ: ${result.summariesCreated} bảng tổng hợp công, ${result.snapshotsCreated} snapshot lương`);
  }
  let run: any = await demo.model('PayrollRun').findOne({ organizationId: people.orgId, timesheetPeriodId: period._id, active: true }).lean();
  if (!run) {
    run = await demo.payrollRuns.create({ organizationId: people.org, timesheetPeriodId: String(period._id), notes: `Bảng lương tháng ${periodKey.slice(5)}/${periodKey.slice(0, 4)}`, userId: people.hr });
    say('✓ Tạo bảng lương (DRAFT)');
  }
  const runId = String(run._id);
  if ((await demo.model('PayrollRun').findById(runId).lean() as any).status === 'DRAFT') { await demo.payrollRuns.calculate(runId, people.hr); say('✓ Tính lương (CALCULATED)'); }
  if ((await demo.model('PayrollRun').findById(runId).lean() as any).status === 'CALCULATED') { await demo.payrollRuns.lock(runId, people.hr); say('✓ Khóa bảng lương (LOCKED)'); }
  if ((await demo.model('PayrollRun').findById(runId).lean() as any).status === 'LOCKED') { await demo.payslips.releaseForPayrollRun(runId, people.hr); say('✓ Phát hành phiếu lương (RELEASED)'); }
}

export async function runDemoFlow(demo: DemoApp, options: FlowOptions) {
  const periodKey = options.period ?? ACTIVE_PERIOD;
  if (options.step === 'rollback') {
    console.log(`\n▶ Tua tenant ${options.orgCode} về trạng thái "${options.to}"`);
    await restoreOrgSnapshot(demo, options.orgCode, options.to);
    return;
  }
  const people = await loadPeople(demo, options.orgCode);
  const keep = new Set(options.step === 'all' ? [] : options.keep);
  const skipAck = new Set(options.step === 'all' ? [] : options.skipAck);
  if (options.step === 'resolve' || options.step === 'all') await resolve(demo, people, await findPeriod(demo, people, periodKey), keep);
  if (options.step === 'ack' || options.step === 'all') await acknowledge(demo, people, periodKey, skipAck);
  if (options.step === 'confirm' || options.step === 'all') await confirmDepartments(demo, people, periodKey);
  if (options.step === 'close' || options.step === 'all') await closeAndPay(demo, people, periodKey);
}

export async function printDemoStatus(demo: DemoApp, orgCode: string) {
  const people = await loadPeople(demo, orgCode);
  const periods: any[] = await demo.model('TimesheetPeriod').find({ organizationId: people.orgId }).sort({ period: 1 }).lean();
  console.log(`\n─── TRẠNG THÁI DEMO [${orgCode}] ───`);
  for (const p of periods) {
    console.log(`Kỳ ${p.period}: ${p.status.padEnd(14)} phiên bản ${String(p.version).padEnd(5)} lương: ${p.payrollState ?? '—'}`);
  }
  for (const closed of periods.filter(p => p.status === 'CLOSED')) {
    const run: any = await demo.model('PayrollRun').findOne({ organizationId: people.orgId, timesheetPeriodId: closed._id, active: true }).lean();
    if (!run) continue;
    const slips: any[] = await demo.model('Payslip').find({ payrollRunId: run._id }).sort({ employeeCode: 1 }).lean();
    console.log(`\nPhiếu lương ${closed.period} (${run.status}):`);
    console.log('  Mã NV      Công     Gross         OT          BH (NV)      Thuế TNCN    Thực lĩnh');
    for (const s of slips) {
      const insurance = (s.socialInsurance ?? 0) + (s.healthInsurance ?? 0) + (s.unemploymentInsurance ?? 0);
      console.log(`  ${String(s.employeeCode).padEnd(10)} ${`${s.payableWorkingDays}/${s.standardWorkingDays}`.padEnd(8)} ${money(s.grossEarnings)} ${money(s.otBreakdown?.otPay ?? 0, 11)} ${money(insurance)} ${money(s.pitAmount)} ${money(s.netSalary)}`);
    }
  }
  const active = periods.find(p => p.period === ACTIVE_PERIOD);
  if (!active || active.status === 'CLOSED') return;
  const { blockers, missingDays, pending } = await collectOpenItems(demo, people, active);
  console.log(`\nBlocker kỳ ${ACTIVE_PERIOD}:`);
  const rows = [
    ...blockers.map(b => ({ date: b.date, code: people.codeByUser.get(b.employeeId) ?? b.employee.code, note: b.note })),
    ...missingDays.map(d => ({ date: d.workDate, code: people.codeByUser.get(d.userId), note: 'Không có dữ liệu chấm công cả ngày' })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) console.log('  (không còn)');
  for (const r of rows) {
    const demoTag = DEMO_KEEP.includes(r.code as any) ? '  ← demo trực tiếp' : '';
    console.log(`  ${r.date}  ${String(r.code).padEnd(10)} ${people.byCode.get(r.code!)?.fullName.padEnd(18)} ${r.note}${demoTag}`);
  }
  console.log(`Đơn chờ duyệt trong kỳ ${ACTIVE_PERIOD}:`);
  if (!pending.length) console.log('  (không còn)');
  for (const r of pending) {
    const code = people.codeByUser.get(String(r.employeeUserId));
    const kind = r.type === 'OVERTIME' ? 'OT' : r.source === 'ATTENDANCE_CONFIRMATION' ? 'Giải trình' : 'Selfie';
    console.log(`  ${new Date(r.workDate).toISOString().slice(0, 10)}  ${String(code).padEnd(10)} ${kind.padEnd(10)} ${r.reason}`);
  }
  const pendingLeaves: any[] = await demo.model('LeaveRequest').find({ organizationId: people.orgId, status: 'PENDING_MANAGER' }).lean();
  for (const l of pendingLeaves) console.log(`  ${l.startDate}  ${String(people.codeByUser.get(String(l.employeeId))).padEnd(10)} Nghỉ phép  ${l.reason} (chờ QL duyệt)`);
  const acknowledged = await demo.model('EmployeeTimesheetAcknowledgement').countDocuments({ periodId: active._id, periodVersion: active.version, action: 'ACKNOWLEDGED' });
  console.log(`Nhân viên đã xác nhận bảng công ${ACTIVE_PERIOD} (phiên bản hiện tại): ${acknowledged}/${people.byCode.size}`);
}

function money(value: number, width = 12) { return Math.round(value ?? 0).toLocaleString('vi-VN').padStart(width); }

async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
  const list = (name: string, fallback: string[]) => (arg(name) === undefined ? fallback : arg(name)!.split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
  const step = (arg('step') ?? 'status') as Step;
  if (!['status', 'resolve', 'ack', 'confirm', 'close', 'rollback', 'all'].includes(step)) throw new Error(`--step không hợp lệ: ${step}`);
  const to = (arg('to') ?? 'main').toLowerCase() as SnapshotStage;
  if (!['main', 'alt'].includes(to)) throw new Error(`--to không hợp lệ: ${to} (chọn main | alt)`);
  const demo = await createDemoApp();
  try {
    const options: FlowOptions = { orgCode: (arg('org-code') ?? 'ANPHAT').toUpperCase(), step, keep: list('keep', DEMO_KEEP), skipAck: list('skip-ack', DEMO_SKIP_ACK), period: arg('period'), to };
    if (step !== 'status') await runDemoFlow(demo, options);
    await printDemoStatus(demo, options.orgCode);
  } finally {
    await demo.close();
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error('[demo-flow] Thất bại:', error instanceof ConflictException ? errorText(error) : error?.message ?? error);
    process.exit(1);
  });
}
