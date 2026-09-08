import React from 'react';
import {
  Table,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Wifi,
  MapPin,
  Camera,
  Lock,
  RefreshCw,
  ShieldCheck,
  Building,
  User,
  Calendar,
} from 'lucide-react';
import {
  AttendanceStatusBadge,
  ApprovalStatusBadge,
  MethodBadge,
} from '../../components/common/Badges';

export const ButtonMatrixView: React.FC = () => {
  const matrixData = [
    {
      method: 'NETWORK',
      scenario: 'Kết nối đúng Wi-Fi/LAN văn phòng (IP khớp)',
      status: 'Chưa Check-in',
      btnState: 'ENABLED (Sẵn sàng)',
      btnLabel: 'Check-in ngay',
      reasonBanner: 'Đã kết nối mạng Văn phòng TVS Quận 8',
      variantClass: 'bg-secondary-container/30 text-emerald-800 border-emerald-300',
    },
    {
      method: 'NETWORK',
      scenario: 'Chưa kết nối Wi-Fi công ty / Dùng 4G ngoài',
      status: 'Chưa Check-in',
      btnState: 'DISABLED (Khóa)',
      btnLabel: 'Check-in (Khóa)',
      reasonBanner: 'Vui lòng kết nối Wi-Fi/LAN công ty để chấm công',
      variantClass: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-amber-300',
    },
    {
      method: 'GPS',
      scenario: 'Trong bán kính ≤ 100m, Sai số GPS ≤ 80m',
      status: 'Chưa Check-in',
      btnState: 'ENABLED (Sẵn sàng)',
      btnLabel: 'Check-in ngay',
      reasonBanner: 'Đang trong phạm vi cơ sở (Khoảng cách 18m)',
      variantClass: 'bg-secondary-container/30 text-emerald-800 border-emerald-300',
    },
    {
      method: 'GPS',
      scenario: 'Ngoài bán kính (>100m) hoặc GPS yếu (>80m)',
      status: 'Chưa Check-in',
      btnState: 'DISABLED (Khóa)',
      btnLabel: 'Check-in (Khóa)',
      reasonBanner: 'Bạn đang ở ngoài phạm vi hoặc độ chính xác GPS chưa đạt',
      variantClass: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-amber-300',
    },
    {
      method: 'GPS / SELFIE',
      scenario: 'Người dùng từ chối quyền vị trí / camera',
      status: 'Chưa Check-in',
      btnState: 'DISABLED (Khóa)',
      btnLabel: 'Check-in (Khóa)',
      reasonBanner: 'Chưa cấp quyền truy cập. Hãy bật quyền trong cài đặt trình duyệt',
      variantClass: 'bg-error-container text-rose-800 border-rose-300',
    },
    {
      method: 'SELFIE',
      scenario: 'Đã cấp quyền camera & vị trí',
      status: 'Chưa Check-in',
      btnState: 'ENABLED (Sẵn sàng)',
      btnLabel: 'Chụp ảnh Check-in',
      reasonBanner: 'Mở camera trước để chụp ảnh bằng chứng',
      variantClass: 'bg-violet-50 text-violet-800 border-violet-300',
    },
    {
      method: 'SELFIE',
      scenario: 'Check-in đang chờ duyệt (PENDING)',
      status: 'Đã Check-in (Chờ duyệt)',
      btnState: 'ENABLED CHO CHECK-OUT',
      btnLabel: 'Chụp ảnh Check-out',
      reasonBanner: 'Ảnh Check-in đang chờ duyệt. Nút Check-out KHÔNG bị khóa',
      variantClass: 'bg-sky-50 text-sky-800 border-sky-300',
    },
    {
      method: 'ALL',
      scenario: 'Đang trong tiến trình upload ảnh / gửi server',
      status: 'Đang xử lý',
      btnState: 'DISABLED (Loading)',
      btnLabel: 'Đang ghi nhận Check-in...',
      reasonBanner: 'Đang xử lý request bảo mật, vui lòng không đóng trang',
      variantClass: 'bg-surface-container-low text-on-surface border-outline',
    },
    {
      method: 'ALL',
      scenario: 'Đã hoàn tất cả Check-in và Check-out',
      status: 'Hoàn thành ngày công',
      btnState: 'HIDDEN (Ẩn nút)',
      btnLabel: '—',
      reasonBanner: 'Ngày công đã hoàn thành, không còn thao tác tiếp theo',
      variantClass: 'bg-secondary-container/30 text-emerald-800 border-emerald-300',
    },
    {
      method: 'ALL',
      scenario: 'Bảng công tháng đã khóa sổ',
      status: 'Bảng công đã khóa',
      btnState: 'DISABLED (Khóa)',
      btnLabel: 'Bảng công đã khóa',
      reasonBanner: 'Kỳ công đã đóng để chốt lương. Liên hệ HR nếu cần giải trình',
      variantClass: 'bg-surface-container text-on-surface border-slate-400',
    },
  ];

  return (
    <div id="button-decision-matrix" className="space-y-6">
      <div className="border-b border-outline-variant pb-3">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <Table className="w-5 h-5 text-on-surface" />
          Bảng mô tả trạng thái nút Check-in / Check-out (Decision Matrix)
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Quy tắc kiểm soát trạng thái nút bấm, nhãn hiển thị và nội dung giải thích lý do khóa nút.
        </p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Phương thức</th>
                <th className="py-3 px-4">Tình huống / Điều kiện</th>
                <th className="py-3 px-4">Trạng thái ngày</th>
                <th className="py-3 px-4">Trạng thái nút</th>
                <th className="py-3 px-4">Nhãn nút (Label)</th>
                <th className="py-3 px-4">Nội dung Banner giải thích lý do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {matrixData.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-on-surface">
                    <span className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant text-[10px]">
                      {row.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-on-surface font-medium">{row.scenario}</td>
                  <td className="py-3 px-4 text-on-surface-variant">{row.status}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${row.variantClass}`}>
                      {row.btnState}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-on-surface">{row.btnLabel}</td>
                  <td className="py-3 px-4 text-on-surface-variant italic">{row.reasonBanner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ComponentInventoryView: React.FC = () => {
  const componentsList = [
    { name: '1. EmployeeHeader', role: 'Employee', desc: 'App bar, thông tin nhân viên TVS-0248, đồng hồ Server time chuẩn.' },
    { name: '2. ShiftCard', role: 'Employee', desc: 'Thông tin ca hành chính 08:00 - 17:00, địa điểm workplace phân công.' },
    { name: '3. TodayStatusCard', role: 'Employee', desc: 'Trạng thái tổng quan hôm nay, đếm giờ làm việc tạm tính.' },
    { name: '4. AttendanceTimeline', role: 'Employee', desc: 'Tiến trình Check-in và Check-out 2 bước với giờ, địa chỉ, phương thức.' },
    { name: '5. VerificationBanner', role: 'Employee', desc: 'Banner phản hồi điều kiện hợp lệ hoặc giải thích lý do bị khóa.' },
    { name: '6. NetworkVerificationCard', role: 'Employee', desc: 'Kiểm tra Wi-Fi/LAN công ty, đối soát public IP qua Backend.' },
    { name: '7. GPSVerificationCard', role: 'Employee', desc: 'Đo khoảng cách đến cơ sở (18m < 100m) và độ chính xác GPS.' },
    { name: '8. SelfieEvidenceCard', role: 'Employee', desc: 'Hướng dẫn chụp ảnh selfie bằng camera trước kèm tọa độ cho nhân viên thị trường.' },
    { name: '9. CameraCapture', role: 'Employee', desc: 'Camera toàn màn hình, khung oval căn mặt, nút chụp ngón cái, không lấy ảnh thư viện.' },
    { name: '10. SelfiePreview', role: 'Employee', desc: 'Xem trước ảnh có watermark giờ server và địa chỉ, nút Chụp lại và Sử dụng.' },
    { name: '11. ActionButton', role: 'Employee', desc: 'Nút thao tác chính lớn một chạm, hỗ trợ loading state và giải thích lý do khóa.' },
    { name: '12. ApprovalStatusBadge', role: 'Common', desc: 'Badge trạng thái duyệt: Tự động, Chờ duyệt, Đã duyệt, Từ chối, Giải trình.' },
    { name: '13. AttendanceStatusBadge', role: 'Common', desc: 'Badge trạng thái công: Chưa Check-in, Trong ca, Hoàn thành, Đi trễ, Về sớm.' },
    { name: '14. HistorySummary', role: 'Employee', desc: '4 thẻ KPI tổng hợp: Số ngày công, Đi trễ, Về sớm, Vắng trong tháng.' },
    { name: '15. HistoryListItem', role: 'Employee', desc: 'Hàng danh sách ngày công trong tháng, giờ vào ra, tổng giờ, click mở chi tiết.' },
    { name: '16. DayDetailView (E10)', role: 'Employee', desc: 'Chi tiết ngày công, audit trail, ảnh thumbnail, nút yêu cầu điều chỉnh [Proposed].' },
    { name: '17. MapEvidenceCard / Radar', role: 'Approver', desc: 'Mô phỏng bản đồ 2 điểm cách 18.4km hoặc sơ đồ geofence GPS 450m.' },
    { name: '18. AuditTimeline', role: 'Common', desc: 'Nhật ký thao tác chuẩn ERP ghi nhận từng hành động của nhân viên và Cấp trên.' },
    { name: '19. ApproverActionBar', role: 'Approver', desc: 'Sticky action bar cạnh dưới: Duyệt ngày công, Yêu cầu giải trình, Từ chối.' },
    { name: '20. ErrorState & SystemState', role: 'Common', desc: 'Xử lý mất mạng, lỗi API, hết hạn SSO (đăng nhập lại qua ERP), ngày nghỉ, khóa sổ.' },
    { name: '21. EmptyState', role: 'Common', desc: 'Giao diện trống khi không có dữ liệu phù hợp với bộ lọc.' },
    { name: '22. LoadingSkeleton', role: 'Common', desc: 'Khung xương hiệu ứng loading tránh giật giao diện.' },
    { name: '23. BottomNavigation', role: 'Employee', desc: 'Thanh điều hướng đáy 3 mục: Hôm nay, Lịch sử, Cá nhân/ERP info.' },
    { name: '24. Confirmation & Reject Modals', role: 'Approver', desc: 'Hộp thoại xác nhận, modal bắt buộc nhập lý do từ chối, modal yêu cầu giải trình.' },
  ];

  return (
    <div id="component-inventory-view" className="space-y-6">
      <div className="border-b border-outline-variant pb-3">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <Layers className="w-5 h-5 text-on-surface" />
          Component Inventory – 24 Thành phần dùng chung (Design System)
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Danh mục toàn bộ reusable components được thiết kế cho module TVS TimeKeeping theo chuẩn Enterprise ERP.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {componentsList.map((comp, idx) => (
          <div
            key={idx}
            className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm space-y-1.5 hover:border-slate-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-on-surface">{comp.name}</h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                comp.role === 'Employee' ? 'bg-surface-container-low text-on-surface' : comp.role === 'Approver' ? 'bg-primary-fixed text-indigo-800' : 'bg-surface-container text-on-surface'
              }`}>
                {comp.role}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">{comp.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
