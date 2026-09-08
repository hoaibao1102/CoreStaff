import React, { useState } from 'react';
import {
  GitBranch,
  Network,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  History,
  Layers,
  Sparkles,
} from 'lucide-react';

export const SitemapView: React.FC = () => {
  return (
    <div id="sitemap-view" className="space-y-6">
      <div className="border-b border-outline-variant pb-3">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <Network className="w-5 h-5 text-on-surface" />
          Sitemap cấu trúc module TVS TimeKeeping
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Sơ đồ điều hướng phân quyền tích hợp bên trong hệ thống ERP doanh nghiệp (SSO Seamless).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EMPLOYEE VIEW SITEMAP */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant">
            <span className="p-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs">
              EMP
            </span>
            <div>
              <h3 className="text-sm font-bold text-on-surface">
                1. Employee View (Mobile-First / 390×844)
              </h3>
              <p className="text-[11px] text-on-surface-variant">Dành cho nhân viên thực hiện chấm công hàng ngày</p>
            </div>
          </div>

          {/* Sitemap tree */}
          <div className="space-y-3 text-xs">
            {/* TAB 1: Hôm nay */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Tab 1: Hôm nay (Màn hình chính)
              </span>
              <ul className="pl-4 space-y-1.5 text-on-surface list-disc">
                <li>
                  <strong>E01:</strong> Chưa Check-in (E01-A: Network, E01-B: GPS, E01-C: Selfie).
                </li>
                <li>
                  <strong>E02:</strong> Chưa đủ điều kiện (Disabled State, hiển thị lý do & nút thử lại).
                </li>
                <li>
                  <strong>E03:</strong> Đang Check-in (Loading spinner, upload ảnh tiến trình).
                </li>
                <li>
                  <strong>E04:</strong> Đã Check-in, chưa Check-out (Nút Check-out sẵn sàng).
                </li>
                <li>
                  <strong>E05:</strong> Camera chụp ảnh selfie (Khung oval căn mặt, không lấy từ thư viện).
                </li>
                <li>
                  <strong>E06:</strong> Preview ảnh bằng chứng (Kèm watermark thời gian server & GPS).
                </li>
                <li>
                  <strong>E07:</strong> Đã hoàn thành ngày công (Tổng giờ, 2 địa điểm khác nhau).
                </li>
                <li>
                  <strong>E08:</strong> Bằng chứng bị từ chối (Xem lý do, nút gửi giải trình).
                </li>
                <li>
                  <strong>Ngoại lệ #7:</strong> Đề xuất đổi phương thức văn phòng [Proposed].
                </li>
              </ul>
            </div>

            {/* TAB 2: Lịch sử */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Tab 2: Lịch sử chấm công
              </span>
              <ul className="pl-4 space-y-1.5 text-on-surface list-disc">
                <li>
                  <strong>E09:</strong> Danh sách ngày công (Bộ chọn tháng, KPI: Ngày công, Đi trễ, Về sớm, Vắng).
                </li>
                <li>
                  <strong>E10:</strong> Chi tiết ngày công (Timeline, server time, ảnh selfie, tọa độ, nút điều chỉnh [Proposed]).
                </li>
              </ul>
            </div>

            {/* TAB 3: Cá nhân ERP */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Tab 3: Cá nhân / ERP Profile
              </span>
              <p className="text-[11px] text-on-surface-variant pl-4">
                Placeholder điều hướng tới Cổng thông tin nhân sự ERP tập trung (Thông tin hợp đồng, phân ca, quản lý phép).
              </p>
            </div>
          </div>
        </div>

        {/* APPROVER VIEW SITEMAP */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-outline-variant">
            <span className="p-1.5 rounded-lg bg-indigo-700 text-on-primary font-bold text-xs">
              APV
            </span>
            <div>
              <h3 className="text-sm font-bold text-on-surface">
                2. Approver View (Desktop ERP / 1440×1024)
              </h3>
              <p className="text-[11px] text-on-surface-variant">Dành cho Cấp trên / Quản lý phê duyệt bằng chứng</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* A01 Queue */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                A01: Danh sách yêu cầu chờ duyệt
              </span>
              <ul className="pl-4 space-y-1.5 text-on-surface list-disc">
                <li>Bảng tổng hợp KPI: Tổng chờ duyệt, Yêu cầu sắp quá hạn, Có cảnh báo.</li>
                <li>Tabs: Chờ duyệt / Đã duyệt / Đã từ chối / Chờ giải trình.</li>
                <li>Bộ lọc đa chiều: Nhân viên, Phòng ban, Ngày, Phương thức.</li>
                <li>Nút duyệt nhanh hoặc mở chi tiết chuyên sâu.</li>
              </ul>
            </div>

            {/* A02 Detail Selfie */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                A02: Chi tiết phê duyệt Selfie (So sánh 2 điểm)
              </span>
              <ul className="pl-4 space-y-1.5 text-on-surface list-disc">
                <li>Dual view: Ảnh Selfie Check-in (Q7) & Check-out (Thủ Đức) kèm watermark.</li>
                <li>Cảnh báo khoảng cách di chuyển 18,4 km (tham khảo, không tự động từ chối).</li>
                <li>Sticky action bar: Duyệt, Từ chối (bắt buộc lý do), Yêu cầu giải trình.</li>
              </ul>
            </div>

            {/* A03 Detail GPS */}
            <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-2">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                A03: Chi tiết bất thường GPS (Geofence Anomaly)
              </span>
              <ul className="pl-4 space-y-1.5 text-on-surface list-disc">
                <li>Sơ đồ radar vị trí nhân viên (450m) so với bán kính cho phép (100m).</li>
                <li>Xem lý do kẹt xe của nhân viên và lịch sử xử lý.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UserFlowView: React.FC = () => {
  const [selectedFlow, setSelectedFlow] = useState<
    'NETWORK' | 'GPS' | 'SELFIE' | 'APPROVER' | 'EXCEPTION'
  >('NETWORK');

  return (
    <div id="user-flows-view" className="space-y-6">
      <div className="border-b border-outline-variant pb-3">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-on-surface" />
          5 Quy trình User Flows chuẩn hóa
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Quy trình luồng nghiệp vụ chi tiết cho từng phương thức chấm công và phê duyệt.
        </p>
      </div>

      {/* Flow Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: 'NETWORK', label: '1. Flow NETWORK (Wi-Fi/LAN công ty)', icon: Network },
          { id: 'GPS', label: '2. Flow GPS Geofence (Vị trí cơ sở)', icon: MapPin },
          { id: 'SELFIE', label: '3. Flow SELFIE (Thị trường/Remote)', icon: Camera },
          { id: 'APPROVER', label: '4. Flow Phê duyệt Cấp trên', icon: ShieldCheck },
          { id: 'EXCEPTION', label: '5. Ngoại lệ đổi phương thức [Proposed]', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFlow(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedFlow === tab.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border border-outline hover:bg-surface-container-low'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Flow Diagram */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm">
        {selectedFlow === 'NETWORK' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              Quy trình Chấm công qua Mạng công ty (Wi-Fi/LAN)
            </h3>
            <p className="text-on-surface-variant">
              Áp dụng cho nhân viên văn phòng tại các trụ sở TVS. Backend xác thực IP bảo mật.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 1: Nhận diện</span>
                <p className="text-on-surface-variant">
                  Mở app, Backend ERP tự động lấy IP từ request và so khớp subnet Văn phòng TVS Q8.
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 2: Kiểm tra điều kiện</span>
                <p className="text-on-surface-variant">
                  Nếu đúng mạng: Nút Check-in sáng. Nếu sai mạng: Nút bị khóa kèm thông báo hướng dẫn.
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 3: Check-in 1 chạm</span>
                <p className="text-on-surface-variant">
                  Bấm "Check-in ngay", ghi nhận thời gian Server chuẩn (08:15:24 GMT+7).
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 4: Check-out</span>
                <p className="text-on-surface-variant">
                  Cuối ca kết nối lại mạng để Check-out một chạm. Tự động tính tổng giờ và hoàn thành.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedFlow === 'GPS' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" />
              Quy trình Chấm công qua Định vị GPS Geofence
            </h3>
            <p className="text-on-surface-variant">
              Kiểm tra nhân viên có mặt trong bán kính geofence ≤ 100m và sai số GPS ≤ 80m.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 1: Cấp quyền GPS</span>
                <p className="text-on-surface-variant">
                  Trình duyệt xin quyền vị trí chính xác cao (High Accuracy).
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 2: Tính toán khoảng cách</span>
                <p className="text-on-surface-variant">
                  Hiển thị radar khoảng cách (ví dụ 18m) và độ chính xác GPS (±16m).
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 3: Check-in</span>
                <p className="text-on-surface-variant">
                  Nếu ngoài vùng (&gt;100m) hoặc GPS yếu: Nút bị khóa kèm nút "Làm mới vị trí".
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">Bước 4: Lưu nhật ký</span>
                <p className="text-on-surface-variant">
                  Lưu trữ tọa độ, địa chỉ và thời gian server vào hệ thống.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedFlow === 'SELFIE' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Camera className="w-4 h-4 text-violet-600" />
              Quy trình Chấm công bằng Ảnh Selfie & Vị trí làm bằng chứng
            </h3>
            <p className="text-on-surface-variant">
              Áp dụng cho nhân viên thị trường, làm việc từ xa hoặc công tác. Approver sẽ duyệt bằng chứng.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 pt-2">
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">1. Mở camera</span>
                <p className="text-on-surface-variant">
                  Mở camera trước toàn màn hình với khung oval căn mặt. Cấm chọn ảnh từ thư viện.
                </p>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">2. Chụp ảnh</span>
                <p className="text-on-surface-variant">
                  Nút chụp lớn ngón cái, đồng thời ghi nhận tọa độ GPS tại thời điểm bấm chụp.
                </p>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">3. Xem trước & Watermark</span>
                <p className="text-on-surface-variant">
                  Kiểm tra ảnh có watermark thời gian server & địa chỉ. Cho phép "Chụp lại" hoặc "Sử dụng".
                </p>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">4. Gửi chờ duyệt</span>
                <p className="text-on-surface-variant">
                  Bản ghi chuyển sang "Đang chờ duyệt". Nút Check-out vẫn sẵn sàng (không bị khóa).
                </p>
              </div>
              <div className="bg-surface-container-low p-2.5 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">5. Check-out khác điểm</span>
                <p className="text-on-surface-variant">
                  Check-out tại Thủ Đức (cách Q7 18.4km) vẫn hợp lệ và tạo cảnh báo tham khảo cho Quản lý.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedFlow === 'APPROVER' && (
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Quy trình Phê duyệt của Cấp trên / Quản lý (Approver Flow)
            </h3>
            <p className="text-on-surface-variant">
              Quản lý duyệt bằng chứng Selfie và các bất thường khoảng cách hoặc định vị.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">1. Nhận thông báo & Danh sách</span>
                <p className="text-on-surface-variant">
                  Mở A01 trên desktop ERP, lọc theo phòng ban và mức độ cảnh báo (Ví dụ khoảng cách 18.4km).
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">2. Đối chiếu Dual View</span>
                <p className="text-on-surface-variant">
                  So sánh 2 ảnh selfie, kiểm tra khuôn mặt, watermark, giờ server và giải trình của nhân viên.
                </p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface block">3. Quyết định</span>
                <p className="text-on-surface-variant">
                  - <strong>Duyệt:</strong> Ghi nhận công chính thức.<br />
                  - <strong>Từ chối:</strong> Bắt buộc nhập lý do.<br />
                  - <strong>Yêu cầu giải trình:</strong> Gửi thông báo đến nhân viên.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedFlow === 'EXCEPTION' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-on-surface">
                Ngoại lệ đổi phương thức trong ngày [Proposed – Cần BA/PO xác nhận]
              </h3>
            </div>
            <p className="text-on-surface-variant">
              Nhân viên thị trường (mặc định Selfie) đến làm việc trực tiếp tại trụ sở văn phòng.
            </p>

            <div className="bg-primary-fixed/70 p-4 rounded-xl border border-indigo-200 space-y-2">
              <p className="font-semibold text-indigo-950">Nguyên tắc xử lý ngoại lệ:</p>
              <ul className="pl-4 list-disc space-y-1 text-indigo-900">
                <li>Khi phát hiện IP văn phòng hoặc GPS trong geofence, hệ thống hiển thị Suggestion Card.</li>
                <li>Nhân viên chọn <strong>"Sử dụng phương thức văn phòng"</strong>: Check-in một chạm qua mạng/GPS.</li>
                <li>Nhân viên chọn <strong>"Tiếp tục dùng Selfie"</strong>: Yêu cầu nhập lý do ngắn, bản ghi sẽ chuyển vào luồng duyệt của Quản lý.</li>
                <li>Lựa chọn chỉ có hiệu lực cho ngày hôm đó, không thay đổi policy cố định của nhân viên.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
