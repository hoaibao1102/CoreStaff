import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bell,
  Info,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { EmployeeProfile, AttendanceStatus } from '../../types';
import { AttendanceStatusBadge } from '../common/Badges';

interface EmployeeHeaderProps {
  employee: EmployeeProfile;
  onOpenPolicy: () => void;
}

export const EmployeeHeader: React.FC<EmployeeHeaderProps> = ({
  employee,
  onOpenPolicy,
}) => {
  const [serverTime, setServerTime] = useState<string>('08:00:00');

  useEffect(() => {
    // Simulated server synchronized clock
    const interval = setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setServerTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      id="employee-app-bar"
      className="bg-surface border-b border-outline-variant"
    >
      {/* Top bar with module title & avatar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface font-semibold text-xs shadow-xs">
            AN
          </div>
          <div>
            <h1 className="text-sm font-bold text-on-surface tracking-tight flex items-center gap-1.5">
              Chấm công
            </h1>
            <p className="text-[11px] text-on-surface-variant">
              TimeLock • Attendance v1.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-open-policy-header"
            onClick={onOpenPolicy}
            title="Xem chính sách chấm công"
            className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Greeting + Server clock */}
      <div className="px-4 pb-3 pt-1 border-t border-outline-variant/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-on-surface-variant font-medium">Chào buổi sáng,</p>
            <h2 className="text-base font-bold text-on-surface">{employee.name}</h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant">
              <span className="font-mono font-medium text-primary bg-surface-container px-1.5 py-0.2 rounded text-[11px]">
                {employee.code}
              </span>
              <span>•</span>
              <span>{employee.department}</span>
            </div>
          </div>

          {/* Synchronized Server Clock Widget */}
          <div
            id="server-clock-widget"
            className="text-right bg-surface-container-lowest p-2 rounded-lg border border-outline-variant shadow-card-sm min-w-[96px]"
          >
            <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
              <RefreshCw className="w-3 h-3 text-secondary" />
              <span>Giờ Server</span>
            </div>
            <div className="font-mono text-lg font-bold text-on-surface leading-tight">
              {serverTime}
            </div>
            <div className="text-[10px] text-on-surface-variant">GMT+7 (Chính thức)</div>
          </div>
        </div>
      </div>
    </header>
  );
};

interface ShiftCardProps {
  shiftName: string;
  shiftHours: string;
  workplace: string;
  workplaceAddress: string;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shiftName,
  shiftHours,
  workplace,
  workplaceAddress,
}) => {
  return (
    <div
      id="card-shift-info"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-card-sm relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-surface-tint"></div>
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-surface-tint" />
          <span className="text-xs font-semibold text-on-surface">
            {shiftName}: {shiftHours}
          </span>
        </div>
        <span className="text-[11px] font-medium text-on-surface bg-surface-container-high px-2 py-0.5 rounded-md">
          Hôm nay
        </span>
      </div>

      <div className="flex items-start gap-2 pt-3 pl-1 border-t border-surface-variant text-xs text-on-surface-variant">
        <Building2 className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-on-surface">{workplace}</p>
          <p className="text-[11px] line-clamp-1">{workplaceAddress}</p>
        </div>
      </div>
    </div>
  );
};

interface TodayStatusCardProps {
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  totalHoursFormatted?: string;
}

export const TodayStatusCard: React.FC<TodayStatusCardProps> = ({
  status,
  checkInTime,
  checkOutTime,
  totalHoursFormatted,
}) => {
  return (
    <div
      id="card-today-status"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-card-sm relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
      <div className="flex items-center justify-between mb-3 pl-1">
        <span className="text-xs text-on-surface-variant font-medium">Trạng thái hôm nay</span>
        <AttendanceStatusBadge status={status} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 pl-1">
        <div>
          <span className="text-[11px] text-on-surface-variant block">Giờ vào</span>
          <span className="font-mono text-sm font-semibold text-on-surface">
            {checkInTime || '--:--'}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-on-surface-variant block">Giờ ra</span>
          <span className="font-mono text-sm font-semibold text-on-surface">
            {checkOutTime || '--:--'}
          </span>
        </div>
      </div>

      {totalHoursFormatted && (
        <div className="flex items-start gap-2 pt-3 pl-1 border-t border-surface-variant text-xs text-on-surface-variant">
          <span className="text-on-surface-variant">Tổng thời gian làm việc:</span>
          <span className="font-semibold text-secondary">{totalHoursFormatted}</span>
        </div>
      )}
    </div>
  );
};