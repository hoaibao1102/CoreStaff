import React, { useState } from 'react';
import { AlertTriangle, Building2, Camera, MapPin, Radar, Wifi } from 'lucide-react';
import { AttendanceTimeline } from './AttendanceTimeline';
import { ActionButton, BottomNavigation } from './ActionAndNav';
import { CameraCapture, SelfiePreview } from './CameraComponents';
import { EmployeeHeader, ShiftCard, TodayStatusCard } from './EmployeeHeader';
import { DayDetailView, HistoryCalendarView, HistorySummary } from './HistoryAndDetail';
import { CURRENT_EMPLOYEE, MOCK_HISTORY_RECORDS } from '../../data/mockData';
import { useAttendance } from '../../hooks/useAttendance';
import { methodLabel } from '../../hooks/useAttendance';
import { bssidForSource } from '../../harness/useSimulation';
import { loadActiveWorkplace } from '../../services/adminService';
import { WorkMode, EmployeeTab, DayAttendance, EmployeeProfile } from '../../types';

export interface EmployeeScenario { workMode: WorkMode; method: 'GPS' | 'NETWORK' | 'SELFIE'; label: string; }
interface Props { scenario: EmployeeScenario; profile?: EmployeeProfile; onOpenPolicy: () => void; onOpenAdjustment: () => void; onOpenClarification: () => void; }

/** IN_OFFICE keeps the scenario's own method (NETWORK/GPS); OUT_OFFICE always forces SELFIE (SRS: field work needs photo evidence). */
function resolveMethod(workMode: WorkMode, scenario: EmployeeScenario): 'GPS' | 'NETWORK' | 'SELFIE' {
  if (workMode === 'OUT_OFFICE') return 'SELFIE';
  return scenario.method === 'SELFIE' ? 'NETWORK' : scenario.method;
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const EmployeeApp: React.FC<Props> = ({ scenario, profile = CURRENT_EMPLOYEE, onOpenPolicy, onOpenAdjustment, onOpenClarification }) => {
  const attendance = useAttendance();
  const [tab, setTab] = useState<EmployeeTab>('TODAY');
  const [detail, setDetail] = useState<DayAttendance | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>(scenario.workMode);
  const isCheckIn = attendance.todayRecord.status === 'NOT_CHECKED_IN';
  const completed = attendance.todayRecord.status === 'COMPLETED';
  // Work mode is picked once per day at check-in time; locking it afterwards
  // keeps check-in/check-out on the same verification method for the day.
  const workModeLocked = !isCheckIn;
  const method = resolveMethod(workMode, scenario);
  // Simulated device GPS reading for this session — generated once instead of a
  // fixed constant so the numbers on screen don't look copy-pasted every run.
  const [gpsReading] = useState(() => ({ distance: randomInt(8, 60), accuracy: randomInt(6, 22) }));

  const workplace = loadActiveWorkplace();
  const matchedNetwork = workplace?.networks.find((n) => n.active);
  const params = (photoUrl?: string) => ({
    workMode,
    observedBssid: method === 'NETWORK' ? bssidForSource('OFFICE_ROUTER') : undefined,
    gpsDistance: method === 'GPS' ? gpsReading.distance : undefined,
    gpsAccuracy: method === 'GPS' ? gpsReading.accuracy : undefined,
    photoUrl,
  });
  const act = () => {
    const mode = isCheckIn ? 'CHECK_IN' : 'CHECK_OUT';
    if (method === 'SELFIE') attendance.openCamera(mode);
    else if (isCheckIn) attendance.checkIn(params()); else attendance.checkOut(params());
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <EmployeeHeader employee={profile} onOpenPolicy={onOpenPolicy} />
        <div className="space-y-4 pb-24">
          {detail ? (
            <DayDetailView record={detail} onBack={() => setDetail(null)} onOpenAdjustment={onOpenAdjustment} onOpenClarification={onOpenClarification} />
          ) : tab === 'HISTORY' ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-700">Lịch sử chấm công</h2>
                <span className="rounded-lg border border-slate-100 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm">08/2026</span>
              </div>
              <HistorySummary records={MOCK_HISTORY_RECORDS} />
              <HistoryCalendarView records={MOCK_HISTORY_RECORDS} onSelect={setDetail} />
            </>
          ) : tab === 'PROFILE' ? (
            <Profile profile={profile} method={method} />
          ) : attendance.previewPhotoUrl ? (
            <SelfiePreview photoUrl={attendance.previewPhotoUrl} mode={attendance.cameraMode} onRetake={attendance.retakeSelfiePhoto} onConfirmUse={() => attendance.confirmSelfiePhoto(params())} isSubmitting={attendance.isSubmitting} />
          ) : (
            <>
              <WorkModeCard workMode={workMode} onChange={setWorkMode} locked={workModeLocked} />
              <MethodCard method={method} gpsReading={gpsReading} />
              <ShiftCard shiftName={profile.shift} shiftHours={profile.shiftHours} workplace={profile.workplace} workplaceAddress={profile.workplaceAddress} />
              <TodayStatusCard
                status={attendance.todayRecord.status}
                checkInTime={attendance.todayRecord.checkIn?.time}
                checkOutTime={attendance.todayRecord.checkOut?.time}
                totalHoursFormatted={attendance.todayRecord.totalWorkingMinutes ? `${Math.floor(attendance.todayRecord.totalWorkingMinutes / 60)} giờ ${attendance.todayRecord.totalWorkingMinutes % 60} phút` : undefined}
              />
              <AttendanceTimeline checkIn={attendance.todayRecord.checkIn} checkOut={attendance.todayRecord.checkOut} />
              {attendance.lastError && (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span><strong>{attendance.lastError.code}</strong><br />{attendance.lastError.message}</span>
                </div>
              )}
              {!completed ? (
                <ActionButton
                  actionType={isCheckIn ? 'CHECK_IN' : 'CHECK_OUT'}
                  workMode={workMode}
                  isEnabled
                  isLoading={attendance.isSubmitting}
                  methodBadge={methodLabel(method, 24, matchedNetwork?.ssid ?? matchedNetwork?.name)}
                  onClick={act}
                />
              ) : (
                <div className="rounded-xl bg-emerald-100 p-4 text-center text-sm font-bold text-emerald-900">Đã hoàn thành ngày công hôm nay</div>
              )}
            </>
          )}
        </div>
        <BottomNavigation activeTab={tab} onTabChange={(next) => { setTab(next); setDetail(null); }} pendingCount={attendance.todayRecord.overallApprovalStatus === 'PENDING' ? 1 : 0} />
        {attendance.isCameraOpen && <CameraCapture mode={attendance.cameraMode} onClose={attendance.closeCamera} onPhotoCaptured={attendance.onPhotoCaptured} />}
      </div>
    </main>
  );
};

const WORK_MODE_OPTIONS: { value: WorkMode; label: string; hint: string; icon: typeof Building2 }[] = [
  { value: 'IN_OFFICE', label: 'Tại văn phòng', hint: 'Tự nhận diện Wifi/GPS', icon: Building2 },
  { value: 'OUT_OFFICE', label: 'Ngoài văn phòng', hint: 'Bắt buộc chụp Selfie', icon: MapPin },
];

/** The one decision an employee makes today: where they're working — everything else (method, camera) follows from it. */
const WorkModeCard = ({ workMode, onChange, locked }: { workMode: WorkMode; onChange: (m: WorkMode) => void; locked: boolean }) => (
  <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-black text-on-surface">Hôm nay bạn làm việc ở đâu?</h3>
      {locked && <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">Đã chọn cho hôm nay</span>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {WORK_MODE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = workMode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={locked}
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
              active ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
            } ${locked && !active ? 'opacity-40' : ''} ${locked ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-bold">{opt.label}</span>
            <span className="text-[10px]">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const METHOD_COPY: Record<'GPS' | 'NETWORK' | 'SELFIE', { title: string; detail: string }> = {
  NETWORK: { title: 'Xác thực bằng Wifi văn phòng', detail: 'Hệ thống tự nhận diện bạn đang kết nối mạng nội bộ công ty.' },
  GPS: { title: 'Xác thực bằng định vị GPS', detail: 'Hệ thống kiểm tra khoảng cách từ vị trí của bạn tới văn phòng.' },
  SELFIE: { title: 'Xác thực bằng Selfie + vị trí', detail: 'Bạn cần chụp ảnh selfie kèm vị trí để xác minh vì đang làm ngoài văn phòng.' },
};

const MethodCard = ({ method, gpsReading }: { method: 'GPS' | 'NETWORK' | 'SELFIE'; gpsReading: { distance: number; accuracy: number } }) => {
  const Icon = method === 'GPS' ? Radar : method === 'NETWORK' ? Wifi : Camera;
  const copy = METHOD_COPY[method];
  return (
    <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-100 p-2 text-blue-800"><Icon className="h-5 w-5" /></span>
        <div>
          <h3 className="text-sm font-black">{copy.title}</h3>
          <p className="text-xs text-slate-500">{copy.detail}</p>
        </div>
      </div>
      {method === 'GPS' && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">GPS hợp lệ · Cách văn phòng {gpsReading.distance}m · Độ chính xác ±{gpsReading.accuracy}m</p>}
    </div>
  );
};

const Profile = ({ profile, method }: { profile: EmployeeProfile; method: 'GPS' | 'NETWORK' | 'SELFIE' }) => (
  <div className="space-y-4">
    <h2 className="text-xl font-black">Hồ sơ nhân viên</h2>
    <div className="rounded-2xl border bg-white p-5 text-sm shadow-sm">
      <Building2 className="mb-4 h-6 w-6 text-blue-700" />
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Họ tên</dt><dd className="font-bold">{profile.name}</dd></div>
        <div><dt className="text-xs text-slate-500">Mã nhân viên</dt><dd className="font-mono font-bold">{profile.code}</dd></div>
        <div><dt className="text-xs text-slate-500">Phòng ban</dt><dd>{profile.department}</dd></div>
        <div><dt className="text-xs text-slate-500">Phương thức hôm nay</dt><dd className="font-bold">{METHOD_COPY[method].title}</dd></div>
      </dl>
    </div>
  </div>
);
