import React from 'react';
import {
  Calendar,
  History,
  User,
  LogIn,
  LogOut,
  Camera,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { EmployeeTab, WorkMode } from '../../types';

interface ActionButtonProps {
  actionType: 'CHECK_IN' | 'CHECK_OUT';
  workMode: WorkMode;
  isEnabled: boolean;
  disabledReason?: string;
  isLoading?: boolean;
  loadingText?: string;
  /** Small badge showing which method BE used/will use. */
  methodBadge?: string;
  onClick: () => void;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  actionType,
  workMode,
  isEnabled,
  disabledReason,
  isLoading = false,
  loadingText,
  methodBadge,
  onClick,
}) => {
  const isCheckIn = actionType === 'CHECK_IN';
  const isOut = workMode === 'OUT_OFFICE';

  const getButtonText = () => {
    if (isLoading) {
      return loadingText || (isCheckIn ? 'Đang ghi nhận VÀO CA...' : 'Đang ghi nhận RA CA...');
    }
    return isCheckIn ? 'VÀO CA' : 'RA CA';
  };

  return (
    <div id="action-button-container" className="space-y-2 pt-2">
      {/* Reason why button is disabled placed directly above button */}
      {!isEnabled && disabledReason && (
        <div
          id="disabled-button-reason-banner"
          className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant text-xs shadow-sm"
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span className="text-[11px] leading-tight">
            <strong>Tạm khóa:</strong> {disabledReason}
          </span>
        </div>
      )}

      {/* Primary Action Button */}
      <button
        id={`btn-primary-${actionType.toLowerCase()}`}
        type="button"
        disabled={!isEnabled || isLoading}
        onClick={onClick}
        className={`w-full h-14 rounded-full font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 ${
          isEnabled && !isLoading
            ? 'bg-primary hover:bg-primary-container text-on-primary shadow-primary/20'
            : 'bg-surface-container-highest text-on-surface-variant/50 cursor-not-allowed border border-outline-variant/30 shadow-none'
        }`}
      >
        {isLoading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>{getButtonText()}</span>
          </>
        ) : isOut ? (
          <>
            <Camera className="w-5 h-5" />
            <span>{getButtonText()}</span>
          </>
        ) : isCheckIn ? (
          <>
            <LogIn className="w-5 h-5" />
            <span>{getButtonText()}</span>
          </>
        ) : (
          <>
            <LogOut className="w-5 h-5" />
            <span>{getButtonText()}</span>
          </>
        )}
      </button>

      {/* Method badge (BE-decided), shown small under the button */}
      {methodBadge && isEnabled && !isLoading && (
        <p className="text-[11px] text-on-surface-variant text-center font-medium">
          {methodBadge}
        </p>
      )}

      {/* Loading progress note */}
      {isLoading && (
        <p className="text-[10px] text-on-surface-variant text-center animate-pulse">
          Vui lòng giữ nguyên màn hình và không đóng ứng dụng...
        </p>
      )}
    </div>
  );
};

interface BottomNavProps {
  activeTab: EmployeeTab;
  onTabChange: (tab: EmployeeTab) => void;
  pendingCount?: number;
}

export const BottomNavigation: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  pendingCount = 0,
}) => {
  const tabClass = (active: boolean) =>
    active
      ? 'bg-secondary-container text-on-secondary-container rounded-xl p-1 scale-95 active:scale-90 transition-transform'
      : 'text-on-surface-variant hover:bg-surface-container rounded-xl p-1 scale-95 active:scale-90 transition-transform';

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 inset-x-0 z-30 h-[68px] drop-shadow-xl"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-around
        rounded-t-2xl
        border border-b-0 border-white/40
        bg-gradient-to-b from-white/70 to-[#f5f2ee]/80
        backdrop-blur-lg
        px-4
        shadow-[0_-4px_24px_rgba(0,0,0,0.08)]
      ">
        <button
          id="nav-tab-today"
          type="button"
          onClick={() => onTabChange('TODAY')}
          className={`flex flex-col items-center justify-center px-6 py-1 text-xs font-medium transition-colors ${tabClass(activeTab === 'TODAY')}`}
        >
          <Calendar className={`w-5 h-5 mb-0.5 ${activeTab === 'TODAY' ? 'stroke-[2.5]' : ''}`} />
          <span>Hôm nay</span>
        </button>

        <button
          id="nav-tab-history"
          type="button"
          onClick={() => onTabChange('HISTORY')}
          className={`flex flex-col items-center justify-center px-6 py-1 text-xs font-medium relative ${tabClass(activeTab === 'HISTORY')}`}
        >
          <History className={`w-5 h-5 mb-0.5 ${activeTab === 'HISTORY' ? 'stroke-[2.5]' : ''}`} />
          <span>Lịch sử</span>
          {pendingCount > 0 && (
            <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-tertiary-container"></span>
          )}
        </button>

        <button
          id="nav-tab-profile"
          type="button"
          onClick={() => onTabChange('PROFILE')}
          className={`flex flex-col items-center justify-center px-6 py-1 text-xs font-medium ${tabClass(activeTab === 'PROFILE')}`}
        >
          <User className={`w-5 h-5 mb-0.5 ${activeTab === 'PROFILE' ? 'stroke-[2.5]' : ''}`} />
          <span className="flex items-center gap-1">
            Cá nhân
            <span className="text-[9px] bg-surface-variant text-on-surface-variant px-1 rounded border border-outline-variant">ERP</span>
          </span>
        </button>
      </div>
    </nav>
  );
};