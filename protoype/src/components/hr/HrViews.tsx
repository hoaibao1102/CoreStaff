/**
 * HrViews.tsx — HR desktop screens (tenant-level).
 *
 * H01 HrDashboard  : lean org-structure overview + period list w/ per-status actions
 * H02 HrPeriodDetail: status stepper, blockers (FR-HR-02), department confirmations
 *                    (FR-HR-03), close (FR-HR-04), reopen (FR-HR-05), export (FR-HR-06)
 * H03 HrShiftConfig : ShiftTemplate CRUD (SRS §6 / FR-HRCFG) — HR defines the
 *                    tenant's "ca làm"; nothing about hours is hard-coded.
 *
 * HrApp is self-contained (useHr + local modals) so both App.tsx (demo shell)
 * and PrototypeWorkspace (harness) render the same component.
 */
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Layers,
  LockKeyhole,
  MapPin,
  Plus,
  RotateCcw,
  Timer,
  Users,
  XCircle,
} from 'lucide-react';
import { AccountingPeriod, PeriodStatus, PeriodBlockerType, ShiftTemplate } from '../../types';
import { AuditTimeline, EmptyState } from '../common/CommonStates';
import { useHr } from '../../hooks/useHr';
import { HrError, type NewShiftInput } from '../../services/hrService';

/* PeriodStatusBadge — local to HR.
 * ponytail: move to common/Badges.tsx when a 2nd consumer exists. */
export const PeriodStatusBadge: React.FC<{ status: PeriodStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const config: Record<PeriodStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    OPEN: { label: 'Đang mở', cls: 'bg-surface-variant text-on-surface-variant', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    REVIEWING: { label: 'Đang rà soát', cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', icon: <Clock className="w-3.5 h-3.5" /> },
    READY_TO_CLOSE: { label: 'Sẵn sàng chốt', cls: 'bg-primary-container text-on-primary-container', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    CLOSED: { label: 'Đã chốt', cls: 'bg-secondary-container text-on-secondary-container', icon: <LockKeyhole className="w-3.5 h-3.5" /> },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${c.cls} ${sizeClasses}`}>
      {c.icon}
      {c.label}
    </span>
  );
};

const BLOCKER_LABEL: Record<PeriodBlockerType, string> = {
  MISSING_CHECK_IN: 'Thiếu check-in',
  MISSING_CHECK_OUT: 'Thiếu check-out',
  PENDING_APPROVAL: 'Approval còn PENDING',
  PENDING_CLARIFICATION: 'Chờ giải trình',
};

/* ------------------------------------------------------------------ */
/* H01 — HR Dashboard                                                  */
/* ------------------------------------------------------------------ */

interface HrDashboardProps {
  periods: AccountingPeriod[];
  overview: { organizationName: string; departments: string[]; workplaces: string[]; shifts: string[]; employeeCount: number } | null;
  onOpenPeriod: (period: AccountingPeriod) => void;
  onOpenShifts: () => void;
  /** Live ShiftTemplate count from the HR config store, not the static seed. */
  shiftCount: number;
}

export const HrDashboard: React.FC<HrDashboardProps> = ({ periods, overview, onOpenPeriod, onOpenShifts, shiftCount }) => {
  const openCount = periods.filter((p) => p.status !== 'CLOSED').length;

  return (
    <div id="hr-dashboard-h01" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-on-surface tracking-tight">Chốt kỳ công & Cấu trúc nhân sự</h2>
            {openCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant">
                {openCount} kỳ đang mở
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Phòng Nhân sự quản trị cơ cấu và ca làm việc trong tenant, rà soát blocker, chốt / mở lại kỳ và xuất bảng tổng hợp.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-full px-2.5 py-1">
          <Building2 className="w-3.5 h-3.5" /> {overview?.organizationName ?? 'Tenant của bạn'}
        </span>
      </div>

      {/* Lean structure overview (FR-HRCFG summary — config CRUD để phase sau) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Phòng ban', value: overview?.departments.length ?? '—', icon: Layers, tone: 'text-primary bg-primary-fixed' },
          { label: 'Nơi làm việc', value: overview?.workplaces.length ?? '—', icon: MapPin, tone: 'text-on-success-container bg-success-container' },
          { label: 'Ca làm việc', value: shiftCount, icon: Timer, tone: 'text-on-primary-container bg-primary-container/50', onOpen: onOpenShifts },
          { label: 'Nhân viên', value: overview?.employeeCount ?? '—', icon: Users, tone: 'text-on-surface-variant bg-surface-variant' },
        ].map((kpi) => (
          <article key={kpi.label} className="relative bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${kpi.tone}`}>
              <kpi.icon className="h-4.5 w-4.5" />
            </div>
            <p className="text-xs text-on-surface-variant">{kpi.label}</p>
            <p className="mt-0.5 text-2xl font-bold text-on-surface">{kpi.value}</p>
            {kpi.onOpen && (
              <button
                id="btn-hr-open-shifts"
                type="button"
                onClick={kpi.onOpen}
                className="absolute right-3 top-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
              >
                Cấu hình <Plus className="w-3 h-3" />
              </button>
            )}
          </article>
        ))}
      </div>

      {/* Period table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
          <h3 className="text-sm font-bold text-on-surface">Danh sách kỳ công</h3>
          <span className="text-[11px] text-on-surface-variant">Mỗi tháng một kỳ · OPEN → REVIEWING → READY_TO_CLOSE → CLOSED</span>
        </div>
        {periods.length === 0 ? (
          <EmptyState title="Chưa có kỳ công" description="Hệ thống sẽ tự mở kỳ khi tháng mới bắt đầu." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Kỳ công</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Blocker</th>
                  <th className="py-3 px-4">Xác nhận phòng ban</th>
                  <th className="py-3 px-4">Phiên bản</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {periods.map((p) => {
                  const confirmed = p.confirmations.filter((c) => c.confirmedBy).length;
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-on-surface">{p.label}</p>
                        <p className="text-[11px] text-on-surface-variant font-mono">{p.id}</p>
                      </td>
                      <td className="py-3.5 px-4"><PeriodStatusBadge status={p.status} size="sm" /></td>
                      <td className="py-3.5 px-4">
                        {p.blockers.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-on-tertiary-fixed-variant">
                            <AlertTriangle className="w-3.5 h-3.5 text-tertiary-container" /> {p.blockers.length}
                          </span>
                        ) : (
                          <span className="text-outline">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {confirmed}/{p.confirmations.length} phòng ban
                      </td>
                      <td className="py-3.5 px-4 font-mono text-on-surface-variant">v{p.version}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenPeriod(p)}
                            className="px-2.5 py-1 text-xs font-semibold text-on-surface bg-surface-container-low hover:bg-surface-container rounded-md border border-outline-variant transition-colors"
                          >
                            {p.status === 'CLOSED' ? 'Xem snapshot' : 'Rà soát'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* H02 — Period detail (closing ceremony)                               */
/* ------------------------------------------------------------------ */

const STATUS_STEPS: PeriodStatus[] = ['OPEN', 'REVIEWING', 'READY_TO_CLOSE', 'CLOSED'];
const STEP_LABEL: Record<PeriodStatus, string> = {
  OPEN: 'Mở kỳ',
  REVIEWING: 'Rà soát',
  READY_TO_CLOSE: 'Sẵn sàng chốt',
  CLOSED: 'Đã chốt',
};

interface HrPeriodDetailProps {
  period: AccountingPeriod;
  busy: boolean;
  onBack: () => void;
  onConfirmDepartment: (department: string) => void;
  onClosePeriod: () => void;
  onReopen: (reason: string) => void;
  onExport: () => void;
}

export const HrPeriodDetail: React.FC<HrPeriodDetailProps> = ({
  period,
  busy,
  onBack,
  onConfirmDepartment,
  onClosePeriod,
  onReopen,
  onExport,
}) => {
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const requiredConfs = period.confirmations.filter((c) => c.required);
  const allRequiredConfirmed = requiredConfs.every((c) => c.confirmedBy);
  const canClose = period.status === 'READY_TO_CLOSE' && period.blockers.length === 0 && allRequiredConfirmed;
  const stepIndex = STATUS_STEPS.indexOf(period.status);

  const blockersByDept: Record<string, number> = {};
  period.blockers.forEach((b) => {
    blockersByDept[b.employee.department] = (blockersByDept[b.employee.department] ?? 0) + 1;
  });

  const submitReopen = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setReasonError('Lý do bắt buộc, tối thiểu 10 ký tự (FR-HR-05).');
      return;
    }
    setReasonError('');
    setReopenOpen(false);
    onReopen(trimmed);
    setReason('');
  };

  return (
    <div id="hr-period-detail-h02" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
        <button
          id="btn-hr-back-to-periods"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách kỳ công
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant font-mono">{period.id}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-low border border-outline-variant text-on-surface-variant">
            phiên bản kỳ v{period.version}
          </span>
          <PeriodStatusBadge status={period.status} />
        </div>
      </div>

      <h2 className="text-lg font-bold text-on-surface tracking-tight">{period.label} · {period.organizationName}</h2>

      {/* Status stepper (FR-HR-01) */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm">
        <div className="flex items-center gap-2">
          {STATUS_STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <React.Fragment key={s}>
                {i > 0 && <div className={`h-0.5 flex-1 rounded ${done || active ? 'bg-primary' : 'bg-outline-variant'}`} />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  active ? 'bg-primary text-on-primary border-primary' : done ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'bg-surface-container-low text-on-surface-variant border-outline-variant'
                }`}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-on-primary' : 'bg-outline'}`} />}
                  {STEP_LABEL[s]}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Reopen invalidation banner */}
      {period.status === 'REVIEWING' && period.version > 1 && (
        <div className="p-4 rounded-xl bg-tertiary-fixed border border-tertiary-fixed-dim text-on-tertiary-fixed-variant text-xs leading-relaxed">
          <div className="flex items-center gap-2 font-bold">
            <RotateCcw className="w-4 h-4" /> Kỳ vừa được mở lại (v{period.version})
          </div>
          <p className="mt-1 pl-6">
            Snapshot export cũ đã bị <strong>vô hiệu</strong>. Toàn bộ phòng ban phải xác nhận lại trước khi chốt lại kỳ.
          </p>
        </div>
      )}

      {/* Blockers (FR-HR-02) */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-tertiary-container" /> Blocker cần xử lý
          </h3>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${period.blockers.length ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-secondary-container text-on-secondary-container'}`}>
            {period.blockers.length} blocker
          </span>
        </div>
        {period.blockers.length === 0 ? (
          <p className="px-5 py-4 text-xs text-on-surface-variant">Không còn blocker — dữ liệu ngày công đã đủ điều kiện soát xét.</p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {period.blockers.map((b) => (
              <li key={b.id} className="px-5 py-3.5 flex items-start gap-3">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-tertiary-container" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-on-surface">
                    {b.employee.name} <span className="font-mono text-[10px] text-on-surface-variant">({b.employee.code} · {b.employee.department})</span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    <span className="font-semibold text-on-tertiary-fixed-variant">{BLOCKER_LABEL[b.type]}</span> · ngày {b.date} — {b.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Department confirmations (FR-HR-03) */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="border-b border-outline-variant px-5 py-3.5">
          <h3 className="text-sm font-bold text-on-surface">Xác nhận sẵn sàng của phòng ban</h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Chỉ xác nhận được khi phòng ban không còn blocker.</p>
        </div>
        <ul className="divide-y divide-outline-variant">
          {period.confirmations.map((c) => {
            const deptBlockers = blockersByDept[c.department] ?? 0;
            const blocked = deptBlockers > 0;
            return (
              <li key={c.department} className="px-5 py-3.5 flex items-center gap-3">
                {c.confirmedBy ? (
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-secondary" />
                ) : (
                  <span className="w-4.5 h-4.5 shrink-0 rounded-full border-2 border-outline" />
                )}
                <div className="flex-1">
                  <p className="text-xs font-bold text-on-surface">
                    {c.department}
                    {c.required && <span className="ml-1.5 text-[9px] font-bold uppercase text-on-tertiary-fixed-variant bg-tertiary-fixed rounded px-1.5 py-0.5">bắt buộc</span>}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {c.employeeCount} nhân viên
                    {c.confirmedBy && <> · {c.confirmedBy} lúc {c.confirmedAt}</>}
                    {blocked && <> · <span className="font-semibold text-on-tertiary-fixed-variant">{deptBlockers} blocker chưa xử lý</span></>}
                  </p>
                </div>
                {!c.confirmedBy && period.status !== 'CLOSED' && (
                  <button
                    type="button"
                    disabled={blocked || busy}
                    onClick={() => onConfirmDepartment(c.department)}
                    title={blocked ? 'Còn blocker — không thể xác nhận' : undefined}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-on-surface bg-surface-container-low hover:bg-surface-container border-outline-variant"
                  >
                    Xác nhận
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Close panel (FR-HR-04) */}
      {period.status !== 'CLOSED' && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-on-surface">Chốt kỳ công</h3>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {canClose
                ? 'Đủ điều kiện — hệ thống sẽ kiểm tra lại toàn bộ blocker trong transaction và tạo snapshot tổng hợp.'
                : period.status !== 'READY_TO_CLOSE'
                  ? 'Kỳ chưa ở trạng thái READY_TO_CLOSE — cần rà soát xong blocker và xác nhận phòng ban.'
                  : 'Còn blocker hoặc phòng ban bắt buộc chưa xác nhận.'}
            </p>
          </div>
          <button
            id="btn-hr-close-period"
            type="button"
            disabled={!canClose || busy}
            onClick={onClosePeriod}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-on-primary shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LockKeyhole className="w-4 h-4" /> Chốt kỳ công
          </button>
        </div>
      )}

      {/* CLOSED: snapshot + export + reopen (FR-HR-04/05/06) */}
      {period.status === 'CLOSED' && (
        <>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Snapshot bảng tổng hợp</h3>
                <p className="text-[11px] text-on-surface-variant">
                  {period.summary.employeeCount} hồ sơ · tạo lúc {period.summary.generatedAt ?? '—'} · {period.exportedAt ? `đã xuất ${period.exportedAt}` : 'chưa xuất'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-hr-export-csv"
                  type="button"
                  disabled={busy}
                  onClick={onExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-secondary text-on-secondary shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất CSV
                </button>
                <button
                  id="btn-hr-reopen-period"
                  type="button"
                  disabled={busy}
                  onClick={() => setReopenOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-tertiary-fixed-dim text-on-tertiary-fixed-variant bg-tertiary-fixed/50 hover:bg-tertiary-fixed transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Mở lại kỳ
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Mã NV</th>
                    <th className="py-2.5 px-4">Họ tên</th>
                    <th className="py-2.5 px-4">Phòng ban</th>
                    <th className="py-2.5 px-4 text-right">Ngày công</th>
                    <th className="py-2.5 px-4 text-right">Phút làm việc</th>
                    <th className="py-2.5 px-4 text-right">Trễ</th>
                    <th className="py-2.5 px-4 text-right">Về sớm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {period.summaries.map((s) => (
                    <tr key={s.employeeCode}>
                      <td className="py-2.5 px-4 font-mono font-bold text-primary">{s.employeeCode}</td>
                      <td className="py-2.5 px-4 font-medium text-on-surface">{s.employeeName}</td>
                      <td className="py-2.5 px-4 text-on-surface-variant">{s.department}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-on-surface">{s.workingDays}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-on-surface">{s.workingMinutes.toLocaleString('vi-VN')}</td>
                      <td className={`py-2.5 px-4 text-right font-mono ${s.lateMinutes ? 'text-tertiary' : 'text-outline'}`}>{s.lateMinutes}</td>
                      <td className={`py-2.5 px-4 text-right font-mono ${s.earlyMinutes ? 'text-tertiary' : 'text-outline'}`}>{s.earlyMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reopen modal — mandatory reason */}
          {reopenOpen && (
            <div id="hr-reopen-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest border border-outline-variant p-5 shadow-xl">
                <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
                  <RotateCcw className="w-4.5 h-4.5 text-tertiary-container" />
                  <h3 className="text-sm font-bold text-on-surface">Mở lại {period.label}</h3>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">
                  Bắt buộc nhập lý do (10–1000 ký tự, ghi audit). Mở lại sẽ <strong>vô hiệu snapshot export cũ</strong> và các phòng ban phải xác nhận lại.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(''); }}
                  rows={3}
                  placeholder="VD: Phát hiện 1 ngày công chưa duyệt sau khi chốt kỳ…"
                  className="mt-3 w-full rounded-lg border border-outline bg-white p-3 text-xs outline-none focus:ring-2 focus:ring-slate-900"
                />
                {reasonError && <p className="mt-1.5 text-[11px] font-semibold text-error">{reasonError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => { setReopenOpen(false); setReasonError(''); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low">
                    Hủy
                  </button>
                  <button type="button" onClick={submitReopen} className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-tertiary-container text-on-tertiary-container hover:opacity-90">
                    Xác nhận mở lại
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Audit */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Nhật ký thao tác kỳ công</h4>
        <AuditTimeline logs={[...period.auditTrail].reverse()} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* H03 — ShiftTemplate configuration (SRS §6, FR-HRCFG)                 */
/* ------------------------------------------------------------------ */

const INPUT_CLS = 'w-full rounded-lg border border-outline bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40';

interface ShiftForm {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  gracePeriodMinutes: string;
}

const EMPTY_SHIFT: ShiftForm = {
  name: '', code: '', startTime: '08:00', endTime: '17:00', breakMinutes: '60', gracePeriodMinutes: '15',
};

const formOf = (s: ShiftTemplate): ShiftForm => ({
  name: s.name, code: s.code, startTime: s.startTime, endTime: s.endTime,
  breakMinutes: String(s.breakMinutes), gracePeriodMinutes: String(s.gracePeriodMinutes),
});

const toInput = (f: ShiftForm): NewShiftInput => ({
  name: f.name,
  code: f.code,
  startTime: f.startTime,
  endTime: f.endTime,
  breakMinutes: Number(f.breakMinutes),
  gracePeriodMinutes: Number(f.gracePeriodMinutes),
});

const hhmmToMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fmtSpan = (s: ShiftTemplate) => {
  const net = hhmmToMinutes(s.endTime) - hhmmToMinutes(s.startTime) - s.breakMinutes;
  return `${Math.floor(net / 60)}h${net % 60 ? ` ${net % 60}′` : ''} tính công`;
};

interface HrShiftConfigProps {
  shifts: ShiftTemplate[];
  busy: boolean;
  onBack: () => void;
  onCreate: (input: NewShiftInput) => void;
  onUpdate: (id: string, patch: Partial<NewShiftInput> & { active?: boolean }) => void;
}

export const HrShiftConfig: React.FC<HrShiftConfigProps> = ({ shifts, busy, onBack, onCreate, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_SHIFT);
  const [error, setError] = useState('');

  const setField = (key: keyof ShiftForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError('');
  };

  const startCreate = () => {
    setEditingId('new');
    setForm(EMPTY_SHIFT);
    setError('');
  };
  const startEdit = (s: ShiftTemplate) => {
    setEditingId(s.id);
    setForm(formOf(s));
    setError('');
  };

  // FE pre-check mirrors the service rules (SRS §6.2) — the service still
  // re-validates, so the UI can never authorise an invalid shift.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return setError('Tên và mã ca là bắt buộc.');
    const start = hhmmToMinutes(form.startTime);
    const end = hhmmToMinutes(form.endTime);
    if (!(end > start)) return setError('Ca phải bắt đầu và kết thúc trong cùng ngày — hệ thống không hỗ trợ ca qua đêm.');
    const brk = Number(form.breakMinutes);
    const grace = Number(form.gracePeriodMinutes);
    if (Number.isNaN(brk) || Number.isNaN(grace) || brk < 0 || grace < 0) return setError('Nghỉ giữa ca và grace phải là số phút hợp lệ.');
    if (brk >= end - start) return setError('Nghỉ giữa ca phải ngắn hơn tổng thời lượng ca.');
    setEditingId(null);
    (editingId && editingId !== 'new' ? onUpdate(editingId, toInput(form)) : onCreate(toInput(form)));
    setForm(EMPTY_SHIFT);
  };

  return (
    <div id="hr-shift-config-h03" className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
        <button
          id="btn-hr-back-to-periods"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Danh sách kỳ công
        </button>
        <button
          id="btn-hr-new-shift"
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Tạo ca làm việc
        </button>
      </div>

      <div>
        <h2 className="text-lg font-bold text-on-surface tracking-tight">Ca làm việc (ShiftTemplate)</h2>
        <p className="text-xs text-on-surface-variant mt-1">
          HR cấu hình toàn bộ ca cho Organization — giờ ca hành chính chỉ là dữ liệu seed, không hard-code trong backend (SRS §6.1).
        </p>
      </div>

      {editingId && (
        <form onSubmit={submit} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            {editingId === 'new' ? 'Tạo ca mới' : 'Cập nhật ca'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Tên ca <span className="font-normal text-on-surface-variant">(VD: Ca hành chính)</span></span>
              <input value={form.name} onChange={setField('name')} placeholder="Ca hành chính" className={INPUT_CLS} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Mã ca <span className="font-normal text-on-surface-variant">(duy nhất trong tenant)</span></span>
              <input value={form.code} onChange={setField('code')} placeholder="OFFICE" maxLength={10} className={`${INPUT_CLS} font-mono uppercase`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Bắt đầu</span>
              <input type="time" value={form.startTime} onChange={setField('startTime')} className={`${INPUT_CLS} font-mono`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Kết thúc <span className="font-normal text-on-surface-variant">(cùng ngày)</span></span>
              <input type="time" value={form.endTime} onChange={setField('endTime')} className={`${INPUT_CLS} font-mono`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Nghỉ giữa ca (phút)</span>
              <input value={form.breakMinutes} onChange={setField('breakMinutes')} inputMode="numeric" className={`${INPUT_CLS} font-mono`} />
              <span className="mt-1 block text-[10px] text-on-surface-variant">Không chấm công riêng cho giờ nghỉ — hệ thống trừ theo cấu hình (SRS §6.6).</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-on-surface">Grace check-in (phút)</span>
              <input value={form.gracePeriodMinutes} onChange={setField('gracePeriodMinutes')} inputMode="numeric" className={`${INPUT_CLS} font-mono`} />
              <span className="mt-1 block text-[10px] text-on-surface-variant">lateMinutes = max(0, check-in − (giờ ca bắt đầu + grace)).</span>
            </label>
          </div>
          {error && <p className="text-[11px] font-semibold text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditingId(null); setError(''); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container-low">Hủy</button>
            <button type="submit" disabled={busy} className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-40">
              {busy ? 'Đang lưu…' : editingId === 'new' ? 'Tạo ca' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}

      {shifts.length === 0 ? (
        <EmptyState
          title="Chưa có ca làm việc"
          description="Tạo ShiftTemplate đầu tiên cho Organization — Employee chỉ có thể được xếp ca khi tồn tại ca hợp lệ."
          icon={<Timer className="w-6 h-6" />}
          actionText="Tạo ca làm việc"
          onAction={startCreate}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3.5">
            <h3 className="text-sm font-bold text-on-surface">Danh sách ca</h3>
            <span className="text-[11px] text-on-surface-variant">Ca đang dùng chỉ ngừng kích hoạt, không xóa cứng</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ca</th>
                  <th className="py-3 px-4">Giờ</th>
                  <th className="py-3 px-4">Nghỉ</th>
                  <th className="py-3 px-4">Grace</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {shifts.map((s) => (
                  <tr key={s.id} className={s.active ? 'hover:bg-surface-container-low/70 transition-colors' : 'opacity-60'}>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-on-surface">{s.name}</p>
                      <p className="text-[11px] text-on-surface-variant font-mono">{s.code}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-on-surface">
                      {s.startTime} – {s.endTime}
                      <p className="text-[10px] text-on-surface-variant font-sans">{fmtSpan(s)}</p>
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">{s.breakMinutes}′</td>
                    <td className="py-3.5 px-4 text-on-surface-variant">{s.gracePeriodMinutes}′</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        s.active ? 'bg-success-container text-on-success-container' : 'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {s.active ? 'Đang dùng' : 'Ngừng kích hoạt'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => startEdit(s)} className="px-2.5 py-1 text-xs font-semibold text-on-surface bg-surface-container-low hover:bg-surface-container rounded-md border border-outline-variant transition-colors">
                          Sửa
                        </button>
                        <button type="button" onClick={() => onUpdate(s.id, { active: !s.active })} className="px-2.5 py-1 text-xs font-semibold rounded-md border border-outline-variant transition-colors text-on-surface hover:bg-surface-container-low">
                          {s.active ? 'Ngừng' : 'Kích hoạt'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-tertiary-fixed border border-tertiary-fixed-dim text-on-tertiary-fixed-variant text-xs leading-relaxed">
        <div className="flex items-center gap-2 font-bold">
          <Clock className="w-4 h-4" /> Ca được dùng thế nào
        </div>
        <p className="mt-1">
          Full-time: HR tạo ca → HR hoặc Trưởng phòng xếp lịch định kỳ → hệ thống sinh WorkSchedule theo ngày.
          Part-time: HR mở đợt đăng ký và công bố ca → nhân viên đăng ký → Trưởng phòng duyệt → ca DUYỆT thành WorkSchedule chính thức.
          Lịch sử chấm công luôn tính theo snapshot của WorkSchedule, nên sửa ca không làm thay đổi kỳ đã chốt.
        </p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* HrApp — stateful wrapper (demo shell + harness)                      */
/* ------------------------------------------------------------------ */

export const HrApp: React.FC<{ initialPeriodId?: string }> = ({ initialPeriodId }) => {
  const hr = useHr();
  const [selectedId, setSelectedId] = useState<string | null>(initialPeriodId ?? null);
  const [view, setView] = useState<'PERIODS' | 'SHIFTS'>('PERIODS');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    void hr.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = hr.periods.find((p) => p.id === selectedId) ?? null;

  const run = async (fn: () => Promise<unknown>, successText?: string) => {
    setBusy(true);
    setFlash(null);
    try {
      await fn();
      if (successText) setFlash({ kind: 'success', text: successText });
    } catch (err) {
      setFlash({ kind: 'error', text: err instanceof HrError ? err.message : 'Có lỗi phát sinh, vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {flash && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold ${
            flash.kind === 'error' ? 'border-error/20 bg-error-container text-on-error-container' : 'border-success/20 bg-success-container text-on-success-container'
          }`}
        >
          {flash.kind === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {flash.text}
        </div>
      )}

      {view === 'SHIFTS' ? (
        <HrShiftConfig
          shifts={hr.shifts}
          busy={busy}
          onBack={() => setView('PERIODS')}
          onCreate={(input) =>
            run(() => hr.createShift(input), 'Đã tạo ca làm việc — nhân viên có thể được xếp ca này.')
          }
          onUpdate={(id, patch) =>
            run(() => hr.updateShift(id, patch), 'Đã cập nhật ca — lịch sử chấm công đã chốt không thay đổi.')
          }
        />
      ) : selected ? (
        <HrPeriodDetail
          period={selected}
          busy={busy}
          onBack={() => setSelectedId(null)}
          onConfirmDepartment={(dept) =>
            run(async () => {
              await hr.confirmDepartment(selected.id, dept);
            }, `Đã xác nhận ${dept} sẵn sàng.`)
          }
          onClosePeriod={() =>
            run(async () => {
              await hr.closePeriod(selected.id);
            }, 'Đã chốt kỳ công — snapshot tổng hợp đã được tạo.')
          }
          onReopen={(reason) =>
            run(async () => {
              await hr.reopenPeriod(selected.id, reason);
            }, 'Kỳ đã mở lại — snapshot export cũ bị vô hiệu.')
          }
          onExport={() =>
            run(async () => {
              const { csv } = await hr.exportSnapshot(selected.id);
              downloadCsv(csv, `timesheet-${selected.month}.csv`);
            }, 'Đã tải bảng tổng hợp CSV.')
          }
        />
      ) : (
        <HrDashboard
          periods={hr.periods}
          overview={hr.overview}
          shiftCount={hr.shifts.length}
          onOpenPeriod={(p) => setSelectedId(p.id)}
          onOpenShifts={() => setView('SHIFTS')}
        />
      )}
    </main>
  );
};
