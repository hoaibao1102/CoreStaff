import { useState } from 'react';
import { AlertCircle, FlaskConical, Info, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { Input } from '@/components/input';
import {
  evaluateWorkCreditSimulation,
  getWorkCreditMinuteRanges,
  resolveWorkCreditPreviewRules,
  parseScenarioMinutes,
  type WorkCreditPolicyRules,
  type WorkCreditDayType,
  type WorkCreditIncompleteState,
  type WorkCreditReasonCode,
} from './work-credit-simulation';

const reasonText: Record<WorkCreditReasonCode, string> = {
  FULL_CREDIT: 'Đạt ngưỡng đủ ngày.',
  HALF_CREDIT: 'Đạt ngưỡng nửa ngày, chưa đạt ngưỡng đủ ngày.',
  BELOW_HALF_DAY: 'Phút được ghi nhận dưới ngưỡng nửa ngày.',
  UNPAID_LEAVE: 'Không có phút được ghi nhận và có phép không hưởng lương trong scenario.',
  WEEKLY_OFF: 'Ngày nghỉ hàng tuần: standard credit bằng 0.',
  PUBLIC_HOLIDAY: 'Ngày lễ: standard credit bằng 0; không kết luận quyền hưởng lương ngày lễ.',
  INCOMPLETE_DAY_BLOCKED: 'Ngày chưa hoàn tất; cần xử lý mốc công trước khi xác nhận.',
  FORFEITED_MISSING_PUNCH: 'Scenario đã xác định không ghi nhận do thiếu mốc công.',
  NO_SCHEDULED_OBLIGATION: 'Không có nghĩa vụ theo lịch; không chia cho 0.',
};

type Props = {
  halfPercent: string;
  fullPercent: string;
  paidLeaveCreditEnabled: boolean;
  disabled?: boolean;
  originalRules?: WorkCreditPolicyRules;
};

export function WorkCreditSimulationPreview({
  halfPercent,
  fullPercent,
  paidLeaveCreditEnabled,
  disabled = false,
  originalRules,
}: Props) {
  const [worked, setWorked] = useState('0');
  const [leave, setLeave] = useState('0');
  const [unpaid, setUnpaid] = useState('0');
  const [obligation, setObligation] = useState('480');
  const [custom, setCustom] = useState('480');
  const [zero, setZero] = useState(false);
  const [dayType, setDayType] = useState<WorkCreditDayType>('SCHEDULED');
  const [incomplete, setIncomplete] = useState<WorkCreditIncompleteState>('COMPLETE');

  const W = parseScenarioMinutes(worked);
  const L = parseScenarioMinutes(leave);
  const U = parseScenarioMinutes(unpaid);
  const rawS = parseScenarioMinutes(obligation === 'custom' ? custom : obligation);
  const S = zero ? 0 : rawS === 0 ? null : rawS;

  const rules = resolveWorkCreditPreviewRules(halfPercent, fullPercent, paidLeaveCreditEnabled, originalRules);
  const result =
    rules && W !== null && L !== null && U !== null && S !== null
      ? evaluateWorkCreditSimulation(rules, {
          scheduledObligationMinutes: S,
          workedScheduledMinutes: W,
          payableLeaveMinutes: L,
          unpaidLeaveMinutes: U,
          dayType,
          incompleteState: incomplete,
        })
      : null;

  const ranges = rules && S !== null ? getWorkCreditMinuteRanges(rules, S) : null;

  const minutes = (
    id: string,
    label: string,
    value: string,
    change: (v: string) => void,
    valid = parseScenarioMinutes(value) !== null,
  ) => (
    <div className="space-y-1.5">
      <label htmlFor={`simulation-${id}`} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      <Input
        id={`simulation-${id}`}
        type="number"
        min={id === 'custom' ? 1 : 0}
        max={1440}
        step={1}
        value={value}
        disabled={disabled}
        aria-invalid={!valid}
        aria-describedby={!valid ? `simulation-${id}-error` : undefined}
        onChange={(e) => change(e.target.value)}
        className="h-9 text-sm"
      />
      {!valid && (
        <p id={`simulation-${id}-error`} className="text-xs font-medium text-destructive">
          Nhập số phút nguyên {id === 'custom' ? '1' : '0'}–1440; không để trống.
        </p>
      )}
    </div>
  );

  const selectClass =
    'h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all disabled:opacity-50';

  return (
    <section
      aria-label="Policy Simulation Lab"
      className="space-y-4 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FlaskConical className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Policy Simulation Lab</h3>
              <span className="rounded-full bg-blue-100/80 border border-blue-200/60 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                Thử nghiệm tức thì
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mô phỏng, không sửa bảng công/lương, không thay thế kết quả kỳ thực tế
            </p>
          </div>
        </div>
      </div>

      {/* Tip Banner */}
      <div className="rounded-lg bg-blue-50/50 border border-blue-100/70 p-2.5 text-xs text-blue-900/90 flex items-start gap-2">
        <Info className="size-3.5 text-blue-600 shrink-0 mt-0.5" />
        <p>
          Đây là scenario, không thay ca doanh nghiệp. W chỉ gồm phút trong ca, không OT; W và phép phải được chuẩn hóa không trùng nhau.
        </p>
      </div>

      {/* Input Grid */}
      <div className="grid gap-3.5 sm:grid-cols-2 bg-white rounded-xl border border-slate-200/70 p-3.5">
        <div className="space-y-1.5">
          <label htmlFor="simulation-obligation" className="text-xs font-semibold text-foreground">
            S — Nghĩa vụ mẫu (phút)
          </label>
          <select
            id="simulation-obligation"
            className={selectClass}
            disabled={disabled}
            value={obligation}
            onChange={(e) => setObligation(e.target.value)}
          >
            <option value="240">240 phút</option>
            <option value="450">450 phút</option>
            <option value="480">480 phút</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </div>
        {obligation === 'custom' &&
          minutes('custom', 'Nghĩa vụ tùy chỉnh (phút)', custom, setCustom, rawS !== null && rawS > 0)}
        {minutes('worked', 'W — Làm việc trong ca (phút)', worked, setWorked)}
        {minutes('leave', 'L — Phép hưởng lương (phút)', leave, setLeave)}
        {minutes('unpaid', 'Phép không hưởng lương (phút)', unpaid, setUnpaid)}
      </div>

      {/* Scenario nâng cao */}
      <details className="group rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs transition-all">
        <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-foreground select-none">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="size-3.5 text-primary" />
            Scenario nâng cao
          </span>
          <span className="text-[11px] text-muted-foreground font-normal group-open:hidden">
            Mở rộng tùy chọn
          </span>
        </summary>
        <div className="mt-3 grid gap-3 pt-2.5 border-t border-slate-100 sm:grid-cols-2 text-xs">
          <div className="space-y-1">
            <label htmlFor="simulation-day-type" className="font-medium text-foreground">
              Loại ngày
            </label>
            <select
              id="simulation-day-type"
              className={selectClass}
              disabled={disabled}
              value={dayType}
              onChange={(e) => setDayType(e.target.value as WorkCreditDayType)}
            >
              <option value="SCHEDULED">Có lịch làm việc</option>
              <option value="WEEKLY_OFF">Nghỉ hàng tuần</option>
              <option value="PUBLIC_HOLIDAY">Ngày lễ</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="simulation-incomplete" className="font-medium text-foreground">
              Trạng thái hoàn tất
            </label>
            <select
              id="simulation-incomplete"
              className={selectClass}
              disabled={disabled}
              value={incomplete}
              onChange={(e) => setIncomplete(e.target.value as WorkCreditIncompleteState)}
            >
              <option value="COMPLETE">Hoàn tất</option>
              <option value="UNRESOLVED">Chưa xử lý / thiếu mốc công</option>
              <option value="FORFEITED_MISSING_PUNCH">Đã xác định không ghi nhận do thiếu mốc</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="simulation-zero" className="font-medium text-foreground">
              Nghĩa vụ bằng 0 (nâng cao)
            </label>
            <select
              id="simulation-zero"
              className={selectClass}
              disabled={disabled}
              value={String(zero)}
              onChange={(e) => setZero(e.target.value === 'true')}
            >
              <option value="false">Dùng nghĩa vụ mẫu</option>
              <option value="true">S = 0 phút</option>
            </select>
          </div>
        </div>
      </details>

      {/* Result Section */}
      {result ? (
        <div className="space-y-3">
          {/* Result Card */}
          <div
            className={`rounded-xl border p-4 shadow-xs transition-all ${
              result.workCredit === 1
                ? 'border-emerald-200/90 bg-emerald-50/50'
                : result.workCredit === 0.5
                ? 'border-blue-200/90 bg-blue-50/50'
                : 'border-amber-200/90 bg-amber-50/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`size-11 rounded-xl flex items-center justify-center font-bold text-base shadow-2xs ${
                    result.workCredit === 1
                      ? 'bg-emerald-600 text-white'
                      : result.workCredit === 0.5
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {result.workCredit}
                </div>
                <div>
                  <p
                    aria-live="polite"
                    aria-atomic="true"
                    className="font-bold text-sm text-foreground"
                  >
                    Kết quả: {result.workCredit} đơn vị công — {result.reasonCode}. Chặn: {result.blocking ? 'Có' : 'Không'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reasonText[result.reasonCode]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="rounded-lg bg-white/90 border border-slate-200 px-2.5 py-1 text-xs font-mono font-bold text-foreground shadow-2xs">
                  {(result.creditRatio * 100).toFixed(1)}% ca
                </span>
                {result.blocking && (
                  <span className="rounded-lg bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-semibold">
                    Bị chặn
                  </span>
                )}
              </div>
            </div>

            {/* Formula / Param Breakdown */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 font-mono text-[11px] text-slate-700 bg-white/70 rounded-lg p-2 border border-slate-200/50 break-words">
              <p className="break-words">
                C: {result.creditedMinutes} phút; S: {result.scheduledObligationMinutes} phút; W: {result.workedScheduledMinutes} phút; L được tính: {paidLeaveCreditEnabled ? result.payableLeaveMinutes : 0} phút; R: {result.creditRatio} ({(result.creditRatio * 100).toFixed(2)}% để đọc; so sánh không làm tròn)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs font-medium text-destructive flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>Chưa có kết quả: kiểm tra ngưỡng và số phút.</span>
        </div>
      )}

      {/* Ranges and Tiers */}
      {ranges && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <p>
              Mốc tối thiểu nguyên: nửa ngày {ranges.halfMinimumMinutes ?? 'không áp dụng'}; đủ ngày {ranges.fullMinimumMinutes ?? 'không áp dụng'} phút.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 text-xs">
            <table className="w-full text-left">
              <caption className="bg-slate-50/90 px-3 py-2 text-left font-semibold text-slate-700 border-b">
                Bậc thang cho ngày có lịch, hoàn tất — ngưỡng {halfPercent}–{fullPercent}%
              </caption>
              <thead>
                <tr className="border-b bg-slate-50/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 px-3">Đơn vị công</th>
                  <th className="py-2 px-3">Phút được ghi nhận C</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([['0', ranges.zero], ['0.5', ranges.half], ['1', ranges.full]] as const).map(([credit, range]) => (
                  <tr key={credit} className="hover:bg-slate-50/50 transition-colors">
                    <th scope="row" className="py-2 px-3 font-bold text-foreground">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          credit === '1'
                            ? 'bg-emerald-100 text-emerald-800'
                            : credit === '0.5'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {credit}
                      </span>
                    </th>
                    <td className="py-2 px-3 text-slate-600 font-mono">
                      {range ? `${range.min}–${range.max} phút` : 'không có khoảng phút nguyên'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg bg-slate-100/70 p-3 text-xs text-muted-foreground leading-relaxed border border-slate-200/50">
        <p>
          Đây là bậc thang, không phải phép tính lương theo phút. Đi muộn/về sớm được theo dõi theo cấu hình chấm công riêng; không thể suy ra từ W. Kết quả 0 không tự động là nghỉ không lương; credit ngày lễ không kết luận quyền hưởng lương ngày lễ. Backend vẫn quyết định kết quả kỳ thực tế.
        </p>
      </div>
    </section>
  );
}
