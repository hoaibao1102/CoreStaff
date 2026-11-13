import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Laptop,
  Lock,
  LogIn,
  MapPin,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { CoreStaffLogo } from '@/components/CoreStaffLogo';

interface LandingScreenProps {
  onGoToLogin: () => void;
  isLoggedIn?: boolean;
  onGoToApp?: () => void;
}

export function LandingScreen({ onGoToLogin, isLoggedIn = false, onGoToApp }: LandingScreenProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const handleCta = () => {
    if (isLoggedIn && onGoToApp) {
      onGoToApp();
    } else {
      onGoToLogin();
    }
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      icon: Clock,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      title: 'Chấm công đa phương thức',
      description:
        'Hỗ trợ Check-in/out linh hoạt qua Wi-Fi công ty, GPS bán kính văn phòng và ảnh khuôn mặt (Selfie/Observed). Tự động đối soát ca, phát hiện đi trễ, về sớm tức thì.',
      badge: 'Chống gian lận',
    },
    {
      icon: Calendar,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      title: 'Quản lý Ca & Phân lịch',
      description:
        'Thiết lập linh hoạt ca hành chính, ca xoay, ca gãy. Hỗ trợ nhân viên gửi đơn nghỉ phép, xin đổi ca và quy trình phê duyệt trực tuyến đa cấp cho quản lý.',
      badge: 'Linh hoạt',
    },
    {
      icon: Award,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      title: 'Làm thêm giờ (OT) chuẩn luật',
      description:
        'Tự động áp dụng hệ số làm thêm giờ: ngày thường (x1.5), ngày nghỉ tuần (x2.0), ngày lễ tết (x3.0). Tự động kiểm soát trần 40h/tháng, 200h/năm theo BLLĐ 2019.',
      badge: 'BLLĐ 2019',
    },
    {
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      title: 'Tự động hóa Tính lương',
      description:
        'Tính lương chính xác từ ngày công thực tế, phụ cấp và giờ làm thêm. Tự động trích nộp BHXH/BHYT/BHTN theo mức sàn/trần và áp biểu thuế TNCN lũy tiến.',
      badge: 'Chính xác 100%',
    },
    {
      icon: FileSpreadsheet,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      title: 'Rà soát kỳ công & Snapshot',
      description:
        'Cơ chế khóa kỳ công bất biến (Immutable Snapshot) trước khi tính lương, bảo vệ dữ liệu công chống sai lệch, phục vụ thanh tra và kiểm toán minh bạch.',
      badge: 'Minh bạch',
    },
    {
      icon: FileText,
      color: 'bg-rose-50 text-rose-600 border-rose-200',
      title: 'Tự phục vụ & Giải trình công',
      description:
        'Cho phép nhân viên tự theo dõi bảng công, gửi đơn xác nhận công khi quên quẹt thẻ trong hạn mức, giải trình lý do bất thường khi HR yêu cầu.',
      badge: 'Self-Service',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Thiết lập Chính sách (Policy-Driven)',
      description:
        'HR thiết lập các bộ chính sách: quy đổi ngày công, thời giờ làm việc tiêu chuẩn, hệ số OT, mức trần/sàn BHXH và biểu thuế TNCN theo luật định.',
      tag: 'Cấu hình nền tảng',
    },
    {
      step: '02',
      title: 'Chấm công & Điểm danh hàng ngày',
      description:
        'Nhân viên thực hiện Check-in/out qua Wi-Fi hoặc GPS. Hệ thống tự động ghi nhận giờ vào ra, tính toán số phút làm việc và quy đổi công thực tế.',
      tag: 'Thu thập dữ liệu',
    },
    {
      step: '03',
      title: 'Rà soát & Chốt kỳ công',
      description:
        'Quản lý duyệt đơn nghỉ phép, OT, đơn xác nhận công. HR đối soát bất thường, yêu cầu giải trình và khóa snapshot kỳ công.',
      tag: 'Kiểm soát chặt chẽ',
    },
    {
      step: '04',
      title: 'Chạy bảng lương & Phiếu lương',
      description:
        'Hệ thống tự động tính lương theo công, khấu trừ thuế, bảo hiểm bắt buộc và phát hành phiếu lương điện tử (Payslip) trực tuyến cho từng nhân sự.',
      tag: 'Tự động hóa hoàn tất',
    },
  ];

  const legalCompliance = [
    {
      title: 'Bộ luật Lao động 2019 (BLLĐ 45/2019/QH14)',
      items: [
        'Giờ làm việc tiêu chuẩn tối đa 08 giờ/ngày, 48 giờ/tuần (Điều 105).',
        'Trần làm thêm giờ: tối đa 40 giờ/tháng, 200 giờ/năm (ngoại lệ 300 giờ) (Điều 107).',
        'Hệ số làm thêm giờ: ngày thường ≥150%, ngày nghỉ tuần ≥200%, ngày lễ tết ≥300% (Điều 98).',
        'Lương thử việc tối thiểu đạt 85% mức lương chính thức (Điều 26).',
      ],
    },
    {
      title: 'Luật Bảo hiểm Xã hội 2024 & Thuế TNCN',
      items: [
        'Áp dụng mức sàn theo Lương tối thiểu vùng (Nghị định 74/2024/NĐ-CP).',
        'Trần đóng BHXH/BHYT tối đa 20 lần mức tham chiếu (hiện tại: 46.800.000 VNĐ).',
        'Trần BHTN tối đa 20 lần lương tối thiểu vùng theo Luật Việc làm (Vùng I: 99.200.000 VNĐ).',
        'Khấu trừ thuế TNCN lũy tiến từng phần và quy định khấu trừ 10% hợp đồng thử việc (TT 111/2013/TT-BTC).',
      ],
    },
  ];

  const faqs = [
    {
      question: 'CoreStaff hỗ trợ những hình thức chấm công nào?',
      answer:
        'CoreStaff hỗ trợ chấm công đa phương thức: xác thực qua kết nối Wi-Fi văn phòng được ủy quyền, định vị GPS trong bán kính cho phép của công ty, hoặc chấm công bằng ảnh chụp thực tế (Selfie/Observed). Mọi lượt quẹt thẻ đều lưu trữ nhật ký sự kiện minh bạch chống gian lận.',
    },
    {
      question: 'Nhân viên quên quẹt thẻ tan ca thì xử lý như thế nào?',
      answer:
        'Nhân viên có thể gửi "Đơn xác nhận công" trực tiếp trên hệ thống để quản lý trực tiếp phê duyệt. Để đảm bảo tính kỷ luật, hệ thống áp dụng hạn mức tối đa (mặc định 3 lượt/tháng). Nếu hôm đó có tăng ca (OT), hệ thống sẽ tách biệt rõ ràng để HR xác minh giờ làm thêm thực tế.',
    },
    {
      question: 'Làm thế nào để bảo đảm dữ liệu tính lương không bị sửa đổi sau khi chốt?',
      answer:
        'CoreStaff áp dụng cơ chế Payroll Input Snapshot bất biến. Khi HR bấm đóng kỳ công, toàn bộ số liệu ngày công, giờ làm, OT và phụ cấp được đóng băng thành một bản chụp dữ liệu. Bất kỳ thay đổi sau đó đều cần quy trình mở lại kỳ công có lưu vết kiểm toán (Audit Trail).',
    },
    {
      question: 'Hệ thống có tính thuế TNCN và bảo hiểm bắt buộc theo luật mới không?',
      answer:
        'Có. CoreStaff được xây dựng chuẩn theo Luật Bảo hiểm Xã hội 2024 và Luật Thuế TNCN. Hệ thống tự động chặn mức sàn (lương tối thiểu vùng), mức trần (20 lần mức tham chiếu hoặc lương tối thiểu vùng) và áp dụng biểu thuế lũy tiến từng phần cùng giảm trừ gia cảnh chuẩn xác.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#172033] selection:bg-[#174ea6] selection:text-white">
      {/* ── HEADER NAVIGATION ── */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-left"
            >
              <CoreStaffLogo />
            </button>
            <nav className="hidden items-center gap-6 md:flex">
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="text-sm font-medium text-[#4b5563] transition hover:text-[#174ea6]"
              >
                Tính năng cốt lõi
              </button>
              <button
                type="button"
                onClick={() => scrollTo('workflow')}
                className="text-sm font-medium text-[#4b5563] transition hover:text-[#174ea6]"
              >
                Quy trình 4 bước
              </button>
              <button
                type="button"
                onClick={() => scrollTo('compliance')}
                className="text-sm font-medium text-[#4b5563] transition hover:text-[#174ea6]"
              >
                Tuân thủ pháp lý
              </button>
              <button
                type="button"
                onClick={() => scrollTo('faq')}
                className="text-sm font-medium text-[#4b5563] transition hover:text-[#174ea6]"
              >
                Hỏi đáp
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="landing-login-btn"
              onClick={handleCta}
              className="inline-flex items-center gap-2 rounded-lg bg-[#174ea6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123e85] active:translate-y-px"
            >
              {isLoggedIn ? (
                <>
                  <span>Vào Bảng điều khiển</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Đăng nhập hệ thống</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="border-b border-border bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="text-left text-sm font-medium text-[#4b5563] py-2"
              >
                Tính năng cốt lõi
              </button>
              <button
                type="button"
                onClick={() => scrollTo('workflow')}
                className="text-left text-sm font-medium text-[#4b5563] py-2"
              >
                Quy trình 4 bước
              </button>
              <button
                type="button"
                onClick={() => scrollTo('compliance')}
                className="text-left text-sm font-medium text-[#4b5563] py-2"
              >
                Tuân thủ pháp lý
              </button>
              <button
                type="button"
                onClick={() => scrollTo('faq')}
                className="text-left text-sm font-medium text-[#4b5563] py-2"
              >
                Hỏi đáp
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden border-b border-[#e5e7eb] bg-gradient-to-b from-[#f0f4fa] via-[#fafbfc] to-white py-16 sm:py-24">
        {/* Decorative background glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 select-none opacity-40 blur-3xl">
          <div className="h-[450px] w-[800px] rounded-full bg-gradient-to-tr from-blue-300 via-indigo-200 to-sky-100" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-4 py-1.5 text-xs font-semibold text-[#174ea6] shadow-sm backdrop-blur-sm">
              <Sparkles size={14} className="text-[#174ea6]" />
              <span>Nền tảng Quản trị Nhân sự & Chấm công Tiền lương Thế hệ mới</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] sm:text-5xl sm:leading-[1.15]">
              Quản trị nhân sự số hóa,{' '}
              <span className="text-[#174ea6]">chấm công thông minh</span> & tính lương chuẩn xác
            </h1>

            <p className="mt-6 text-base leading-7 text-[#4b5563] sm:text-lg">
              Giải pháp toàn diện tuân thủ 100% Bộ luật Lao động Việt Nam. Tự động hóa từ điểm danh, phân ca,
              xác nhận công, rà soát kỳ công đến tính lương, trích nộp bảo hiểm và thuế TNCN minh bạch.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                data-testid="landing-hero-cta-btn"
                onClick={handleCta}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#174ea6] px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#123e85] hover:shadow-lg active:translate-y-px sm:w-auto"
              >
                <span>{isLoggedIn ? 'Vào Bảng điều khiển ngay' : 'Truy cập hệ thống ngay'}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-[#374151] shadow-sm transition hover:bg-gray-50 active:translate-y-px sm:w-auto"
              >
                <span>Khám phá tính năng</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Quick check trust markers */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-medium text-[#6b7280]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Tuân thủ Bộ luật Lao động 2019
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Cập nhật Luật BHXH 2024
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Phiếu lương điện tử minh bạch
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Audit Trail chống gian lận
              </span>
            </div>
          </div>

          {/* ── HERO DASHBOARD PREVIEW MOCKUP ── */}
          <div className="mt-12 rounded-2xl border border-border bg-white p-3 shadow-2xl sm:p-5">
            <div className="rounded-xl border border-gray-200 bg-[#f8fafc] p-4 sm:p-6">
              {/* Mockup Topbar */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#174ea6] font-bold text-white shadow-sm">
                    CS
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#111827]">Bảng tổng hợp chấm công & Tiền lương</h2>
                    <p className="text-xs text-[#6b7280]">Kỳ công tháng: 2026-10 • Tổ chức: Công ty Cổ phần An Phát</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <Check size={12} /> Đã khóa snapshot
                  </span>
                  <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#174ea6] border border-blue-200">
                    Kỳ đã tính lương
                  </span>
                </div>
              </div>

              {/* Mockup Stat Cards Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500">TỔNG NGÀY CÔNG GHI NHẬN</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">22.0 / 22</span>
                    <span className="text-xs font-semibold text-emerald-600">100% công</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Đạt tiêu chuẩn 1.0 công/ngày</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500">LÀM THÊM GIỜ (OT)</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#174ea6]">14.5 giờ</span>
                    <span className="text-xs font-semibold text-blue-600">Hệ số 1.5 & 2.0</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Trong trần 40h/tháng theo luật</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500">BẢO HIỂM BẮT BUỘC (10.5%)</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">1.575.000 đ</span>
                    <span className="text-xs font-semibold text-gray-500">BHXH/BHYT/BHTN</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Áp dụng trần 20 lần mức tham chiếu</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <span className="text-xs font-semibold text-gray-500">LƯƠNG THỰC NHẬN (NET)</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-600">18.425.000 đ</span>
                    <span className="text-xs font-semibold text-emerald-700">Đã trừ PIT</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Phiếu lương đã sẵn sàng xem</p>
                </div>
              </div>

              {/* Mockup Punch Trace Items */}
              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span>NHẬT KÝ CHẤM CÔNG GẦN ĐÂY</span>
                  <span className="text-gray-400">Thời gian thực</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded-md bg-gray-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-gray-900">Check-in: 07:55 AM</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        Wi-Fi Văn phòng
                      </span>
                    </div>
                    <span className="font-medium text-emerald-600">Đúng giờ (+5 phút)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-gray-50 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="font-semibold text-gray-900">Check-out: 17:05 PM</span>
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                        Tan ca
                      </span>
                    </div>
                    <span className="font-medium text-gray-600">Đủ 480 phút • 1.0 công</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES SECTION ── */}
      <section id="features" className="border-b border-[#e5e7eb] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#174ea6]">Giải pháp toàn diện</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Các phân hệ cốt lõi của CoreStaff
            </h2>
            <p className="mt-4 text-base text-[#4b5563]">
              Thiết kế theo chuẩn nghiệp vụ thực tế của doanh nghiệp, gắn kết liền mạch giữa bộ phận Nhân sự (HR),
              Cán bộ quản lý (Manager) và Nhân viên (Employee).
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`grid h-12 w-12 place-items-center rounded-xl border ${f.color}`}>
                        <Icon size={24} />
                      </div>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                        {f.badge}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-gray-900">{f.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW SECTION (4 BƯỚC) ── */}
      <section id="workflow" className="border-b border-[#e5e7eb] bg-[#f8fafc] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#174ea6]">Quy trình khép kín</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Vận hành trơn tru từ điểm danh đến bảng lương
            </h2>
            <p className="mt-4 text-base text-[#4b5563]">
              Không còn tình trạng nhập liệu thủ công rời rạc hay đối soát bảng công đau đầu mỗi cuối tháng.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((s, idx) => (
              <div
                key={idx}
                className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-blue-100">{s.step}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#174ea6]">
                    {s.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-xs leading-5 text-gray-600">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEGAL COMPLIANCE SECTION ── */}
      <section id="compliance" className="border-b border-[#e5e7eb] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} />
              <span>Tiêu chuẩn Tuân thủ Pháp lý</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Được bảo chứng bởi Luật Lao động & Thuế Việt Nam
            </h2>
            <p className="mt-4 text-base text-[#4b5563]">
              Hệ thống được thiết kế dựa trên các căn cứ pháp lý hiện hành, giúp doanh nghiệp tự tin khi thanh tra lao động.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            {legalCompliance.map((col, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-200 bg-[#f9fafb] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{col.title}</h3>
                </div>
                <ul className="mt-6 space-y-3.5 text-sm text-gray-600">
                  {col.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-2.5">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section id="faq" className="border-b border-[#e5e7eb] bg-[#f8fafc] py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#174ea6]">Giải đáp thắc mắc</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Câu hỏi thường gặp
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-5 text-left text-base font-semibold text-gray-900"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform duration-200 text-gray-400 ${
                      activeFaq === i ? 'rotate-180 text-[#174ea6]' : ''
                    }`}
                  />
                </button>
                {activeFaq === i && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-3 text-sm leading-6 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA BANNER ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f3460] via-[#174ea6] to-[#1e5bb8] px-6 py-12 text-center text-white shadow-xl sm:px-12 sm:py-16">
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Sẵn sàng nâng tầm quản trị nhân sự cho doanh nghiệp của bạn?
              </h2>
              <p className="mt-4 text-sm leading-6 text-blue-100 sm:text-base">
                Truy cập ngay để trải nghiệm nền tảng quản trị nhân sự, chấm công và tính lương chuẩn xác hàng đầu.
              </p>
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={handleCta}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-[#174ea6] shadow-md transition hover:bg-blue-50 hover:shadow-lg active:translate-y-px"
                >
                  <span>{isLoggedIn ? 'Vào Bảng điều khiển ngay' : 'Đăng nhập vào hệ thống ngay'}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-200 bg-white py-10 text-xs text-gray-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <CoreStaffLogo compact />
            <span>© {new Date().getFullYear()} CoreStaff. Nền tảng Quản trị Nhân sự & Tiền lương.</span>
          </div>
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => scrollTo('features')} className="hover:text-gray-900">
              Tính năng
            </button>
            <button type="button" onClick={() => scrollTo('compliance')} className="hover:text-gray-900">
              Pháp lý
            </button>
            <button type="button" onClick={handleCta} className="font-semibold text-[#174ea6] hover:underline">
              Đăng nhập
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
