import { X, Clock, ShieldCheck, MapPin, Wifi, Camera } from 'lucide-react';

export interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PolicyModal({ isOpen, onClose }: PolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card p-5 shadow-2xl border border-border space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h3 id="policy-modal-title" className="text-base font-bold text-foreground">
              Chính sách chấm công CoreStaff
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Clock className="size-4 text-blue-600" />
              <span>Khung giờ làm việc chuẩn</span>
            </div>
            <p>• Ca hành chính: <strong>08:00 – 17:30</strong> (Nghỉ trưa: 12:00 – 13:30)</p>
            <p>• Check-in hợp lệ: Từ 07:30 đến 08:30</p>
            <p>• Check-out hợp lệ: Sau 17:30</p>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Wifi className="size-4 text-emerald-600" />
              <span>Chấm công qua mạng nội bộ</span>
            </div>
            <p>• Áp dụng khi kết nối đúng Wi-Fi / LAN của văn phòng công ty.</p>
            <p>• Hệ thống tự động xác thực IP LAN nội bộ để mở khóa nút điểm danh.</p>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <MapPin className="size-4 text-sky-600" />
              <span>Chấm công qua vị trí GPS</span>
            </div>
            <p>• Bán kính cho phép: <strong>150m</strong> quanh tọa độ trụ sở/văn phòng.</p>
            <p>• Thiết bị cần bật dịch vụ định vị GPS với độ chính xác cao.</p>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Camera className="size-4 text-violet-600" />
              <span>Chấm công qua ảnh Selfie</span>
            </div>
            <p>• Dành cho nhân sự đi thị trường / công tác ngoài văn phòng.</p>
            <p>• Bắt buộc chụp trực tiếp rõ mặt kèm tọa độ thực, không dùng ảnh thư viện.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
