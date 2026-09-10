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
        : tab === 'HISTORY' ? <><div className="flex items-center justify-between"><h2 className="font-black">Lịch sử chấm công</h2><span className="rounded-lg border bg-white px-3 py-1 text-xs font-bold">08/2026</span></div><HistorySummary records={MOCK_HISTORY_RECORDS}/><div className="space-y-2">{MOCK_HISTORY_RECORDS.map(r=><HistoryListItem key={r.id} record={r} onSelect={setDetail}/>)}</div></>
        : tab === 'PROFILE' ? <Profile scenario={scenario}/>
        : attendance.previewPhotoUrl ? <SelfiePreview photoUrl={attendance.previewPhotoUrl} mode={attendance.cameraMode} onRetake={attendance.retakeSelfiePhoto} onConfirmUse={()=>attendance.confirmSelfiePhoto(params())} isSubmitting={attendance.isSubmitting}/>
        : <><div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900"><strong>Kịch bản tài khoản:</strong> {scenario.label}</div><ShiftCard shiftName={CURRENT_EMPLOYEE.shift} shiftHours={CURRENT_EMPLOYEE.shiftHours} workplace={CURRENT_EMPLOYEE.workplace} workplaceAddress={CURRENT_EMPLOYEE.workplaceAddress}/><TodayStatusCard status={attendance.todayRecord.status} checkInTime={attendance.todayRecord.checkIn?.time} checkOutTime={attendance.todayRecord.checkOut?.time} totalHoursFormatted={attendance.todayRecord.totalWorkingMinutes ? `${Math.floor(attendance.todayRecord.totalWorkingMinutes/60)} giờ ${attendance.todayRecord.totalWorkingMinutes%60} phút` : undefined}/><MethodCard scenario={scenario}/><AttendanceTimeline checkIn={attendance.todayRecord.checkIn} checkOut={attendance.todayRecord.checkOut}/>{attendance.lastError&&<div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 shrink-0"/><span><strong>{attendance.lastError.code}</strong><br/>{attendance.lastError.message}</span></div>}{!completed?<ActionButton actionType={isCheckIn?'CHECK_IN':'CHECK_OUT'} workMode={scenario.workMode} isEnabled isLoading={attendance.isSubmitting} methodBadge={methodLabel(scenario.method,24,matchedNetwork?.ssid ?? matchedNetwork?.name)} onClick={act}/>:<div className="rounded-xl bg-emerald-100 p-4 text-center text-sm font-bold text-emerald-900">Đã hoàn thành ngày công hôm nay</div>}</>}
      </div>
      <BottomNavigation activeTab={tab} onTabChange={(next)=>{setTab(next);setDetail(null)}} pendingCount={attendance.todayRecord.overallApprovalStatus==='PENDING'?1:0}/>
      {attendance.isCameraOpen&&<CameraCapture mode={attendance.cameraMode} onClose={attendance.closeCamera} onPhotoCaptured={attendance.onPhotoCaptured}/>} 
    </div>
  </main>;
};

const MethodCard=({scenario}:{scenario:EmployeeScenario})=>{const Icon=scenario.method==='GPS'?Radar:scenario.method==='NETWORK'?Wifi:Camera;return <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-100 p-2 text-blue-800"><Icon className="h-5 w-5"/></span><div><h3 className="text-sm font-black">{scenario.workMode==='IN_OFFICE'?'Tại văn phòng':'Làm ngoài văn phòng'}</h3><p className="text-xs text-slate-500">Phương thức mock cố định: {scenario.method}</p></div></div>{scenario.method==='GPS'&&<p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">GPS hợp lệ · Cách workplace 24m · Độ chính xác ±16m</p>}</div>};
const Profile=({scenario}:{scenario:EmployeeScenario})=><div className="space-y-4"><h2 className="text-xl font-black">Hồ sơ nhân viên</h2><div className="rounded-2xl border bg-white p-5 text-sm shadow-sm"><Building2 className="mb-4 h-6 w-6 text-blue-700"/><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Họ tên</dt><dd className="font-bold">{CURRENT_EMPLOYEE.name}</dd></div><div><dt className="text-xs text-slate-500">Mã nhân viên</dt><dd className="font-mono font-bold">{CURRENT_EMPLOYEE.code}</dd></div><div><dt className="text-xs text-slate-500">Phòng ban</dt><dd>{CURRENT_EMPLOYEE.department}</dd></div><div><dt className="text-xs text-slate-500">Kịch bản mặc định</dt><dd className="font-bold">{scenario.method}</dd></div></dl></div></div>;
