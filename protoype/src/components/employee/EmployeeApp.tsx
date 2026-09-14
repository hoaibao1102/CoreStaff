import React, { useState } from 'react';
import { AlertTriangle, Building2, Camera, Radar, Wifi } from 'lucide-react';
import { AttendanceTimeline } from './AttendanceTimeline';
import { ActionButton, BottomNavigation } from './ActionAndNav';
import { CameraCapture, SelfiePreview } from './CameraComponents';
import { EmployeeHeader, ShiftCard, TodayStatusCard } from './EmployeeHeader';
import { DayDetailView, HistoryListItem, HistorySummary } from './HistoryAndDetail';
import { CURRENT_EMPLOYEE, MOCK_HISTORY_RECORDS } from '../../data/mockData';
import { useAttendance } from '../../hooks/useAttendance';
import { methodLabel } from '../../hooks/useAttendance';
import { bssidForSource } from '../../harness/useSimulation';
import { loadActiveWorkplace } from '../../services/adminService';
import { MOCK_SELFIE_EVIDENCE } from '../../services/evidenceService';
import { WorkMode, EmployeeTab, DayAttendance } from '../../types';

export interface EmployeeScenario { workMode: WorkMode; method: 'GPS' | 'NETWORK' | 'SELFIE'; label: string; }
interface Props { scenario: EmployeeScenario; onOpenPolicy: () => void; onOpenAdjustment: () => void; onOpenClarification: () => void; }

export const EmployeeApp: React.FC<Props> = ({ scenario, onOpenPolicy, onOpenAdjustment, onOpenClarification }) => {
  const attendance = useAttendance();
  const [tab, setTab] = useState<EmployeeTab>('TODAY');
  const [detail, setDetail] = useState<DayAttendance | null>(null);
  const isCheckIn = attendance.todayRecord.status === 'NOT_CHECKED_IN';
  const completed = attendance.todayRecord.status === 'COMPLETED';
  // Scenario → raw signals. NETWORK reports the tenant's registered router (same
  // resolution the sandbox uses), GPS/SELFIE report no BSSID so the backend can't
  // pick NETWORK for them.
  const workplace = loadActiveWorkplace();
  const matchedNetwork = workplace?.networks.find((n) => n.active);
  const params = (photoUrl?: string) => ({
    workMode: scenario.workMode,
    observedBssid: scenario.method === 'NETWORK' ? bssidForSource('OFFICE_ROUTER') : undefined,
    gpsDistance: scenario.method === 'GPS' ? 24 : undefined,
    gpsAccuracy: scenario.method === 'GPS' ? 16 : undefined,
    photoUrl,
  });
  const act = () => {
    const mode = isCheckIn ? 'CHECK_IN' : 'CHECK_OUT';
    if (scenario.method === 'SELFIE') attendance.openCamera(mode);
    else if (isCheckIn) attendance.checkIn(params()); else attendance.checkOut(params());
  };

  return <main className="mx-auto min-h-[calc(100dvh-49px)] w-full max-w-6xl bg-surface sm:px-5 sm:py-6">
    <div className="mx-auto flex min-h-[calc(100dvh-49px)] w-full max-w-3xl flex-col overflow-hidden bg-surface-bright sm:min-h-0 sm:rounded-3xl sm:border sm:border-outline-variant sm:shadow-xl">
      <EmployeeHeader employee={CURRENT_EMPLOYEE} onOpenPolicy={onOpenPolicy}/>
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {detail ? <DayDetailView record={detail} onBack={()=>setDetail(null)} onOpenAdjustment={onOpenAdjustment} onOpenClarification={onOpenClarification}/>
        : tab === 'HISTORY' ? <><div className="flex items-center justify-between pb-2"><h2 className="text-lg font-bold tracking-tight text-on-surface">Lịch sử chấm công</h2><span className="rounded-lg border bg-surface-container-low px-3 py-1 text-xs font-semibold">{MOCK_HISTORY_RECORDS[0]?.formattedDate?.replace(/,\s*.*$/, '') ?? '08/2026'}</span></div><HistorySummary records={MOCK_HISTORY_RECORDS}/><div className="space-y-2">{MOCK_HISTORY_RECORDS.map(r=><HistoryListItem key={r.id} record={r} onSelect={setDetail}/>)}</div></>
        : tab === 'PROFILE' ? <Profile scenario={scenario}/>
        : attendance.previewEvidence ? <SelfiePreview photoUrl={attendance.previewEvidence.photoUrl} mode={attendance.cameraMode} address={attendance.previewEvidence.location.address} accuracy={attendance.previewEvidence.location.accuracyMeters} onRetake={attendance.retakeSelfiePhoto} onConfirmUse={()=>attendance.confirmSelfiePhoto(params())} isSubmitting={attendance.isSubmitting}/>
        : <><div className="rounded-lg border border-primary/20 bg-primary-fixed px-3 py-2 text-xs text-on-primary-fixed"><strong>Kịch bản:</strong> {scenario.label}</div><ShiftCard shiftName={CURRENT_EMPLOYEE.shift} shiftHours={CURRENT_EMPLOYEE.shiftHours} workplace={CURRENT_EMPLOYEE.workplace} workplaceAddress={CURRENT_EMPLOYEE.workplaceAddress}/><TodayStatusCard status={attendance.todayRecord.status} checkInTime={attendance.todayRecord.checkIn?.time} checkOutTime={attendance.todayRecord.checkOut?.time} totalHoursFormatted={attendance.todayRecord.totalWorkingMinutes ? `${Math.floor(attendance.todayRecord.totalWorkingMinutes/60)} giờ ${attendance.todayRecord.totalWorkingMinutes%60} phút` : undefined}/><MethodCard scenario={scenario}/><AttendanceTimeline checkIn={attendance.todayRecord.checkIn} checkOut={attendance.todayRecord.checkOut}/>{attendance.lastError&&<div className="flex gap-2 rounded-lg border border-error/20 bg-error-container p-3 text-xs text-on-error-container"><AlertTriangle className="h-4 w-4 shrink-0"/><span><strong>{attendance.lastError.code}</strong><br/>{attendance.lastError.message}</span></div>}{!completed?<ActionButton actionType={isCheckIn?'CHECK_IN':'CHECK_OUT'} workMode={scenario.workMode} isEnabled isLoading={attendance.isSubmitting} methodBadge={methodLabel(scenario.method,24,matchedNetwork?.ssid ?? matchedNetwork?.name)} onClick={act}/>:<div className="rounded-lg bg-success-container p-4 text-center text-sm font-semibold text-on-success-container">Đã hoàn thành ngày công hôm nay</div>}</>}
      </div>
      <BottomNavigation activeTab={tab} onTabChange={(next)=>{setTab(next);setDetail(null)}} pendingCount={attendance.todayRecord.overallApprovalStatus==='PENDING'?1:0}/>
      {attendance.isCameraOpen&&<CameraCapture mode={attendance.cameraMode} mockLocation={{ ...MOCK_SELFIE_EVIDENCE[attendance.cameraMode].location, capturedAtClient: new Date().toISOString() }} onClose={attendance.closeCamera} onCapture={attendance.captureSelfie}/>} 
    </div>
  </main>;
};

const MethodCard = ({ scenario }: { scenario: EmployeeScenario }) => {
  const Icon = scenario.method === 'GPS' ? Radar : scenario.method === 'NETWORK' ? Wifi : Camera;
  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-primary-fixed-dim p-2 text-on-primary-fixed"><Icon className="h-5 w-5" /></span>
        <div><h3 className="text-sm font-bold text-on-surface">{scenario.workMode === 'IN_OFFICE' ? 'Tại văn phòng' : 'Làm ngoài văn phòng'}</h3><p className="text-xs text-on-surface-foreground">Phương thức mock cố định: {scenario.method}</p></div>
      </div>
      {scenario.method === 'GPS' && <p className="mt-3 rounded-md bg-success-container px-2 py-1.5 text-xs text-on-success-container">GPS hợp lệ · Cách workplace 24m · Độ chính xác ±16m</p>}
    </div>
  );
};
const Profile = ({ scenario }: { scenario: EmployeeScenario }) => (
  <div className="space-y-4">
    <h2 className="text-lg font-bold tracking-tight text-on-surface">Hồ sơ nhân viên</h2>
    <div className="rounded-xl border border-outline-variant bg-surface p-4 shadow-card-sm">
      <Building2 className="mb-4 h-6 w-6 text-primary" />
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-on-surface-foreground">Họ tên</dt><dd className="font-bold text-on-surface">{CURRENT_EMPLOYEE.name}</dd></div>
        <div><dt className="text-xs text-on-surface-foreground">Mã nhân viên</dt><dd className="font-mono font-bold text-on-surface">{CURRENT_EMPLOYEE.code}</dd></div>
        <div><dt className="text-xs text-on-surface-foreground">Phòng ban</dt><dd className="text-on-surface">{CURRENT_EMPLOYEE.department}</dd></div>
        <div><dt className="text-xs text-on-surface-foreground">Kịch bản mặc định</dt><dd className="font-bold text-on-surface">{scenario.method}</dd></div>
      </dl>
    </div>
  </div>
);
