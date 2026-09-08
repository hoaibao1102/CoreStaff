import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Wifi,
  MapPin,
  Camera,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { AttendanceStatus, ApprovalStatus, MethodType } from '../../types';

interface AttendanceBadgeProps {
  status: AttendanceStatus;
  size?: 'sm' | 'md';
}

export const AttendanceStatusBadge: React.FC<AttendanceBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'NOT_CHECKED_IN':
      return (
        <span
          id="badge-attendance-not-checked"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-surface-variant text-on-surface-variant ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5" />
          Chưa Check-in
        </span>
      );
    case 'CHECKED_IN':
      return (
        <span
          id="badge-attendance-checked-in"
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-primary-container text-on-primary-container ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container animate-pulse" />
          Đang trong ca
        </span>
      );
    case 'COMPLETED':
      return (
        <span
          id="badge-attendance-completed"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-secondary-container text-on-secondary-container ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Hoàn thành
        </span>
      );
    case 'LATE':
      return (
        <span
          id="badge-attendance-late"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant ${sizeClasses}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Đi trễ
        </span>
      );
    case 'EARLY_LEAVE':
      return (
        <span
          id="badge-attendance-early-leave"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant ${sizeClasses}`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Về sớm
        </span>
      );
    case 'HOLIDAY':
      return (
        <span
          id="badge-attendance-holiday"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-surface-variant text-on-surface-variant ${sizeClasses}`}
        >
          Nghỉ tuần / Lễ
        </span>
      );
    case 'LOCKED':
      return (
        <span
          id="badge-attendance-locked"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-surface-container text-on-surface ${sizeClasses}`}
        >
          Bảng công đã khóa
        </span>
      );
    default:
      return null;
  }
};

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'md';
}

export const ApprovalStatusBadge: React.FC<ApprovalBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'NOT_REQUIRED':
      return (
        <span
          id="badge-approval-none"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-surface-variant text-on-surface-variant ${sizeClasses}`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Tự động ghi nhận
        </span>
      );
    case 'PENDING':
      return (
        <span
          id="badge-approval-pending"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5" />
          Chờ duyệt
        </span>
      );
    case 'APPROVED':
      return (
        <span
          id="badge-approval-approved"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-secondary-container text-on-secondary-container ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Đã duyệt
        </span>
      );
    case 'REJECTED':
      return (
        <span
          id="badge-approval-rejected"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-error-container text-on-error-container ${sizeClasses}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Bị từ chối
        </span>
      );
    case 'CLARIFICATION_REQUESTED':
      return (
        <span
          id="badge-approval-clarification"
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant ${sizeClasses}`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Chờ giải trình
        </span>
      );
    default:
      return null;
  }
};

interface MethodBadgeProps {
  method: MethodType;
  showIcon?: boolean;
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({
  method,
  showIcon = true,
}) => {
  switch (method) {
    case 'NETWORK':
      return (
        <span
          id="badge-method-network"
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-container text-on-primary-container"
        >
          {showIcon && <Wifi className="w-3 h-3" />}
          Mạng công ty (Wi-Fi/LAN)
        </span>
      );
    case 'GPS':
      return (
        <span
          id="badge-method-gps"
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-surface-variant text-on-surface-variant"
        >
          {showIcon && <MapPin className="w-3 h-3" />}
          Vị trí GPS Geofence
        </span>
      );
    case 'SELFIE':
      return (
        <span
          id="badge-method-selfie"
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant"
        >
          {showIcon && <Camera className="w-3 h-3" />}
          Selfie & Vị trí (Thị trường)
        </span>
      );
    default:
      return null;
  }
};