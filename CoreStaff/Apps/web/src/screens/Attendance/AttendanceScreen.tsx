import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wifi,
  MapPin,
  Camera,
  Clock,
  Clock3,
  Building2,
  Compass,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  MessageSquareText,
  XCircle,
} from 'lucide-react';
import type { AuthUser } from '../../services/auth';
import { Avatar, AvatarFallback } from '../../components/avatar';
import { toast } from '../../components/toast';
import { getMyEmployeeProfile } from '../../services/hrService';
import { getWorkplaceById, type Workplace } from '../../services/workplace.service';
import { apiUrl } from '../../config/api';
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
import {
  getTodayAttendance,
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
} from '../../services/attendance.service';
import { getSocket } from '../../services/socket';

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

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

function ApprovalStatusNotification({
  status,
  comment,
  reviewedAt,
}: {
  status?: string;
  comment?: string | null;
  reviewedAt?: string | null;
}) {
  if (!status || status === 'NOT_REQUIRED') return null;

  if (status === 'APPROVED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950 shadow-xs dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in duration-200">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
        <div className="flex-1 text-xs sm:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-900 dark:text-emerald-100">
              Chấm công đã được Quản lý phê duyệt
            </span>
            {reviewedAt && (
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                (Duyệt lúc {new Date(reviewedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
          <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
            Lượt chấm công ngày hôm nay của bạn đã được Quản lý xác nhận hợp lệ.
          </p>
          {comment && (
            <p className="mt-1.5 text-xs italic text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500 pl-2">
              Ý kiến quản lý: "{comment}"
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'CLARIFICATION_REQUESTED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 shadow-xs dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 animate-in fade-in duration-200">
        <MessageSquareText className="size-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1 text-xs sm:text-sm">
          <span className="font-bold text-amber-900 dark:text-amber-100">
            Quản lý yêu cầu bổ sung giải trình
          </span>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">
            Lượt chấm công chưa thể phê duyệt do cần làm rõ thông tin vị trí hoặc hình ảnh.
          </p>
          {comment && (
            <p className="mt-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 border-l-2 border-amber-500 pl-2">
              Nội dung yêu cầu: "{comment}"
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-rose-950 shadow-xs dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200 animate-in fade-in duration-200">
        <XCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
        <div className="flex-1 text-xs sm:text-sm">
          <span className="font-bold text-rose-900 dark:text-rose-100">
            Lượt chấm công bị từ chối
          </span>
          <p className="mt-0.5 text-rose-800 dark:text-rose-300">
            Quản lý phòng ban đã từ chối lượt chấm công này.
          </p>
          {comment && (
            <p className="mt-1.5 text-xs font-medium text-rose-900 dark:text-rose-200 border-l-2 border-rose-500 pl-2">
              Lý do từ chối: "{comment}"
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'PENDING') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-blue-950 shadow-xs dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200 animate-in fade-in duration-200">
        <Clock3 className="size-5 shrink-0 text-blue-600 mt-0.5" />
        <div className="flex-1 text-xs sm:text-sm">
          <span className="font-semibold text-blue-900 dark:text-blue-100">
            Đang chờ Quản lý phê duyệt
          </span>
          <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
            Lượt chấm công Selfie đã được ghi nhận và gửi đến Quản lý phòng ban để kiểm tra bằng chứng ảnh và tọa độ.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export function AttendanceScreen({ user, apiBase }: { user: AuthUser; apiBase?: string | null }) {
  const [userWorkplace, setUserWorkplace] = useState<Workplace | null>(null);
  const [isLoadingWorkplace, setIsLoadingWorkplace] = useState(true);
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

  const notifiedStatusRef = useRef<string | null>(null);

  // Fetch employee's today attendance state & assigned workplace
  const fetchTodayData = useCallback(async () => {
    if (!apiBase) return;
    setIsLoadingWorkplace(true);
    try {
      const todayData = await getTodayAttendance(apiBase);
      console.log('[AttendanceScreen] fetchTodayData SUCCESS:', todayData);
      const isOutOffice = todayData.assignment.workplaceType === 'OUT_OFFICE';

      // Thông báo Toast khi trạng thái phê duyệt thay đổi hoặc khi load trang
      const approvalSt = todayData.overallApprovalStatus;
      if (approvalSt && approvalSt !== 'NOT_REQUIRED' && notifiedStatusRef.current !== approvalSt) {
        notifiedStatusRef.current = approvalSt;
        if (approvalSt === 'APPROVED') {
          toast.success(
            'Chấm công đã được phê duyệt',
            todayData.approvalComment
              ? `Quản lý đã phê duyệt: "${todayData.approvalComment}"`
              : 'Quản lý phòng ban đã phê duyệt lượt chấm công hôm nay của bạn.'
          );
        } else if (approvalSt === 'CLARIFICATION_REQUESTED') {
          toast.warning(
            'Quản lý yêu cầu giải trình',
            todayData.approvalComment
              ? `Nội dung: "${todayData.approvalComment}"`
              : 'Quản lý yêu cầu bạn bổ sung giải trình về lượt chấm công này.'
          );
        } else if (approvalSt === 'REJECTED') {
          toast.error(
            'Chấm công bị từ chối',
            todayData.approvalComment
              ? `Lý do: "${todayData.approvalComment}"`
              : 'Lượt chấm công của bạn đã bị Quản lý từ chối.'
          );
        }
      }

      setUserWorkplace({
        _id: todayData.assignment.workplaceId || 'wp-default',
        code: 'WP',
        name: todayData.assignment.workplaceName,
        type: todayData.assignment.workplaceType,
        address: todayData.assignment.address,
        latitude: todayData.assignment.latitude,
        longitude: todayData.assignment.longitude,
        allowedRadiusMeters: todayData.assignment.allowedRadiusMeters,
        maximumAccuracyMeters: todayData.assignment.maximumAccuracyMeters,
        active: true,
      });

      if (isOutOffice || todayData.workMode === 'OUT_OFFICE') {
        setSelectedMethod('SELFIE');
      }

      setAttendanceRecord((prev) => ({
        ...prev,
        workDate: todayData.workDate,
        shiftName: todayData.assignment.shiftName,
        shiftHours: todayData.assignment.shiftHours,
        workplace: todayData.assignment.workplaceName,
        workplaceAddress: todayData.assignment.address || 'Văn phòng làm việc',
        status: todayData.attendanceStatus,
        availableAction: todayData.availableAction,
        attendanceMethod: isOutOffice ? 'SELFIE' : prev.attendanceMethod,
        overallApprovalStatus: todayData.overallApprovalStatus,
        approvalComment: todayData.approvalComment,
        approvalReviewedAt: todayData.approvalReviewedAt,
        checkIn: todayData.checkIn
          ? ({
              eventId: todayData.checkIn.eventId,
              recordedAt: todayData.checkIn.recordedAt,
              method: todayData.checkIn.method,
              workplaceName: todayData.assignment.workplaceName,
              status: todayData.checkIn.approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : 'AUTO_APPROVED',
              approvalStatus: todayData.checkIn.approvalStatus,
              address: todayData.checkIn.address,
              distanceMeters: todayData.checkIn.distanceMeters,
              evidence: todayData.checkIn.evidenceUrl ? { previewUrl: apiUrl(apiBase, todayData.checkIn.evidenceUrl) } : undefined,
              location: {
                latitude: todayData.assignment.latitude,
                longitude: todayData.assignment.longitude,
                accuracyMeters: 15,
                address: todayData.checkIn.address || todayData.assignment.address,
              },
            } as any)
          : null,
        checkOut: todayData.checkOut
          ? ({
              eventId: todayData.checkOut.eventId,
              recordedAt: todayData.checkOut.recordedAt,
              method: todayData.checkOut.method,
              workplaceName: todayData.assignment.workplaceName,
              status: todayData.checkOut.approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : 'AUTO_APPROVED',
              approvalStatus: todayData.checkOut.approvalStatus,
              address: todayData.checkOut.address,
              distanceMeters: todayData.checkOut.distanceMeters,
              evidence: todayData.checkOut.evidenceUrl ? { previewUrl: apiUrl(apiBase, todayData.checkOut.evidenceUrl) } : undefined,
              location: {
                latitude: todayData.assignment.latitude,
                longitude: todayData.assignment.longitude,
                accuracyMeters: 15,
                address: todayData.checkOut.address || todayData.assignment.address,
              },
            } as any)
          : null,
        totalWorkingMinutes: todayData.workingMinutes ?? undefined,
        verificationContext: isOutOffice
          ? {
              method: 'SELFIE',
            }
          : {
              method: 'NETWORK',
              status: 'CONNECTED_TO_ALLOWED_NETWORK',
              canAttend: true,
              networkId: 'net-office-1',
              networkName: 'Mạng văn phòng',
              workplaceId: todayData.assignment.workplaceId,
              workplaceName: todayData.assignment.workplaceName,
            },
      }));
    } catch (err: any) {
      console.warn('Lỗi tải trạng thái công hôm nay:', err);
    } finally {
      setIsLoadingWorkplace(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  // Lắng nghe sự kiện phê duyệt realtime từ Quản lý phòng ban
  useEffect(() => {
    if (!apiBase) return;
    const socket = getSocket(apiBase);

    const uid = user?._id || user?.id;
    const register = () => {
      if (uid) {
        socket.emit('register:user', { userId: String(uid), role: user?.role });
      }
    };

    register();
    socket.on('connect', register);

    const onDecision = (data: any) => {
      console.log('[AttendanceScreen] Real-time request:decided received:', data);
      if (data?.status) {
        notifiedStatusRef.current = data.status;
      }
      fetchTodayData();

      if (data.status === 'APPROVED') {
        toast.success(
          'Yêu cầu đã được phê duyệt',
          data.type === 'ATTENDANCE'
            ? (data.reviewComment ? `Quản lý đã phê duyệt: "${data.reviewComment}"` : 'Quản lý phòng ban đã phê duyệt yêu cầu chấm công Selfie của bạn.')
            : 'Quản lý phòng ban đã phê duyệt yêu cầu làm thêm giờ (OT) của bạn.'
        );
      } else if (data.status === 'REJECTED') {
        toast.error(
          'Yêu cầu bị từ chối',
          `Quản lý đã từ chối yêu cầu: ${data.reviewComment || 'Không đáp ứng điều kiện'}`
        );
      } else if (data.status === 'CLARIFICATION_REQUESTED') {
        toast.warning(
          'Yêu cầu cần giải trình',
          `Quản lý yêu cầu giải trình thêm: ${data.reviewComment || 'Vui lòng bổ sung minh chứng'}`
        );
      }
    };

    socket.on('request:decided', onDecision);
    return () => {
      socket.off('connect', register);
      socket.off('request:decided', onDecision);
    };
  }, [apiBase, user?.id, user?._id, user?.role, fetchTodayData]);

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
      fetchAddressFromCoords(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracyMeters
      ).then((addr) => {
        if (active) {
          setCurrentAddress(addr);
          setSelfieAddress(addr);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [location.coords?.latitude, location.coords?.longitude, location.coords?.accuracyMeters]);

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

  const executeAttendanceSubmission = async (mode: 'CHECK_IN' | 'CHECK_OUT', photoUrl?: string) => {
    if (!apiBase) return;
    setIsSubmitting(true);
    const eventTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    try {
      if (mode === 'CHECK_IN') {
        if (selectedMethod === 'SELFIE') {
          if (!photoUrl) throw new Error('Vui lòng chụp ảnh selfie trước khi gửi.');
          const formData = new FormData();
          const workMode = userWorkplace?.type === 'OUT_OFFICE' ? 'OUT_OFFICE' : 'IN_OFFICE';
          formData.append('workMode', workMode);
          formData.append('selfie', dataUrlToFile(photoUrl, 'checkin-selfie.jpg'));
          if (location.coords) {
            formData.append('latitude', String(location.coords.latitude));
            formData.append('longitude', String(location.coords.longitude));
            formData.append('accuracyMeters', String(location.coords.accuracyMeters));
          }
          if (selfieAddress || currentAddress) {
            formData.append('address', selfieAddress || currentAddress);
          }
          await apiCheckIn(apiBase, formData);
        } else if (selectedMethod === 'GPS') {
          if (!location.coords) throw new Error('Không thể lấy tọa độ GPS của thiết bị.');
          await apiCheckIn(apiBase, {
            workMode: 'IN_OFFICE',
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracyMeters: location.coords.accuracyMeters,
              address: currentAddress || attendanceRecord.workplaceAddress,
            },
          });
        } else {
          // NETWORK
          await apiCheckIn(apiBase, { workMode: 'IN_OFFICE' });
        }

        await fetchTodayData();
        setResult({
          status: 'success',
          message: `Vào ca thành công lúc ${eventTime}. Chúc bạn một ngày làm việc hiệu quả!`,
        });
        setIsSuccessModalOpen(true);
      } else {
        // CHECK_OUT
        if (selectedMethod === 'SELFIE') {
          if (!photoUrl) throw new Error('Vui lòng chụp ảnh selfie trước khi gửi.');
          const formData = new FormData();
          formData.append('selfie', dataUrlToFile(photoUrl, 'checkout-selfie.jpg'));
          if (location.coords) {
            formData.append('latitude', String(location.coords.latitude));
            formData.append('longitude', String(location.coords.longitude));
            formData.append('accuracyMeters', String(location.coords.accuracyMeters));
          }
          if (selfieAddress || currentAddress) {
            formData.append('address', selfieAddress || currentAddress);
          }
          await apiCheckOut(apiBase, formData);
        } else if (selectedMethod === 'GPS') {
          if (!location.coords) throw new Error('Không thể lấy tọa độ GPS của thiết bị.');
          await apiCheckOut(apiBase, {
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracyMeters: location.coords.accuracyMeters,
              address: currentAddress || attendanceRecord.workplaceAddress,
            },
          });
        } else {
          // NETWORK
          await apiCheckOut(apiBase, {});
        }

        await fetchTodayData();
        setResult({
          status: 'success',
          message: `Tan ca thành công lúc ${eventTime}. Đã ghi nhận ngày công!`,
        });
        setIsSuccessModalOpen(true);
      }
    } catch (err: any) {
      if (err.code === 'SELFIE_REQUIRED') {
        setSelectedMethod('SELFIE');
        setResult({
          status: 'error',
          message: 'Không nhận diện được Wi-Fi hoặc vị trí công ty. Đã chuyển sang chế độ Selfie để bạn gửi Quản lý duyệt.',
        });
      } else {
        setResult({
          status: 'error',
          message: err.message || 'Chấm công thất bại. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoCaptured = async (photoUrl?: string) => {
    setIsCameraOpen(false);
    if (photoUrl) {
      setPreviewPhotoUrl(photoUrl);
      if (location.coords) {
        if (currentAddress && !currentAddress.startsWith('📍')) {
          setSelfieAddress(currentAddress);
        }
        const addr = await fetchAddressFromCoords(
          location.coords.latitude,
          location.coords.longitude,
          location.coords.accuracyMeters
        );
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
    const photo = previewPhotoUrl;
    setPreviewPhotoUrl(null);
    await executeAttendanceSubmission(cameraMode, photo);
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
          {userWorkplace?.type === 'OUT_OFFICE' ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200 dark:border-purple-800">
              <Camera className="size-3.5" />
              <span>Phương thức: Chụp ảnh Selfie thực địa</span>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 px-4 py-4 sm:px-6 max-w-7xl mx-auto w-full space-y-4 pb-24 md:pb-8">
        {isLoadingWorkplace ? (
          <div className="flex flex-col items-center justify-center min-h-[380px] gap-3 text-muted-foreground">
            <RefreshCw className="size-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Đang tải thông tin phân công và địa điểm làm việc...</span>
          </div>
        ) : (
          <>
            {/* Banner Thông báo trạng thái Phê duyệt của Quản lý */}
            <ApprovalStatusNotification
              status={attendanceRecord.overallApprovalStatus}
              comment={attendanceRecord.approvalComment}
              reviewedAt={attendanceRecord.approvalReviewedAt}
            />

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
          address={selfieAddress || currentAddress || attendanceRecord.workplaceAddress || undefined}
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
            address: currentAddress || attendanceRecord.workplaceAddress || 'Đang xác thực vị trí...',
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
