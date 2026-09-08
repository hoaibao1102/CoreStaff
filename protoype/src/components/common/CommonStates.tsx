import React from 'react';
import {
  AlertCircle,
  WifiOff,
  ServerCrash,
  Lock,
  CalendarX2,
  RefreshCw,
  CheckCircle2,
  Inbox,
} from 'lucide-react';
import { AuditLog } from '../../types';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div id="loading-skeleton" className="space-y-4 animate-pulse p-4">
      <div className="h-6 bg-surface-variant rounded-md w-1/3"></div>
      <div className="h-28 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
        <div className="h-4 bg-surface-variant rounded-sm w-3/4"></div>
        <div className="h-3 bg-surface-variant rounded-sm w-1/2"></div>
        <div className="h-8 bg-surface-variant rounded-lg w-full"></div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-container-low rounded-lg border border-outline-variant"></div>
        ))}
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}> = ({
  title = 'Không có dữ liệu',
  description = 'Chưa có bản ghi chấm công nào phù hợp với bộ lọc hiện tại.',
  icon,
  actionText,
  onAction,
}) => {
  return (
    <div
      id="empty-state"
      className="flex flex-col items-center justify-center p-8 text-center bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant"
    >
      <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant mb-3">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h4 className="text-sm font-semibold text-on-surface mb-1">{title}</h4>
      <p className="text-xs text-on-surface-variant max-w-sm mb-4">{description}</p>
      {actionText && onAction && (
        <button
          id="btn-empty-state-action"
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface bg-surface-container-lowest border border-outline-variant rounded-md hover:bg-surface-container-low shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {actionText}
        </button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  type?: 'OFFLINE' | 'API_ERROR' | 'SSO_EXPIRED' | 'LOCKED' | 'HOLIDAY' | 'DUPLICATE' | 'GENERIC';
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'GENERIC',
  message,
  onRetry,
}) => {
  const getDetails = () => {
    switch (type) {
      case 'OFFLINE':
        return {
          icon: <WifiOff className="w-8 h-8 text-error" />,
          title: 'Mất kết nối Internet',
          desc: 'Không thể kết nối đến máy chủ ERP. Vui lòng kiểm tra lại kết nối Wi-Fi hoặc 4G trên điện thoại.',
          actionText: 'Thử kết nối lại',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      case 'API_ERROR':
        return {
          icon: <ServerCrash className="w-8 h-8 text-error" />,
          title: 'Hệ thống ERP tạm thời gián đoạn (API Error)',
          desc: 'Máy chủ chấm công đang nâng cấp hoặc quá tải. Vui lòng thử lại sau vài giây hoặc liên hệ IT Support.',
          actionText: 'Tải lại trang',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      case 'SSO_EXPIRED':
        return {
          icon: <Lock className="w-8 h-8 text-tertiary-container" />,
          title: 'Phiên đăng nhập SSO đã hết hạn',
          desc: 'Phiên làm việc trên cổng ERP tập trung đã hết thời gian hiệu lực bảo mật. Vui lòng đăng nhập lại qua tài khoản công ty.',
          actionText: 'Đăng nhập lại qua ERP',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      case 'LOCKED':
        return {
          icon: <Lock className="w-8 h-8 text-on-surface-variant" />,
          title: 'Bảng công tháng đã khóa',
          desc: 'Kỳ chấm công của tháng này đã được Phòng Nhân sự khóa sổ để chốt bảng lương. Mọi điều chỉnh cần gửi yêu cầu đến HR.',
          actionText: 'Xem bảng công',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      case 'HOLIDAY':
        return {
          icon: <CalendarX2 className="w-8 h-8 text-primary" />,
          title: 'Hôm nay là ngày nghỉ / Lễ',
          desc: 'Theo lịch phân ca của Phòng Kinh doanh, hôm nay bạn không có ca làm việc chính thức.',
          actionText: 'Xem lịch tuần',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      case 'DUPLICATE':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-secondary" />,
          title: 'Yêu cầu trùng lặp – Đã ghi nhận thành công',
          desc: 'Hệ thống đã nhận được bản ghi Check-in trước đó của bạn. Không cần thực hiện lại để tránh sai lệch dữ liệu.',
          actionText: 'Xem trạng thái hôm nay',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
      default:
        return {
          icon: <AlertCircle className="w-8 h-8 text-error" />,
          title: 'Có lỗi phát sinh',
          desc: message || 'Đã xảy ra lỗi không xác định. Vui lòng kiểm tra lại thao tác.',
          actionText: 'Thử lại',
          bg: 'bg-surface-container-lowest border-outline-variant',
        };
    }
  };

  const config = getDetails();

  return (
    <div
      id={`error-state-${type.toLowerCase()}`}
      className={`p-6 rounded-xl border ${config.bg} text-center flex flex-col items-center justify-center my-4 shadow-sm`}
    >
      <div className="mb-3">{config.icon}</div>
      <h4 className="text-base font-semibold text-on-surface mb-1">{config.title}</h4>
      <p className="text-xs text-on-surface-variant max-w-sm mb-4 leading-relaxed">{config.desc}</p>
      {onRetry && (
        <button
          id={`btn-error-retry-${type.toLowerCase()}`}
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-on-primary bg-primary border border-primary rounded-lg hover:bg-primary-container shadow-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {config.actionText}
        </button>
      )}
    </div>
  );
};

export const AuditTimeline: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return <p className="text-xs text-outline italic">Chưa có lịch sử thao tác.</p>;
  }

  return (
    <div id="audit-timeline-container" className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant">
      {logs.map((log) => (
        <div key={log.id} className="relative group">
          <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-surface-container-lowest bg-outline-variant group-hover:bg-primary transition-colors shadow-sm"></div>
          <div className="text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">{log.actor}</span>
              <span className="text-[11px] text-outline">{log.timestamp}</span>
            </div>
            <p className="text-on-surface-variant mt-0.5">{log.action}</p>
            {log.details && (
              <p className="text-[11px] text-on-surface-variant bg-surface-container-low p-1.5 rounded mt-1 border border-outline-variant">
                {log.details}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};