import React from 'react';
import {
  Wifi,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Building,
  Navigation,
  Sparkles,
  Info,
} from 'lucide-react';
import { MethodType, VerificationState } from '../../types';

interface VerificationBannerProps {
  state: VerificationState;
  method: MethodType;
  onRetry: () => void;
  onOpenPermissionHelp?: () => void;
}

export const VerificationBanner: React.FC<VerificationBannerProps> = ({
  state,
  method,
  onRetry,
  onOpenPermissionHelp,
}) => {
  if (state === 'VALID') {
    return (
      <div
        id="verification-banner-valid"
        className="flex items-center gap-2.5 p-3 rounded-lg bg-secondary-container border border-secondary text-on-secondary-container text-xs shadow-sm"
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <div className="flex-1">
          <span className="font-semibold">Điều kiện chấm công hợp lệ</span>
          <p className="text-[11px] mt-0.5">
            {method === 'NETWORK' && 'Đã kết nối mạng Văn phòng TVS Quận 8.'}
            {method === 'GPS' && 'Đang trong bán kính chấm công (18m < 100m).'}
            {method === 'SELFIE' && 'Sẵn sàng chụp ảnh bằng chứng khuôn mặt.'}
          </p>
        </div>
      </div>
    );
  }

  const getWarningContent = () => {
    switch (state) {
      case 'INVALID_NETWORK':
        return {
          title: 'Chưa kết nối Wi-Fi/LAN công ty',
          desc: 'Vui lòng kết nối vào mạng TVS_OFFICE_Q8 hoặc cắm dây mạng LAN của văn phòng để chấm công.',
          action: 'Kiểm tra lại',
        };
      case 'OUT_OF_GEOFENCE':
        return {
          title: 'Ngoài phạm vi chấm công',
          desc: 'Bạn đang cách Văn phòng TVS Quận 8 khoảng 450m (vượt quá bán kính cho phép 100m).',
          action: 'Làm mới vị trí',
        };
      case 'LOW_ACCURACY':
        return {
          title: 'Vị trí chưa đủ chính xác (Sai số ±120m > 80m)',
          desc: 'Tín hiệu GPS yếu. Hãy di chuyển ra khu vực thông thoáng hoặc bật Wi-Fi để tăng độ chính xác.',
          action: 'Lấy lại GPS',
        };
      case 'NO_LOCATION_PERMISSION':
        return {
          title: 'Chưa cấp quyền vị trí cho trình duyệt',
          desc: 'Hệ thống cần quyền truy cập GPS để xác minh vị trí chấm công.',
          action: 'Mở hướng dẫn cấp quyền',
          isPermission: true,
        };
      case 'NO_CAMERA_PERMISSION':
        return {
          title: 'Chưa cấp quyền Camera',
          desc: 'Vui lòng cho phép trình duyệt truy cập camera trước để chụp ảnh bằng chứng selfie.',
          action: 'Mở hướng dẫn cấp quyền',
          isPermission: true,
        };
      case 'UNCONFIGURED':
        return {
          title: 'Địa điểm chưa được cấu hình mạng / GPS',
          desc: 'Workplace chưa được gán dải IP hoặc tọa độ trong chính sách ERP. Vui lòng liên hệ IT / HR.',
          action: 'Liên hệ hỗ trợ',
        };
      case 'CHECKING':
        return {
          title: 'Đang xác minh điều kiện chấm công...',
          desc: 'Hệ thống đang kiểm tra mạng và định vị GPS từ máy chủ ERP.',
          action: null,
        };
      default:
        return {
          title: 'Không thể xác minh điều kiện',
          desc: 'Vui lòng kiểm tra lại kết nối mạng hoặc cấp lại quyền cho thiết bị.',
          action: 'Thử lại',
        };
    }
  };

  const content = getWarningContent();

  return (
    <div
      id="verification-banner-warning"
      className="p-3.5 rounded-lg bg-error-container/25 border border-error-container text-on-error-container text-xs space-y-2"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-on-error-container text-xs">{content.title}</p>
          <p className="text-[11px] mt-0.5 leading-relaxed">{content.desc}</p>
        </div>
      </div>

      {content.action && (
        <div className="flex justify-end pt-1">
          <button
            id="btn-banner-action-retry"
            type="button"
            onClick={content.isPermission ? onOpenPermissionHelp : onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container-low font-semibold text-[11px] transition-colors border border-outline-variant"
          >
            <RefreshCw className="w-3 h-3" />
            {content.action}
          </button>
        </div>
      )}
    </div>
  );
};

interface NetworkCardProps {
  state: VerificationState;
  onRetry: () => void;
}

export const NetworkVerificationCard: React.FC<NetworkCardProps> = ({
  state,
  onRetry,
}) => {
  const isValid = state === 'VALID';

  return (
    <div
      id="card-network-verification"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isValid ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-on-surface">Mạng Wi-Fi / LAN công ty</h4>
            <p className="text-[10px] text-on-surface-variant">Xác thực Public IP qua Backend ERP</p>
          </div>
        </div>
        <button
          id="btn-refresh-network"
          type="button"
          onClick={onRetry}
          title="Kiểm tra lại mạng"
          className="p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className={`p-3 rounded-lg border text-xs ${
        isValid
          ? 'bg-secondary-container/20 border-secondary text-on-surface'
          : 'bg-surface-container-low border-outline-variant text-on-surface-variant'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-[11px]">Trạng thái kết nối:</span>
          <span className={`font-bold ${isValid ? 'text-secondary' : 'text-on-surface-variant'}`}>
            {isValid ? 'Hợp lệ (TVS_OFFICE_Q8)' : 'Không khớp mạng văn phòng'}
          </span>
        </div>
        <p className="text-[10px] leading-tight">
          * Frontend bảo mật không hiển thị IP đầy đủ. Backend tự động đối soát subnet an toàn.
        </p>
      </div>
    </div>
  );
};

interface GPSCardProps {
  state: VerificationState;
  distanceMeters?: number;
  accuracyMeters?: number;
  onRefreshLocation: () => void;
}

export const GPSVerificationCard: React.FC<GPSCardProps> = ({
  state,
  distanceMeters = 18,
  accuracyMeters = 16,
  onRefreshLocation,
}) => {
  const isInZone = state === 'VALID' || (distanceMeters <= 100 && accuracyMeters <= 80);

  return (
    <div
      id="card-gps-verification"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isInZone ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-variant text-on-surface-variant'}`}>
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-on-surface">Vị trí GPS Geofence</h4>
            <p className="text-[10px] text-on-surface-variant">Văn phòng TVS Quận 8 (Bán kính 100m)</p>
          </div>
        </div>
        <button
          id="btn-refresh-gps"
          type="button"
          onClick={onRefreshLocation}
          title="Lấy lại tọa độ GPS"
          className="p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mini Geofence status visualizer */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant">
          <span className="text-[10px] text-on-surface-variant block">Khoảng cách đến VP:</span>
          <span className={`font-mono text-sm font-bold ${isInZone ? 'text-secondary' : 'text-error'}`}>
            {distanceMeters} mét
          </span>
          <span className="text-[10px] text-on-surface-variant block mt-0.5">(Tối đa: 100m)</span>
        </div>

        <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant">
          <span className="text-[10px] text-on-surface-variant block">Độ chính xác GPS:</span>
          <span className={`font-mono text-sm font-bold ${accuracyMeters <= 80 ? 'text-secondary' : 'text-tertiary-container'}`}>
            ±{accuracyMeters} mét
          </span>
          <span className="text-[10px] text-on-surface-variant block mt-0.5">(Yêu cầu: ≤ 80m)</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant bg-surface-container-low p-2 rounded border border-outline-variant/60">
        <Navigation className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
        <span className="truncate">123 đường mẫu, Quận 8, TP.HCM</span>
      </div>
    </div>
  );
};

interface SelfieEvidenceCardProps {
  onOpenPolicy?: () => void;
}

export const SelfieEvidenceCard: React.FC<SelfieEvidenceCardProps> = ({
  onOpenPolicy,
}) => {
  return (
    <div
      id="card-selfie-evidence"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-on-surface">Bằng chứng Ảnh Selfie & Vị trí</h4>
            <p className="text-[10px] text-on-surface-variant">Chính sách nhân viên thị trường / công tác</p>
          </div>
        </div>
        {onOpenPolicy && (
          <button
            id="btn-selfie-help"
            type="button"
            onClick={onOpenPolicy}
            className="text-on-surface-variant hover:text-primary"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant text-xs text-on-surface space-y-1.5">
        <p className="font-semibold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          Quy định chụp ảnh bằng chứng:
        </p>
        <ul className="text-[11px] text-on-surface-variant space-y-1 pl-4 list-disc">
          <li>Chụp trực tiếp bằng camera trước (không chọn ảnh từ thư viện).</li>
          <li>Kèm tọa độ GPS và thời gian Server chính thức.</li>
          <li>Check-in và Check-out ở 2 địa điểm khác nhau vẫn hợp lệ.</li>
        </ul>
      </div>
    </div>
  );
};

interface ExceptionSuggestionCardProps {
  onAcceptOfficeMethod: () => void;
  onContinueSelfie: () => void;
  onWhyProposal: () => void;
}

export const ExceptionSuggestionCard: React.FC<ExceptionSuggestionCardProps> = ({
  onAcceptOfficeMethod,
  onContinueSelfie,
  onWhyProposal,
}) => {
  return (
    <div
      id="card-exception-suggestion"
      className="p-4 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary text-on-primary shadow-xs">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed px-1.5 py-0.2 rounded border border-primary-fixed-dim">
              Đề xuất tự động [Proposed - Cần BA/PO xác nhận]
            </span>
            <h4 className="text-xs font-bold text-on-surface mt-0.5">
              Phát hiện bạn đang có mặt tại Văn phòng TVS Quận 8
            </h4>
          </div>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant leading-relaxed">
        Hệ thống phát hiện thiết bị đang kết nối mạng Wi-Fi công ty. Bạn có muốn chuyển sang <strong>Phương thức Văn phòng (Mạng công ty)</strong> cho hôm nay không?
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <button
          id="btn-accept-office-method"
          type="button"
          onClick={onAcceptOfficeMethod}
          className="w-full py-2.5 px-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <Building className="w-3.5 h-3.5" />
          Sử dụng phương thức văn phòng (Khuyên dùng)
        </button>

        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            id="btn-continue-selfie"
            type="button"
            onClick={onContinueSelfie}
            className="text-on-surface-variant hover:text-on-surface underline text-[11px]"
          >
            Tiếp tục dùng Selfie
          </button>
          <button
            id="btn-why-proposal"
            type="button"
            onClick={onWhyProposal}
            className="text-primary hover:text-primary-container flex items-center gap-1 text-[11px] font-medium"
          >
            <HelpCircle className="w-3 h-3" />
            Vì sao có đề xuất này?
          </button>
        </div>
      </div>
    </div>
  );
};