import { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  MapPin,
  Camera,
  ChevronLeft,
  CalendarDays,
  Clock,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { AppLink } from '../../components/AppLink';
import { Avatar, AvatarFallback } from '../../components/avatar';
import type {
  AttendanceMethod,
  AttendanceStatus,
  DayAttendance,
  AttendanceEvent,
} from './types';
import { useLocation, fetchAddressFromCoords, formatCoords } from './verification/useLocation';
import { useGpsVerification } from './verification/useGpsVerification';
import { CameraCapture, SelfiePreview } from './components/CameraComponents';
import { NetworkAttendanceFlow } from './components/NetworkAttendanceFlow';
import { GpsAttendanceFlow } from './components/GpsAttendanceFlow';
import { SelfieAttendanceFlow } from './components/SelfieAttendanceFlow';
import { PolicyModal } from './components/PolicyModal';
import { CheckInSuccessModal } from './components/CheckInSuccessModal';
import { ResultBanner, type ResultBannerProps } from './components/ResultBanner';
import { AttendanceHistoryView } from './components/AttendanceHistoryView';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(-2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');
}

function ServerClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

interface EmployeeAppBarProps {
  userName: string;
  employeeCode: string;
  department: string;
}

function EmployeeAppBar({ userName, employeeCode, department }: EmployeeAppBarProps) {
  return (
    <header className="border-b bg-card">
      <div className="px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">Chấm công nhân viên</h1>
              <p className="text-xs text-muted-foreground">CoreStaff • Attendance Suite v2.0</p>
            </div>
          </div>
          <ServerClock />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Xin chào, <strong className="text-foreground">{userName}</strong></span>
          <span>•</span>
          <span>{employeeCode}</span>
          <span>•</span>
          <span>{department}</span>
        </div>
      </div>
    </header>
  );
}

export function AttendanceScreen({ user }: { user: AuthUser }) {
  const [mainTab, setMainTab] = useState<'TODAY' | 'HISTORY'>('TODAY');
  const [selectedMethod, setSelectedMethod] = useState<AttendanceMethod>('NETWORK');
  const [attendanceRecord, setAttendanceRecord] = useState<DayAttendance>({
    id: 'att-today',
    workDate: new Date().toISOString().split('T')[0],
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Văn phòng CoreStaff Quận 8',
    workplaceAddress: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    status: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    attendanceMethod: 'NETWORK',
    verificationContext: {
      method: 'NETWORK',
      status: 'CONNECTED_TO_ALLOWED_NETWORK',
      canAttend: true,
      networkId: 'net-office-1',
      networkName: 'CoreStaff-Office-5G',
      workplaceId: 'wp-q8',
      workplaceName: 'Văn phòng CoreStaff Quận 8',
    },
    checkIn: null,
    checkOut: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultBannerProps | null>(null);

  // Modals & Camera
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [selfieAddress, setSelfieAddress] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');

  // GPS verification
  const location = useLocation();
  const workplaceGps = {
    id: 'wp-q8',
    name: 'Văn phòng CoreStaff Quận 8',
    address: '123 Đường mẫu, Phường 4, Quận 8, TP.HCM',
    latitude: 10.7431,
    longitude: 106.6782,
    allowedRadiusMeters: 250,
    maximumAccuracyMeters: 50,
  };

  const gpsVerification = useGpsVerification(workplaceGps, location.coords);

  // Address lookup when GPS coords update
  useEffect(() => {
    if (location.coords) {
      let active = true;
      fetchAddressFromCoords(location.coords.latitude, location.coords.longitude).then((addr) => {
        if (active) {
          setCurrentAddress(addr);
          setSelfieAddress(addr);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [location.coords?.latitude, location.coords?.longitude]);

  // Auto-dismiss result banner
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setResult(null), 5000);
    return () => window.clearTimeout(timer);
  }, [result]);

  // Update verification context when switching methods
  const handleSelectMethod = (m: AttendanceMethod) => {
    setSelectedMethod(m);
    setAttendanceRecord((prev) => ({
      ...prev,
      attendanceMethod: m,
      verificationContext:
        m === 'NETWORK'
          ? {
              method: 'NETWORK',
              status: 'CONNECTED_TO_ALLOWED_NETWORK',
              canAttend: true,
              networkId: 'net-office-1',
              networkName: 'CoreStaff-Office-5G',
              workplaceId: 'wp-q8',
              workplaceName: 'Văn phòng CoreStaff Quận 8',
            }
          : m === 'GPS'
            ? {
                method: 'GPS',
                workplace: workplaceGps,
              }
            : {
                method: 'SELFIE',
              },
    }));
  };

  // Check-in / Check-out dispatch
  const handleAction = async () => {
    if (attendanceRecord.availableAction === 'NONE' || isSubmitting) return;

    const action = attendanceRecord.availableAction;
    const mode: 'CHECK_IN' | 'CHECK_OUT' = action === 'CHECK_IN' ? 'CHECK_IN' : 'CHECK_OUT';

    // SELFIE: Open camera first
    if (selectedMethod === 'SELFIE') {
      setCameraMode(mode);
      setIsCameraOpen(true);
      return;
    }

    // NETWORK or GPS: Execute action directly
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    executeAttendanceSubmission(mode);
  };

  const executeAttendanceSubmission = (mode: 'CHECK_IN' | 'CHECK_OUT', photoUrl?: string) => {
    const nowIso = new Date().toISOString();
    const eventTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (mode === 'CHECK_IN') {
      const newCheckIn: AttendanceEvent =
        selectedMethod === 'SELFIE'
          ? {
              eventId: `evt-${Date.now()}`,
              recordedAt: nowIso,
              method: 'SELFIE',
              workplaceName: 'Ca Hiện Trường / Khách Hàng',
              status: 'PENDING_APPROVAL',
              approvalStatus: 'PENDING_APPROVAL',
              evidence: photoUrl ? { previewUrl: photoUrl } : undefined,
              location: {
                latitude: location.coords?.latitude ?? 10.7431,
                longitude: location.coords?.longitude ?? 106.6782,
                accuracyMeters: location.coords?.accuracyMeters ?? 15,
                address: selfieAddress || currentAddress || '123 Đường mẫu, Quận 8, TP.HCM',
              },
            }
          : selectedMethod === 'GPS'
            ? {
                eventId: `evt-${Date.now()}`,
                recordedAt: nowIso,
                method: 'GPS',
                workplaceName: attendanceRecord.workplace,
                status: 'AUTO_APPROVED',
                accuracyMeters: Math.round(location.coords?.accuracyMeters ?? 18),
                distanceMeters: gpsVerification.distanceMeters ?? 25,
                address: attendanceRecord.workplaceAddress,
              }
            : {
                eventId: `evt-${Date.now()}`,
                recordedAt: nowIso,
                method: 'NETWORK',
                workplaceName: attendanceRecord.workplace,
                status: 'AUTO_APPROVED',
                networkName: 'CoreStaff-Office-5G',
                address: attendanceRecord.workplaceAddress,
              };

      setAttendanceRecord((prev) => ({
        ...prev,
        status: 'CHECKED_IN',
        availableAction: 'CHECK_OUT',
        checkIn: newCheckIn,
      }));

      setIsSubmitting(false);
      setResult({
        status: 'success',
        message: `Vào ca thành công lúc ${eventTime}. Chúc bạn một ngày làm việc hiệu quả!`,
      });
      setIsSuccessModalOpen(true);
    } else {
      const newCheckOut: AttendanceEvent =
        selectedMethod === 'SELFIE'
          ? {
              eventId: `evt-${Date.now()}`,
              recordedAt: nowIso,
              method: 'SELFIE',
              workplaceName: 'Ca Hiện Trường / Khách Hàng',
              status: 'PENDING_APPROVAL',
              approvalStatus: 'PENDING_APPROVAL',
              evidence: photoUrl ? { previewUrl: photoUrl } : undefined,
              location: {
                latitude: location.coords?.latitude ?? 10.7431,
                longitude: location.coords?.longitude ?? 106.6782,
                accuracyMeters: location.coords?.accuracyMeters ?? 15,
                address: selfieAddress || currentAddress || '123 Đường mẫu, Quận 8, TP.HCM',
              },
            }
          : selectedMethod === 'GPS'
            ? {
                eventId: `evt-${Date.now()}`,
                recordedAt: nowIso,
                method: 'GPS',
                workplaceName: attendanceRecord.workplace,
                status: 'AUTO_APPROVED',
                accuracyMeters: Math.round(location.coords?.accuracyMeters ?? 16),
                distanceMeters: gpsVerification.distanceMeters ?? 20,
                address: attendanceRecord.workplaceAddress,
              }
            : {
                eventId: `evt-${Date.now()}`,
                recordedAt: nowIso,
                method: 'NETWORK',
                workplaceName: attendanceRecord.workplace,
                status: 'AUTO_APPROVED',
                networkName: 'CoreStaff-Office-5G',
                address: attendanceRecord.workplaceAddress,
              };

      setAttendanceRecord((prev) => ({
        ...prev,
        status: 'COMPLETED',
        availableAction: 'NONE',
        checkOut: newCheckOut,
        totalWorkingMinutes: 480,
      }));

      setIsSubmitting(false);
      setResult({
        status: 'success',
        message: `Tan ca thành công lúc ${eventTime}. Đã hoàn thành ngày công!`,
        workingMinutes: 480,
      });
      setIsSuccessModalOpen(true);
    }
  };

  const handlePhotoCaptured = async (photoUrl?: string) => {
    setIsCameraOpen(false);
    if (photoUrl) {
      setPreviewPhotoUrl(photoUrl);
      if (location.coords) {
        const addr = await fetchAddressFromCoords(location.coords.latitude, location.coords.longitude);
        setSelfieAddress(addr);
      }
    }
  };

  const handleRetakePhoto = () => {
    setPreviewPhotoUrl(null);
    setIsCameraOpen(true);
  };

  const handleConfirmSelfie = async () => {
    if (!previewPhotoUrl) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    executeAttendanceSubmission(cameraMode, previewPhotoUrl);
    setPreviewPhotoUrl(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* App Bar */}
      <EmployeeAppBar
        userName={user.fullName}
        employeeCode={user.employeeCode || 'CS-0248'}
        department={user.role === 'HR' ? 'Nhân sự' : user.role === 'DEPARTMENT_MANAGER' ? 'Quản lý' : 'Nhân viên'}
      />

      {/* Navigation breadcrumb & Main View Switcher (Hôm nay / Lịch sử) */}
      <div className="border-b border-border bg-card/60 px-4 py-2.5 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <AppLink href="/overview" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              Tổng quan
            </AppLink>

            {/* Primary Main Tab Switcher */}
            <div className="inline-flex rounded-xl bg-muted p-1 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMainTab('TODAY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  mainTab === 'TODAY'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="size-3.5" />
                <span>Chấm công hôm nay</span>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('HISTORY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  mainTab === 'HISTORY'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="size-3.5" />
                <span>Lịch sử công</span>
              </button>
            </div>
          </div>

          {/* 3 Check-in Method Switcher (only visible in TODAY tab) */}
          {mainTab === 'TODAY' && (
            <div className="inline-flex rounded-xl bg-muted p-1 gap-1 text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSelectMethod('NETWORK')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  selectedMethod === 'NETWORK'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wifi className="size-3.5" />
                <span>Wi-Fi</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('GPS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  selectedMethod === 'GPS'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MapPin className="size-3.5" />
                <span>GPS</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('SELFIE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  selectedMethod === 'SELFIE'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Camera className="size-3.5" />
                <span>Selfie</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 px-4 py-4 sm:px-6 max-w-7xl mx-auto w-full space-y-4 pb-24 md:pb-8">
        {mainTab === 'HISTORY' ? (
          <AttendanceHistoryView />
        ) : (
          <>
            {/* Result banner message */}
            {result && (
              <ResultBanner
                status={result.status}
                message={result.message}
                workingMinutes={result.workingMinutes}
              />
            )}

            {/* Selected Method Flow */}
            {selectedMethod === 'NETWORK' && (
              <NetworkAttendanceFlow
                today={attendanceRecord}
                employeeName={user.fullName}
                employeeCode={user.employeeCode || 'CS-0248'}
                department={user.role === 'HR' ? 'Phòng Nhân sự' : 'Phòng Kinh doanh'}
                submitting={isSubmitting}
                onSubmit={handleAction}
                onOpenPolicy={() => setIsPolicyOpen(true)}
                onOpenSuccessModal={() => setIsSuccessModalOpen(true)}
              />
            )}

            {selectedMethod === 'GPS' && (
              <GpsAttendanceFlow
                today={attendanceRecord}
                coords={location.coords}
                gpsVerification={gpsVerification}
                submitting={isSubmitting}
                onSubmit={handleAction}
                onOpenSuccessModal={() => setIsSuccessModalOpen(true)}
              />
            )}

            {selectedMethod === 'SELFIE' && (
              <SelfieAttendanceFlow
                today={attendanceRecord}
                submitting={isSubmitting}
                onStartCapture={handleAction}
                previewPhotoUrl={previewPhotoUrl}
                onOpenSuccessModal={() => setIsSuccessModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Selfie Preview Screen (shown after capturing photo) */}
      {previewPhotoUrl && selectedMethod === 'SELFIE' && (
        <SelfiePreview
          mode={cameraMode}
          photoUrl={previewPhotoUrl}
          employeeCode={user.employeeCode || 'CS-0248'}
          employeeName={user.fullName}
          address={selfieAddress ?? undefined}
          accuracy={location.coords?.accuracyMeters}
          isSubmitting={isSubmitting}
          onRetake={handleRetakePhoto}
          onConfirmUse={handleConfirmSelfie}
        />
      )}

      {/* Fullscreen Camera Overlay */}
      {isCameraOpen && (
        <CameraCapture
          mode={cameraMode}
          mockLocation={{
            address: currentAddress || formatCoords(location.coords),
            accuracyMeters: Math.round(location.coords?.accuracyMeters ?? 0),
            latitude: location.coords?.latitude,
            longitude: location.coords?.longitude,
          }}
          onClose={() => setIsCameraOpen(false)}
          onCapture={handlePhotoCaptured}
        />
      )}

      {/* Policy Modal */}
      <PolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />

      {/* Success Modal / Bottom Sheet */}
      <CheckInSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        checkInEvent={attendanceRecord.checkIn}
        checkOutEvent={attendanceRecord.checkOut}
        mode={attendanceRecord.status === 'COMPLETED' ? 'CHECK_OUT' : 'CHECK_IN'}
        method={attendanceRecord.attendanceMethod}
        accuracyMeters={Math.round(location.coords?.accuracyMeters ?? (attendanceRecord.attendanceMethod === 'GPS' ? 18 : 5))}
        workplaceName={
          attendanceRecord.attendanceMethod === 'SELFIE'
            ? 'Ca Hiện Trường / Khách Hàng'
            : attendanceRecord.workplace
        }
        workplaceAddress={selfieAddress || currentAddress || attendanceRecord.workplaceAddress}
        photoUrl={
          (attendanceRecord.checkOut && 'evidence' in attendanceRecord.checkOut && attendanceRecord.checkOut.evidence?.previewUrl) ||
          (attendanceRecord.checkIn && 'evidence' in attendanceRecord.checkIn && attendanceRecord.checkIn.evidence?.previewUrl) ||
          previewPhotoUrl
        }
      />
    </div>
  );
}
