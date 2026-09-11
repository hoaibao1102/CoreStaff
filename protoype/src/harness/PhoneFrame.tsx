import React from 'react';
import { AlertTriangle, Building2, Radar, Wifi, Camera } from 'lucide-react';
import { EmployeeHeader, ShiftCard, TodayStatusCard } from '../components/employee/EmployeeHeader';
import { AttendanceTimeline } from '../components/employee/AttendanceTimeline';
import { ExceptionSuggestionCard } from '../components/employee/VerificationCards';
import { ActionButton, BottomNavigation } from '../components/employee/ActionAndNav';
import { HistorySummary, HistoryListItem, DayDetailView } from '../components/employee/HistoryAndDetail';
import { CameraCapture, SelfiePreview } from '../components/employee/CameraComponents';
import { ErrorState, LoadingSkeleton } from '../components/common/CommonStates';
import { CURRENT_EMPLOYEE } from '../data/mockData';
import { DayAttendance, EmployeeTab } from '../types';
import { methodLabel } from '../hooks/useAttendance';
import { resolveMethod } from '../services/attendanceService';
import { loadActiveWorkplace } from '../services/adminService';
import { MOCK_SELFIE_EVIDENCE } from '../services/evidenceService';
import { inSignals } from './useSimulation';
import { UseAttendance, UseSimulation, SubmitParams } from './types';

export interface PhoneFrameProps {
  attendance: UseAttendance;
  sim: UseSimulation;
  employeeTab: EmployeeTab;
  onTabChange: (tab: EmployeeTab) => void;
  historyRecords: DayAttendance[];
  selectedHistoryDay: DayAttendance | null;
  onSelectHistoryDay: (day: DayAttendance | null) => void;
  onOpenPolicy: () => void;
  onOpenAdjustment: () => void;
  onOpenClarification: () => void;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  attendance,
  sim,
  employeeTab,
  onTabChange,
  historyRecords,
  selectedHistoryDay,
  onSelectHistoryDay,
  onOpenPolicy,
  onOpenAdjustment,
  onOpenClarification,
}) => {
  const { todayRecord } = attendance;
  const { simulatedSystemState, showExceptionSuggestion } = sim;

  const isCheckInAction = todayRecord.status === 'NOT_CHECKED_IN';
  const isCompleted = todayRecord.status === 'COMPLETED';

  // Build the raw submit signals + what method BE will decide, validating
  // against the tenant's admin-configured Workplace (same read the service does).
  const workplace = loadActiveWorkplace();
  const signals = {
    workMode: sim.workMode,
    ...inSignals(sim.workMode, sim.inCondition, sim.gpsDistance, sim.gpsAccuracy, sim.networkSource),
  };
  const resolvedMethod = resolveMethod(signals, workplace);
  const needsCamera = resolvedMethod === 'SELFIE';
  const matchedNetwork = workplace?.networks.find(
    (n) => n.active && signals.observedBssid && n.bssid.toUpperCase() === signals.observedBssid.toUpperCase(),
  );

  const isButtonEnabled = !isCompleted && sim.simulatedSystemState === 'NORMAL';

  const buildParams = (photoUrl?: string): SubmitParams => ({
    workMode: sim.workMode,
    ...inSignals(sim.workMode, sim.inCondition, sim.gpsDistance, sim.gpsAccuracy, sim.networkSource),
    photoUrl,
  });

  const handlePrimaryAction = () => {
    const mode: 'CHECK_IN' | 'CHECK_OUT' = isCheckInAction ? 'CHECK_IN' : 'CHECK_OUT';

    if (needsCamera) {
      // OUT_OFFICE with a pre-captured photo → submit directly (simulation).
      if (sim.workMode === 'OUT_OFFICE' && sim.outCondition === 'HAS_PHOTO') {
        const url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600';
        const p = buildParams(url);
        // Use hasPhoto as a direct selfie (method SELFIE) submission.
        if (isCheckInAction) attendance.checkIn(p);
        else attendance.checkOut(p);
        return;
      }
      // Otherwise camera flow (OUT no photo, or IN fallback with both network+GPS down).
      attendance.openCamera(mode);
      return;
    }

    // IN_OFFICE with network or GPS → one-touch submit (no camera).
    const p = buildParams();
    if (isCheckInAction) attendance.checkIn(p);
    else attendance.checkOut(p);
  };

  return (
    <div
      id="mobile-phone-frame"
      className="w-full max-w-[390px] min-h-[100dvh] sm:min-h-[780px] bg-surface sm:rounded-3xl border-0 sm:border-8 border-inverse-surface shadow-none sm:shadow-2xl overflow-hidden flex flex-col relative mx-auto"
    >
      {/* Phone Speaker Notch Indicator */}
      <div className="h-5 bg-inverse-surface flex items-center justify-center">
        <div className="w-16 h-1 rounded-full bg-surface-dim"></div>
      </div>

      <EmployeeHeader employee={CURRENT_EMPLOYEE} onOpenPolicy={onOpenPolicy} />

      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-surface-bright">
        {simulatedSystemState === 'LOADING' ? (
          <LoadingSkeleton />
        ) : simulatedSystemState !== 'NORMAL' ? (
          <ErrorState type={simulatedSystemState as any} onRetry={() => sim.setSimulatedSystemState('NORMAL')} />
        ) : selectedHistoryDay ? (
          <DayDetailView
            record={selectedHistoryDay}
            onBack={() => onSelectHistoryDay(null)}
            onOpenAdjustment={onOpenAdjustment}
            onOpenClarification={onOpenClarification}
          />
        ) : employeeTab === 'HISTORY' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Lịch sử chấm công</h3>
              <span className="text-xs font-semibold text-on-surface bg-surface-container-lowest border border-outline-variant px-2.5 py-1 rounded-lg">
                Tháng 08/2026
              </span>
            </div>
            <HistorySummary records={historyRecords} />
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Danh sách ngày làm việc ({historyRecords.length} ngày)
              </span>
              {historyRecords.map((rec) => (
                <HistoryListItem key={rec.id} record={rec} onSelect={(r) => onSelectHistoryDay(r)} />
              ))}
            </div>
          </div>
        ) : employeeTab === 'PROFILE' ? (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-on-surface">Hồ sơ nhân viên ERP</h3>
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant space-y-3 text-xs shadow-sm">
              <div>
                <span className="text-on-surface-variant block text-[10px]">Họ và tên:</span>
                <span className="font-bold text-on-surface">{CURRENT_EMPLOYEE.name}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">Mã nhân viên:</span>
                <span className="font-mono font-bold text-on-surface">{CURRENT_EMPLOYEE.code}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">Phòng ban:</span>
                <span>{CURRENT_EMPLOYEE.department}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">Cấp trên trực tiếp:</span>
                <span className="font-medium text-on-surface">{CURRENT_EMPLOYEE.manager}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">Cơ sở phân công:</span>
                <span>{CURRENT_EMPLOYEE.workplace}</span>
              </div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg text-xs text-on-surface-variant italic text-center">
              * Quản lý hợp đồng, phép năm và chế độ thuộc cổng ERP tập trung.
            </div>
          </div>
        ) : attendance.previewEvidence ? (
          <SelfiePreview
            photoUrl={attendance.previewEvidence.photoUrl}
            mode={attendance.cameraMode}
            address={attendance.previewEvidence.location.address}
            accuracy={attendance.previewEvidence.location.accuracyMeters}
            onRetake={attendance.retakeSelfiePhoto}
            onConfirmUse={() => attendance.confirmSelfiePhoto(buildParams())}
            isSubmitting={attendance.isSubmitting}
          />
        ) : (
          <>
            <ShiftCard
              shiftName={CURRENT_EMPLOYEE.shift}
              shiftHours={CURRENT_EMPLOYEE.shiftHours}
              workplace={CURRENT_EMPLOYEE.workplace}
              workplaceAddress={CURRENT_EMPLOYEE.workplaceAddress}
            />
            <TodayStatusCard
              status={todayRecord.status}
              checkInTime={todayRecord.checkIn?.time}
              checkOutTime={todayRecord.checkOut?.time}
              totalHoursFormatted={
                todayRecord.totalWorkingMinutes
                  ? `${Math.floor(todayRecord.totalWorkingMinutes / 60)} giờ ${todayRecord.totalWorkingMinutes % 60} phút`
                  : undefined
              }
            />

            {showExceptionSuggestion && (
              <ExceptionSuggestionCard
                onAcceptOfficeMethod={() => {
                  sim.setWorkMode('IN_OFFICE');
                  sim.setShowExceptionSuggestion(false);
                }}
                onContinueSelfie={() => sim.setShowExceptionSuggestion(false)}
                onWhyProposal={onOpenPolicy}
              />
            )}

            {/* Signal status card (what BE will use) */}
            <SignalCard sim={sim} resolvedMethod={resolvedMethod} />

            <AttendanceTimeline checkIn={todayRecord.checkIn} checkOut={todayRecord.checkOut} />

            {/* Server-side rejection (BE error.code) */}
            {attendance.lastError && (
              <div className="p-3 rounded-lg bg-error-container/25 border border-error-container text-on-error-container text-xs space-y-1">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Backend từ chối thao tác</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed">{attendance.lastError.message}</p>
                    <code className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-error-container text-on-error-container">{attendance.lastError.code}</code>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={attendance.clearError}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-container-lowest text-primary hover:bg-surface-container-low font-semibold text-[11px] border border-outline-variant"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

            {!isCompleted ? (
              <ActionButton
                actionType={isCheckInAction ? 'CHECK_IN' : 'CHECK_OUT'}
                workMode={sim.workMode}
                isEnabled={isButtonEnabled}
                disabledReason={getDisabledReason(sim)}
                isLoading={attendance.isSubmitting}
                loadingText={
                  needsCamera
                    ? 'Đang tải ảnh & ghi nhận...'
                    : isCheckInAction
                    ? 'Đang ghi nhận VÀO CA...'
                    : 'Đang ghi nhận RA CA...'
                }
                methodBadge={methodLabel(resolvedMethod, sim.gpsDistance, matchedNetwork?.ssid ?? matchedNetwork?.name)}
                onClick={handlePrimaryAction}
              />
            ) : (
              <div className="p-3.5 rounded-xl bg-secondary-container border border-secondary text-on-secondary-container text-xs text-center space-y-1">
                <p className="font-bold">Đã hoàn thành ngày công hôm nay</p>
                <p className="text-[11px]">
                  Tổng thời gian làm việc:{' '}
                  {todayRecord.totalWorkingMinutes
                    ? `${Math.floor(todayRecord.totalWorkingMinutes / 60)} giờ ${todayRecord.totalWorkingMinutes % 60} phút`
                    : '—'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNavigation
        activeTab={employeeTab}
        onTabChange={onTabChange}
        pendingCount={todayRecord.overallApprovalStatus === 'PENDING' ? 1 : 0}
      />

      {attendance.isCameraOpen && (
        <CameraCapture
          mode={attendance.cameraMode}
          mockLocation={{
            ...MOCK_SELFIE_EVIDENCE[attendance.cameraMode].location,
            capturedAtClient: new Date().toISOString(),
          }}
          onClose={attendance.closeCamera}
          onCapture={attendance.captureSelfie}
        />
      )}
    </div>
  );
};

/* ---- signal status card ---- */

function SignalCard({ sim, resolvedMethod }: { sim: UseSimulation; resolvedMethod: string }) {
  const { workMode, inCondition, gpsDistance, gpsAccuracy, outCondition } = sim;

  if (workMode === 'OUT_OFFICE') {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant">
            <Camera className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-on-surface">Đi thị trường (OUT)</h4>
            <p className="text-[10px] text-on-surface-variant">Bắt buộc bằng chứng ảnh Selfie</p>
          </div>
        </div>
        <div className="text-[11px] text-on-surface-variant bg-surface-container-low rounded-lg p-2 border border-outline-variant">
          {outCondition === 'HAS_PHOTO' ? '📸 Đã có ảnh sẵn → gửi ngay' : '📸 Cần chụp ảnh selfie để xác minh'}
        </div>
      </div>
    );
  }

  // IN_OFFICE
  const status =
    inCondition === 'NONE'
      ? { icon: <AlertTriangle className="w-4 h-4 text-error" />, tone: 'bg-error-container/25 border-error-container text-on-error-container', text: 'Mạng & GPS đều lỗi → tự chuyển sang Selfie (bằng chứng ảnh)' }
      : resolvedMethod === 'NETWORK'
      ? { icon: <Wifi className="w-4 h-4 text-secondary" />, tone: 'bg-secondary-container/25 border-secondary text-on-surface', text: 'Đã kết nối mạng công ty → dùng NETWORK' }
      : { icon: <Radar className="w-4 h-4 text-secondary" />, tone: 'bg-secondary-container/25 border-secondary text-on-surface', text: `Trong vùng GPS (cách ${gpsDistance}m, ±${gpsAccuracy}m) → dùng GPS` };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-3 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-2">
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-primary-container text-on-primary-container">
          <Building2 className="w-4 h-4" />
        </span>
        <div>
          <h4 className="text-xs font-bold text-on-surface">Tại văn phòng (IN)</h4>
          <p className="text-[10px] text-on-surface-variant">BE tự chọn NETWORK hoặc GPS</p>
        </div>
      </div>
      <div className={`text-[11px] rounded-lg p-2 border ${status.tone} flex items-start gap-1.5`}>
        <span className="shrink-0 mt-0.5">{status.icon}</span>
        <span>{status.text}</span>
      </div>
    </div>
  );
}

/* ---- helpers ---- */

function getDisabledReason(sim: UseSimulation): string | undefined {
  if (sim.simulatedSystemState === 'SSO_EXPIRED') return 'Phiên SSO hết hạn.';
  if (sim.simulatedSystemState === 'LOCKED') return 'Bảng công đã bị khóa.';
  if (sim.simulatedSystemState === 'OFFLINE') return 'Không có kết nối Internet.';
  return undefined;
}