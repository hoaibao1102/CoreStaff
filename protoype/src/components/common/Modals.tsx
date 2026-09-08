import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  HelpCircle,
  XCircle,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-background/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="modal-card"
        className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface">
          <h3 className="font-semibold text-on-surface text-base">{title}</h3>
          <button
            id="btn-modal-close"
            onClick={onClose}
            className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  employeeName?: string;
  itemCode?: string;
}

export const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employeeName = 'Nhân viên',
  itemCode = '#APV-8821',
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const predefinedReasons = [
    'Ảnh chụp không nhìn rõ khuôn mặt / ngược sáng.',
    'Ảnh chụp không có bảng tên / thẻ nhân viên.',
    'Vị trí Check-in không đúng lịch trình công tác được giao.',
    'Không cung cấp được bằng chứng bổ sung hợp lệ.',
  ];

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(true);
      return;
    }
    onConfirm(reason);
    setReason('');
    setError(false);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Từ chối phê duyệt bằng chứng (${itemCode})`}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-error-container border border-error/20 rounded-lg text-on-error-container text-sm">
          <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Lưu ý quan trọng khi Từ chối:</p>
            <p className="text-xs mt-0.5">
              Hành động này sẽ đánh dấu bản ghi của <strong>{employeeName}</strong> là không hợp lệ. Nhân viên sẽ nhận được thông báo kèm lý do cụ thể.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface uppercase tracking-wide mb-1.5">
            Lý do từ chối <span className="text-error">* (Bắt buộc)</span>
          </label>
          <textarea
            id="input-reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(false);
            }}
            placeholder="Nhập chi tiết lý do từ chối để nhân viên nắm rõ..."
            className={`w-full p-2.5 text-sm rounded-lg border bg-surface ${
              error ? 'border-error ring-2 ring-error-container' : 'border-outline-variant'
            } focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary`}
          />
          {error && (
            <p className="text-xs text-error mt-1 font-medium">
              Vui lòng nhập lý do từ chối trước khi xác nhận.
            </p>
          )}
        </div>

        <div>
          <span className="text-xs text-on-surface-variant font-medium block mb-1.5">
            Gợi ý lý do thường gặp:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {predefinedReasons.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setReason(item);
                  setError(false);
                }}
                className="text-xs text-left px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                + {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
          <button
            id="btn-cancel-reject"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container rounded-lg transition-colors border border-outline-variant"
          >
            Hủy bỏ
          </button>
          <button
            id="btn-confirm-reject"
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-semibold text-on-error bg-error hover:bg-error-container hover:text-on-error-container rounded-lg transition-colors shadow-sm"
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

interface ClarificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (message: string) => void;
  employeeName?: string;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employeeName = 'Nhân viên',
}) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (!message.trim()) {
      setError(true);
      return;
    }
    onConfirm(message);
    setMessage('');
    setError(false);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Yêu cầu ${employeeName} giải trình`}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-primary-container border border-primary/20 rounded-lg text-on-primary-container text-sm">
          <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Hệ thống sẽ gửi thông báo đến nhân viên yêu cầu cung cấp thêm thông tin làm rõ vị trí hoặc ảnh bằng chứng trước khi cấp trên đưa ra quyết định cuối cùng.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface uppercase tracking-wide mb-1.5">
            Nội dung cần giải trình <span className="text-error">*</span>
          </label>
          <textarea
            id="input-clarification-message"
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (e.target.value.trim()) setError(false);
            }}
            placeholder="Ví dụ: Vui lòng giải thích lý do địa điểm Check-out cách điểm Check-in hơn 18km hoặc gửi biên bản làm việc..."
            className={`w-full p-2.5 text-sm rounded-lg border bg-surface ${
              error ? 'border-error ring-2 ring-error-container' : 'border-outline-variant'
            } focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary`}
          />
          {error && (
            <p className="text-xs text-error mt-1 font-medium">
              Vui lòng nhập nội dung yêu cầu giải trình.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant">
          <button
            id="btn-cancel-clarification"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container rounded-lg transition-colors border border-outline-variant"
          >
            Hủy
          </button>
          <button
            id="btn-send-clarification"
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-semibold text-on-primary bg-primary hover:bg-primary-container hover:text-on-primary-container rounded-lg transition-colors shadow-sm"
          >
            Gửi yêu cầu giải trình
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Yêu cầu điều chỉnh ngày công">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-tertiary-fixed border border-tertiary-fixed-dim text-on-tertiary-fixed-variant text-xs">
          <AlertTriangle className="w-5 h-5 text-tertiary-container shrink-0 mt-0.5" />
          <div>
            <span className="inline-block px-1.5 py-0.5 mb-1 text-[10px] font-bold rounded bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim">
              [PROPOSED / PHASE SAU / FEATURE FLAG]
            </span>
            <p>
              Tính năng <strong>Gửi đơn xin giải trình & điều chỉnh công</strong> trực tuyến đang nằm trong kế hoạch phát triển Phase 2 (Cần BA/PO hoàn tất phê duyệt quy trình ERP).
            </p>
          </div>
        </div>

        <div className="text-xs text-on-surface-variant space-y-2 leading-relaxed bg-surface-container-low p-3 rounded-lg border border-outline-variant">
          <p className="font-semibold text-on-surface">Quy trình hiện tại:</p>
          <p>
            1. Nhân viên liên hệ trực tiếp Quản lý trực tiếp (Lê Hoàng Hải) hoặc Phòng Nhân sự (HRM).
          </p>
          <p>2. HR sẽ hỗ trợ mở khóa hoặc cập nhật công bù trên hệ thống ERP trung tâm.</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            id="btn-close-adjustment-notice"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-surface bg-surface-container-low hover:bg-surface-container rounded-lg transition-colors"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Chính sách chấm công TVS TimeKeeping">
      <div className="space-y-4 text-xs text-on-surface-variant max-h-[70vh] overflow-y-auto pr-1">
        <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant space-y-2">
          <h4 className="font-bold text-on-surface text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            1. Nguyên tắc thời gian và địa điểm
          </h4>
          <p>
            • Thời gian ghi nhận là <strong>thời gian Server chuẩn</strong>, không phụ thuộc vào đồng hồ trên điện thoại của nhân viên.
          </p>
          <p>
            • <strong>Ca hành chính:</strong> 08:00 – 17:00 (Nghỉ trưa 12:00 – 13:00). Check-in sau 08:00 tính là đi trễ; Check-out trước 17:00 tính là về sớm.
          </p>
        </div>

        <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant space-y-2">
          <h4 className="font-bold text-on-surface text-sm flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-primary" />
            2. Quy định 3 Phương thức chấm công
          </h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>Mạng công ty (NETWORK):</strong> Áp dụng cho nhân viên làm tại văn phòng TVS. Phải kết nối Wi-Fi/LAN công ty (Backend kiểm tra IP).
            </li>
            <li>
              <strong>Vị trí (GPS Geofence):</strong> Bán kính cho phép tối đa 100m, sai số GPS không quá 80m so với tọa độ văn phòng.
            </li>
            <li>
              <strong>Ảnh Selfie & Vị trí (SELFIE):</strong> Áp dụng cho nhân viên kinh doanh thị trường/remote. Phải chụp ảnh trực tiếp khuôn mặt bằng camera trước kèm tọa độ GPS. Cấp trên sẽ duyệt bằng chứng. Check-in và Check-out ở 2 địa điểm khác nhau vẫn được chấp nhận hợp lệ.
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <button
            id="btn-close-policy"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary-container rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </BaseModal>
  );
};