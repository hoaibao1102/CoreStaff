import { apiUrl } from '../config/api';

export interface TodayAttendanceData {
  workDate: string;
  serverTime: string;
  attendanceStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'COMPLETED' | 'DAY_OFF' | 'LOCKED';
  availableAction: 'CHECK_IN' | 'CHECK_OUT' | 'NONE';
  workMode: 'IN_OFFICE' | 'OUT_OFFICE' | null;
  checkIn: {
    eventId: string;
    eventType: 'CHECK_IN';
    method: 'NETWORK' | 'GPS' | 'SELFIE';
    recordedAt: string;
    address?: string;
    distanceMeters?: number;
    approvalStatus: string;
    evidenceUrl?: string | null;
  } | null;
  checkOut: {
    eventId: string;
    eventType: 'CHECK_OUT';
    method: 'NETWORK' | 'GPS' | 'SELFIE';
    recordedAt: string;
    address?: string;
    distanceMeters?: number;
    approvalStatus: string;
    evidenceUrl?: string | null;
  } | null;
  workingMinutes: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  overallApprovalStatus: string;
  approvalComment?: string | null;
  approvalReviewedAt?: string | null;
  assignment: {
    shiftName: string;
    shiftHours: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    gracePeriodMinutes: number;
    workplaceId: string | null;
    workplaceName: string;
    workplaceType: 'IN_OFFICE' | 'OUT_OFFICE';
    address: string;
    latitude: number;
    longitude: number;
    allowedRadiusMeters: number;
    maximumAccuracyMeters: number;
    allowNetworkAttendance: boolean;
    allowGpsAttendance: boolean;
    allowSelfieFallback: boolean;
  };
}

export interface CheckInPayload {
  workMode: 'IN_OFFICE' | 'OUT_OFFICE';
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    capturedAtClient?: string;
    address?: string;
  };
  note?: string;
  address?: string;
}

export interface CheckOutPayload {
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    capturedAtClient?: string;
    address?: string;
  };
  note?: string;
  address?: string;
}

async function request<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const url = apiUrl(base, path);
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errorObj = body?.error || body;
    const code = errorObj?.code || errorObj?.message || 'UNKNOWN_ERROR';
    const error = new Error(mapAttendanceError(code));
    (error as any).code = code;
    (error as any).status = res.status;
    throw error;
  }

  return body.data as T;
}

export function getTodayAttendance(base: string): Promise<TodayAttendanceData> {
  return request<TodayAttendanceData>(base, '/api/attendance/today', { method: 'GET' });
}

export function checkIn(base: string, payload: CheckInPayload | FormData): Promise<any> {
  const isFormData = payload instanceof FormData;
  return request<any>(base, '/api/attendance/check-in', {
    method: 'POST',
    body: isFormData ? payload : JSON.stringify(payload),
  });
}

export function checkOut(base: string, payload: CheckOutPayload | FormData): Promise<any> {
  const isFormData = payload instanceof FormData;
  return request<any>(base, '/api/attendance/check-out', {
    method: 'POST',
    body: isFormData ? payload : JSON.stringify(payload),
  });
}

export function getAttendanceHistory(base: string, month?: string): Promise<any> {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return request<any>(base, `/api/attendance/history${query}`, { method: 'GET' });
}

export function mapAttendanceError(code?: string): string {
  if (!code) return 'Có lỗi xảy ra khi chấm công. Vui lòng thử lại.';

  const messages: Record<string, string> = {
    ASSIGNMENT_NOT_CONFIGURED: 'Bạn chưa được phân công ca làm việc hoặc nơi làm việc. Vui lòng liên hệ bộ phận HR.',
    ALREADY_CHECKED_IN: 'Bạn đã thực hiện check-in vào ca hôm nay rồi.',
    ALREADY_CHECKED_OUT: 'Bạn đã hoàn thành check-out ra ca hôm nay rồi.',
    INVALID_ATTENDANCE_ACTION: 'Thao tác không hợp lệ với trạng thái công hiện tại.',
    NETWORK_NOT_ALLOWED: 'Mạng Wi-Fi hiện tại không thuộc danh sách mạng cho phép của công ty.',
    OUTSIDE_ALLOWED_AREA: 'Vị trí của bạn đang ở ngoài bán kính cho phép của nơi làm việc.',
    LOW_LOCATION_ACCURACY: 'Độ chính xác GPS quá thấp hoặc không ổn định. Vui lòng di chuyển ra nơi thoáng đãng và thử lại.',
    LOCATION_PERMISSION_REQUIRED: 'Trình duyệt chưa được cấp quyền vị trí. Vui lòng bật GPS trên trình duyệt.',
    CAMERA_PERMISSION_REQUIRED: 'Trình duyệt chưa được cấp quyền Camera. Hãy cho phép sử dụng Camera để chụp ảnh.',
    SELFIE_REQUIRED: 'Không nhận diện được Wi-Fi hoặc vị trí công ty. Vui lòng chấm công bằng Selfie để Quản lý duyệt.',
    SELFIE_IMAGE_INVALID: 'Ảnh chụp selfie không hợp lệ. Vui lòng chụp lại.',
    FILE_TOO_LARGE: 'Dung lượng ảnh quá lớn (vượt quá 5MB). Vui lòng thử lại.',
    UNSUPPORTED_FILE_TYPE: 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận JPEG, PNG, WebP.',
    ATTENDANCE_LOCKED: 'Kỳ công tháng này đã được HR chốt và khóa. Không thể thực hiện chấm công.',
    DUPLICATE_REQUEST: 'Thao tác đang được xử lý. Vui lòng không bấm nút nhiều lần.',
    RESOURCE_NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
    AUTH_SESSION_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  };

  return messages[code] || `Lỗi: ${code}`;
}
