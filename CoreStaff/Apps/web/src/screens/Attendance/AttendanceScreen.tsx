import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wifi,
  MapPin,
  Camera,
  Clock,
  Building2,
  Compass,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Avatar, AvatarFallback } from '../../components/avatar';
import { getMyEmployeeProfile } from '../../services/hrService';
import { getWorkplaceById, type Workplace } from '../../services/workplace.service';
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

export function AttendanceScreen({ user, apiBase }: { user: AuthUser; apiBase?: string | null }) {
  const [userWorkplace, setUserWorkplace] = useState<Workplace | null>(null);
  const [isLoadingWorkplace, setIsLoadingWorkplace] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<AttendanceMethod>('NETWORK');
  const [attendanceRecord, setAttendanceRecord] = useState<DayAttendance>({
    id: 'att-today',
    workDate: new Date().toISOString().split('T')[0],
    shiftName: 'Ca Hành Chính',
    shiftHours: '08:00 – 17:30',
    workplace: 'Đang tải nơi làm việc...',
    workplaceAddress: 'Đang kiểm tra dữ liệu vị trí...',
    status: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    attendanceMethod: 'NETWORK',
    verificationContext: {
      method: 'NETWORK',
      status: 'CONNECTED_TO_ALLOWED_NETWORK',
      canAttend: true,
      networkId: 'net-office-1',
      networkName: 'CoreStaff-Office-5G',
      workplaceId: 'wp-default',
      workplaceName: 'Đang tải nơi làm việc...',
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

  // Fetch employee's assigned workplace & Auto-route method
  useEffect(() => {
    if (!apiBase) return;
    let active = true;
    setIsLoadingWorkplace(true);

    getMyEmployeeProfile(apiBase)
      .then(async (profile) => {
        if (!active) return;
        if (profile.workplaceId) {
          try {
            const wp = await getWorkplaceById(apiBase, profile.workplaceId);
            if (active && wp) {
              setUserWorkplace(wp);
              const isOutOffice = wp.type === 'OUT_OFFICE';

              if (isOutOffice) {
                // OUT_OFFICE: Tự động chuyển hướng sang chế độ SELFIE
                setSelectedMethod('SELFIE');
                setAttendanceRecord((prev) => ({
                  ...prev,
                  workplace: wp.name,
                  workplaceAddress: wp.address || 'Hiện trường / Lưu động',
                  attendanceMethod: 'SELFIE',
                  verificationContext: {
                    method: 'SELFIE',
                    canAttend: true,
                    workplaceId: wp._id,
                    workplaceName: wp.name,
                  },
                }));
              } else {
                // IN_OFFICE: Mặc định mạng nội bộ hoặc GPS
                setSelectedMethod('NETWORK');
                setAttendanceRecord((prev) => ({
                  ...prev,
                  workplace: wp.name,
                  workplaceAddress: wp.address || 'Văn phòng làm việc',
                  attendanceMethod: 'NETWORK',
                  verificationContext: {
                    method: 'NETWORK',
                    status: 'CONNECTED_TO_ALLOWED_NETWORK',
                    canAttend: true,
                    networkId: 'net-office-1',
                    networkName: 'CoreStaff-Office-5G',
                    workplaceId: wp._id,
                    workplaceName: wp.name,
                  },
                }));
              }
              return;
            }
          } catch {
            // Fallback to default
          }
        }

        // Nếu nhân viên chưa có workplaceId cụ thể
        if (active) {
          setAttendanceRecord((prev) => ({
            ...prev,
            workplace: profile.workplaceName || 'Văn phòng CoreStaff',
            workplaceAddress: 'Trụ sở chính',
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingWorkplace(false);
      });

    return () => {
      active = false;
    };
  }, [apiBase]);

  // GPS verification config based on employee's actual workplace
  const location = useLocation();
  const workplaceGps = useMemo(() => {
    if (userWorkplace && userWorkplace.type !== 'OUT_OFFICE' && userWorkplace.latitude && userWorkplace.longitude) {
      return {
        id: userWorkplace._id,
        name: userWorkplace.name,
        address: userWorkplace.address,
        latitude: userWorkplace.latitude,
        longitude: userWorkplace.longitude,
        allowedRadiusMeters: userWorkplace.allowedRadiusMeters || 250,
        maximumAccuracyMeters: userWorkplace.maximumAccuracyMeters || 50,
      };
    }
    return {
      id: userWorkplace?._id || 'wp-default',
      name: userWorkplace?.name || 'Văn phòng làm việc',
      address: userWorkplace?.address || 'Chưa thiết lập địa chỉ',
      latitude: userWorkplace?.latitude || 10.762622,
      longitude: userWorkplace?.longitude || 106.660247,
      allowedRadiusMeters: userWorkplace?.allowedRadiusMeters || 200,
      maximumAccuracyMeters: userWorkplace?.maximumAccuracyMeters || 80,
    };
  }, [userWorkplace]);

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
              workplaceId: userWorkplace?._id || 'wp-default',
              workplaceName: userWorkplace?.name || 'Văn phòng CoreStaff',
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
                latitude: location.coords?.latitude ?? (workplaceGps.latitude || 10.762622),
                longitude: location.coords?.longitude ?? (workplaceGps.longitude || 106.660247),
                accuracyMeters: location.coords?.accuracyMeters ?? 15,
                address: selfieAddress || currentAddress || attendanceRecord.workplaceAddress || 'Vị trí thực địa',
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
                distanceMeters: gpsVerification.distanceMeters ?? 0,
                address: attendanceRecord.workplaceAddress,
              }
            : {
                eventId: `evt-${Date.now()}`,
                recordedAt: nowIso,
                method: 'NETWORK',
                workplaceName: attendanceRecord.workplace,
                status: 'AUTO_APPROVED',
                networkName: 'Mạng văn phòng',
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
              workplaceName: attendanceRecord.workplace || 'Ca Hiện Trường / Khách Hàng',
              status: 'PENDING_APPROVAL',
              approvalStatus: 'PENDING_APPROVAL',
              evidence: photoUrl ? { previewUrl: photoUrl } : undefined,
              location: {
                latitude: location.coords?.latitude ?? (workplaceGps.latitude || 10.762622),
                longitude: location.coords?.longitude ?? (workplaceGps.longitude || 106.660247),
                accuracyMeters: location.coords?.accuracyMeters ?? 15,
                address: selfieAddress || currentAddress || attendanceRecord.workplaceAddress || 'Vị trí thực địa',
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

      {/* Subheader: Phương thức chấm công */}
      <div className="border-b border-border bg-card/60 px-4 py-2 sm:px-6">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Phương thức chấm công:</span>
          </div>

          {/* 3 Check-in Method Switcher */}
          <div className="inline-flex rounded-xl bg-muted p-1 gap-1 text-xs font-semibold">
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
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 px-4 py-4 sm:px-6 max-w-7xl mx-auto w-full space-y-4 pb-24 md:pb-8">
            {/* Workplace Info & Mode Card */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    userWorkplace?.type === 'OUT_OFFICE'
                      ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  }`}>
                    {userWorkplace?.type === 'OUT_OFFICE' ? (
                      <Compass className="size-5" />
                    ) : (
                      <Building2 className="size-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-foreground">
                        {attendanceRecord.workplace}
                      </h2>
                      {userWorkplace?.type === 'OUT_OFFICE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 text-xs font-semibold">
                          <Compass className="size-3" />
                          Lưu động / Ngoại văn phòng (OUT_OFFICE)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                          <Building2 className="size-3" />
                          Tại văn phòng (IN_OFFICE)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {attendanceRecord.workplaceAddress}
                    </p>
                  </div>
                </div>

                {userWorkplace?.type === 'OUT_OFFICE' ? (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1.5 text-xs font-medium self-start sm:self-center border border-purple-500/20">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span>Tự động định tuyến sang Selfie</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground self-start sm:self-center">
                    <span>Phương thức ưu tiên: Wi-Fi / GPS</span>
                  </div>
                )}
              </div>

              {/* Informational Callout / Fallback Alert */}
              {userWorkplace?.type === 'OUT_OFFICE' ? (
                <div className="mt-3.5 flex items-start gap-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 p-3 text-xs text-purple-800 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/40">
                  <Compass className="size-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                  <p>
                    Bạn được phân công nơi làm việc lưu động. Vui lòng bấm vào <strong>Chụp ảnh chấm công</strong> bên dưới, ảnh chụp cùng tọa độ thực địa sẽ được ghi nhận trực tiếp.
                  </p>
                </div>
              ) : selectedMethod !== 'SELFIE' ? (
                <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/30">
                  <div className="flex items-start sm:items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      Gặp sự cố không kết nối được Wi-Fi văn phòng hoặc GPS ngoài phạm vi?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectMethod('SELFIE')}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline hover:text-primary/90 transition-colors whitespace-nowrap self-end sm:self-auto"
                  >
                    <Camera className="size-3.5" />
                    Chấm công dự phòng bằng Selfie (Fallback) &rarr;
                  </button>
                </div>
              ) : (
                <div className="mt-3.5 flex items-center justify-between gap-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-800 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800/30">
                  <div className="flex items-center gap-2">
                    <Camera className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>
                      Đang ở chế độ chấm công dự phòng bằng Selfie (Fallback).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectMethod('NETWORK')}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline transition-colors whitespace-nowrap"
                  >
                    Quay lại Wi-Fi &rarr;
                  </button>
                </div>
              )}
            </div>

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
                workplaceGps={workplaceGps}
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
