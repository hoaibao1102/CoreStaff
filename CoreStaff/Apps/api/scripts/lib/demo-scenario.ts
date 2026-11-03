/**
 * Kịch bản dữ liệu demo An Phát (ANPHAT) — chỉ là DỮ KIỆN đầu vào.
 *
 * Mọi con số (phút trễ/sớm, phút làm, OT hợp lệ, công quy đổi, lương) KHÔNG
 * khai ở đây: `seed-demo-org.ts` tính chúng bằng đúng calculator/service của
 * hệ thống. File này chỉ mô tả "ai bấm giờ lúc nào, bằng gì, nộp đơn gì, ai
 * duyệt lúc nào", giống nhật ký vận hành thật.
 *
 * Kỳ công:
 *   - 2026-09: kỳ lịch sử — đã chốt, đã chạy và phát hành lương.
 *   - 2026-10: kỳ demo — còn blocker, chưa xác nhận, chưa chốt.
 *   - 2026-11: kỳ hiện tại — chỉ dữ liệu tới ngày tham chiếu, chưa rà soát.
 */
import { ContractType, Gender, LeaveDurationType, LeaveType, Role } from '../../src/database/schemas/enums';

export const HISTORY_PERIOD = '2026-09';
export const ACTIVE_PERIOD = '2026-10';
export const CURRENT_PERIOD = '2026-11';

export const ORG_NAME = 'Công ty Cổ phần Công nghệ An Phát';

export type DeptCode = 'KD' | 'KT';
export type EmployeeCode = 'QL-KD-001' | 'QL-KT-001' | 'NV-KD-001' | 'NV-KD-002' | 'NV-KD-003' | 'NV-KT-001' | 'NV-KT-002' | 'NV-KT-003';
export type AccountCode = 'HR-001' | EmployeeCode;

export interface DemoDependent { fullName: string; dateOfBirth: string; relationship: string; idCardNumber?: string }

export interface DemoAccount {
  code: AccountCode;
  email: string;
  fullName: string;
  role: Role;
  phone: string;
  gender: Gender;
  dateOfBirth: string;
  dept?: DeptCode;
  position?: string;
  joinDate: string;
  contracts?: Array<{ type: ContractType; effectiveDate: string; expiryDate?: string; note?: string }>;
  /** Lương theo hợp đồng chính thức (lương thử việc khai riêng ở `probation`). */
  baseSalary: number;
  probation?: { until: string; agreedSalary: number };
  allowances: Array<'MEAL' | 'RESP' | 'PHONE'>;
  dependents?: DemoDependent[];
  address: string;
  taxCode?: string;
  socialInsuranceCode?: string;
  bankAccount?: string;
}

export const ACCOUNTS: DemoAccount[] = [
  {
    code: 'HR-001', email: 'hr@anphat.local', fullName: 'Lê Thị Thu Hà', role: Role.HR,
    phone: '0901000000', gender: Gender.FEMALE, dateOfBirth: '1990-04-12', joinDate: '2023-03-01',
    baseSalary: 28_000_000, allowances: [], address: 'Phường 7, Quận 3, TP. Hồ Chí Minh',
  },
  {
    code: 'QL-KD-001', email: 'quan.ly.kinh-doanh@anphat.local', fullName: 'Trần Quốc Hưng', role: Role.DEPARTMENT_MANAGER,
    phone: '0901000001', gender: Gender.MALE, dateOfBirth: '1986-09-20', dept: 'KD', position: 'TP-KD', joinDate: '2023-05-02',
    contracts: [{ type: ContractType.INDEFINITE_TERM, effectiveDate: '2024-05-02', note: 'Hợp đồng không xác định thời hạn' }],
    baseSalary: 32_000_000, allowances: ['MEAL', 'RESP', 'PHONE'],
    dependents: [
      { fullName: 'Trần Gia Bảo', dateOfBirth: '2015-06-03', relationship: 'CON', idCardNumber: '079215004521' },
      { fullName: 'Trần Minh Anh', dateOfBirth: '2019-11-21', relationship: 'CON' },
    ],
    address: 'Phường Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh', taxCode: '8312456790', socialInsuranceCode: '7912345601', bankAccount: 'VCB 0071000456123',
  },
  {
    code: 'QL-KT-001', email: 'quan.ly.ky.thuat@anphat.local', fullName: 'Nguyễn Thành Long', role: Role.DEPARTMENT_MANAGER,
    phone: '0901000002', gender: Gender.MALE, dateOfBirth: '1988-02-14', dept: 'KT', position: 'TP-KT', joinDate: '2023-04-03',
    contracts: [{ type: ContractType.INDEFINITE_TERM, effectiveDate: '2024-04-03', note: 'Hợp đồng không xác định thời hạn' }],
    baseSalary: 35_000_000, allowances: ['MEAL', 'RESP'],
    dependents: [{ fullName: 'Nguyễn Khánh An', dateOfBirth: '2017-08-09', relationship: 'CON' }],
    address: 'Phường 15, Quận Tân Bình, TP. Hồ Chí Minh', taxCode: '8312456791', socialInsuranceCode: '7912345602', bankAccount: 'TCB 19033344455501',
  },
  {
    code: 'NV-KD-001', email: 'nv.kinh-doanh.1@anphat.local', fullName: 'Phạm Hoàng Nam', role: Role.EMPLOYEE,
    phone: '0901000011', gender: Gender.MALE, dateOfBirth: '1996-07-30', dept: 'KD', position: 'NV-KD', joinDate: '2024-08-01',
    contracts: [{ type: ContractType.FIXED_TERM, effectiveDate: '2025-08-01', expiryDate: '2027-07-31', note: 'Hợp đồng xác định thời hạn 24 tháng' }],
    baseSalary: 18_000_000, allowances: ['MEAL', 'PHONE'],
    address: 'Phường 12, Quận Gò Vấp, TP. Hồ Chí Minh', taxCode: '8312456792', socialInsuranceCode: '7912345603', bankAccount: 'ACB 21456789',
  },
  {
    code: 'NV-KD-002', email: 'nv.kinh-doanh.2@anphat.local', fullName: 'Vũ Thị Mai', role: Role.EMPLOYEE,
    phone: '0901000012', gender: Gender.FEMALE, dateOfBirth: '1994-03-08', dept: 'KD', position: 'NV-KD', joinDate: '2024-03-04',
    contracts: [{ type: ContractType.FIXED_TERM, effectiveDate: '2025-03-04', expiryDate: '2027-03-03', note: 'Hợp đồng xác định thời hạn 24 tháng' }],
    baseSalary: 16_000_000, allowances: ['MEAL', 'PHONE'],
    dependents: [{ fullName: 'Lê Vũ Bảo Ngọc', dateOfBirth: '2021-01-17', relationship: 'CON' }],
    address: 'Phường Tân Phong, Quận 7, TP. Hồ Chí Minh', taxCode: '8312456793', socialInsuranceCode: '7912345604', bankAccount: 'VCB 0071000789456',
  },
  {
    code: 'NV-KD-003', email: 'nv.kinh-doanh.3@anphat.local', fullName: 'Đặng Văn Khoa', role: Role.EMPLOYEE,
    phone: '0901000013', gender: Gender.MALE, dateOfBirth: '2001-12-05', dept: 'KD', position: 'NV-KD', joinDate: '2026-09-01',
    contracts: [
      { type: ContractType.PROBATION, effectiveDate: '2026-09-01', expiryDate: '2026-10-31', note: 'Thử việc 2 tháng, lương 85%' },
      { type: ContractType.FIXED_TERM, effectiveDate: '2026-11-01', expiryDate: '2027-10-31', note: 'Ký chính thức sau thử việc' },
    ],
    baseSalary: 17_000_000, probation: { until: '2026-10-31', agreedSalary: 14_450_000 }, allowances: ['MEAL', 'PHONE'],
    address: 'Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh', taxCode: '8312456794', bankAccount: 'MB 0901000013',
  },
  {
    code: 'NV-KT-001', email: 'nv.ky.thuat.1@anphat.local', fullName: 'Lê Quốc Bảo', role: Role.EMPLOYEE,
    phone: '0901000021', gender: Gender.MALE, dateOfBirth: '1993-10-02', dept: 'KT', position: 'NV-KT', joinDate: '2023-10-02',
    contracts: [{ type: ContractType.INDEFINITE_TERM, effectiveDate: '2025-10-02', note: 'Hợp đồng không xác định thời hạn' }],
    baseSalary: 24_000_000, allowances: ['MEAL'],
    dependents: [{ fullName: 'Lê Văn Thành', dateOfBirth: '1958-05-19', relationship: 'CHA_ME', idCardNumber: '079058001234' }],
    address: 'Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh', taxCode: '8312456795', socialInsuranceCode: '7912345605', bankAccount: 'TCB 19035566778801',
  },
  {
    code: 'NV-KT-002', email: 'nv.ky.thuat.2@anphat.local', fullName: 'Hoàng Minh Tuấn', role: Role.EMPLOYEE,
    phone: '0901000022', gender: Gender.MALE, dateOfBirth: '1997-01-25', dept: 'KT', position: 'NV-KT', joinDate: '2024-06-03',
    contracts: [{ type: ContractType.FIXED_TERM, effectiveDate: '2025-06-03', expiryDate: '2027-06-02', note: 'Hợp đồng xác định thời hạn 24 tháng' }],
    baseSalary: 22_000_000, allowances: ['MEAL'],
    address: 'Phường Hiệp Phú, TP. Thủ Đức, TP. Hồ Chí Minh', taxCode: '8312456796', socialInsuranceCode: '7912345606', bankAccount: 'BIDV 31410000998877',
  },
  {
    code: 'NV-KT-003', email: 'nv.ky.thuat.3@anphat.local', fullName: 'Bùi Phương Thảo', role: Role.EMPLOYEE,
    phone: '0901000023', gender: Gender.FEMALE, dateOfBirth: '1998-06-16', dept: 'KT', position: 'NV-KT', joinDate: '2025-06-02',
    contracts: [{ type: ContractType.FIXED_TERM, effectiveDate: '2025-08-02', expiryDate: '2026-12-31', note: 'Hợp đồng xác định thời hạn' }],
    baseSalary: 20_000_000, allowances: ['MEAL'],
    address: 'Phường 4, Quận 8, TP. Hồ Chí Minh', taxCode: '8312456797', socialInsuranceCode: '7912345607', bankAccount: 'VPB 168899001',
  },
];

export const MANAGER_OF: Record<DeptCode, EmployeeCode> = { KD: 'QL-KD-001', KT: 'QL-KT-001' };

// ─── Nơi làm việc ───────────────────────────────────────────────────────────
export const OFFICE = {
  name: 'Trụ sở chính An Phát',
  address: 'Tầng 5, Tòa nhà An Phát, 39 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  latitude: Number(process.env.DEMO_OFFICE_LAT ?? 10.7797),
  longitude: Number(process.env.DEMO_OFFICE_LNG ?? 106.699),
  allowedRadiusMeters: Number(process.env.DEMO_OFFICE_RADIUS ?? 150),
  maximumAccuracyMeters: 50,
  wifi: [
    { label: 'Tầng 5 - Khu làm việc', ssid: 'AnPhat_Office', bssid: 'a4:2b:b0:5e:11:20' },
    { label: 'Tầng 5 - Phòng họp', ssid: 'AnPhat_Office', bssid: 'a4:2b:b0:5e:11:24' },
    // Wi-Fi thật của phòng demo: DEMO_WIFI_BSSID=aa:bb:cc:dd:ee:ff [DEMO_WIFI_SSID=...]
    ...(process.env.DEMO_WIFI_BSSID ? [{ label: 'Phòng demo', ssid: process.env.DEMO_WIFI_SSID ?? 'Demo_WiFi', bssid: process.env.DEMO_WIFI_BSSID.toLowerCase() }] : []),
  ],
  publicIp: '113.161.73.42',
};

export type SiteKey = 'SAIGON_XANH' | 'MINH_PHAT_BD' | 'DONG_A_BT';
export const SITES: Record<SiteKey, { address: string; latitude: number; longitude: number }> = {
  SAIGON_XANH: { address: 'Công ty TNHH Thực phẩm Sài Gòn Xanh, 1058 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh', latitude: 10.729633, longitude: 106.718742 },
  MINH_PHAT_BD: { address: 'Kho hàng Minh Phát, KCN VSIP 1, Thuận An, Bình Dương', latitude: 10.921605, longitude: 106.710628 },
  DONG_A_BT: { address: 'Văn phòng Công ty Đông Á, 235 Điện Biên Phủ, Quận Bình Thạnh, TP. Hồ Chí Minh', latitude: 10.800913, longitude: 106.713417 },
};

// ─── Lịch nghỉ lễ ───────────────────────────────────────────────────────────
export const HOLIDAYS = [
  { date: '2026-09-01', name: 'Nghỉ lễ Quốc khánh 2/9 (ngày liền kề)' },
  { date: '2026-09-02', name: 'Lễ Quốc khánh 2/9' },
  // Ngày lễ công ty rơi đúng thứ Bảy: vẫn là PUBLIC_HOLIDAY (OT 300%), không
  // phải WEEKLY_OFF (200%) — đúng thứ tự ưu tiên lịch của hệ thống.
  { date: '2026-10-31', name: 'Nghỉ lễ kỷ niệm thành lập Công ty An Phát (rơi vào thứ Bảy)' },
];

// ─── Thói quen bấm giờ (ngày bình thường) ───────────────────────────────────
/** [sớm nhất, muộn nhất] theo giây trong ngày; xác suất Wi-Fi (còn lại GPS). */
interface Habit { inFrom: string; inTo: string; outFrom: string; outTo: string; wifi: number }
const HABITS: Record<EmployeeCode, Habit> = {
  'QL-KD-001': { inFrom: '07:41', inTo: '08:06', outFrom: '17:12', outTo: '18:20', wifi: 0.7 },
  'QL-KT-001': { inFrom: '07:46', inTo: '08:09', outFrom: '17:18', outTo: '18:35', wifi: 0.92 },
  'NV-KD-001': { inFrom: '07:36', inTo: '07:58', outFrom: '17:02', outTo: '17:36', wifi: 0.62 },
  'NV-KD-002': { inFrom: '07:50', inTo: '08:13', outFrom: '17:01', outTo: '17:22', wifi: 0.7 },
  'NV-KD-003': { inFrom: '07:47', inTo: '08:11', outFrom: '17:02', outTo: '17:28', wifi: 0.58 },
  'NV-KT-001': { inFrom: '07:51', inTo: '08:12', outFrom: '17:14', outTo: '18:12', wifi: 0.95 },
  'NV-KT-002': { inFrom: '07:42', inTo: '08:07', outFrom: '17:06', outTo: '17:52', wifi: 0.9 },
  'NV-KT-003': { inFrom: '07:44', inTo: '08:10', outFrom: '17:03', outTo: '17:31', wifi: 0.86 },
};

export function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const toSeconds = (hhmm: string) => { const [h, m, s] = hhmm.split(':').map(Number); return h * 3600 + m * 60 + (s ?? 0); };
const toClock = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
  .map(v => String(v).padStart(2, '0')).join(':');

export type PunchMethod = 'WIFI' | 'GPS' | 'SELFIE';
export interface PunchSpec { time: string; method?: PunchMethod; site?: SiteKey; note?: string }
export interface DayPlan {
  in: PunchSpec | null;
  out: PunchSpec | null;
  workMode: 'IN_OFFICE' | 'OUT_OFFICE';
  story?: string;
}

export function naturalDay(code: EmployeeCode, date: string): DayPlan {
  const habit = HABITS[code];
  const pick = (from: string, to: string, salt: string) =>
    toClock(Math.floor(toSeconds(from) + hash01(`${code}|${date}|${salt}`) * (toSeconds(to) - toSeconds(from))));
  const method = (salt: string): PunchMethod => (hash01(`${code}|${date}|${salt}`) < habit.wifi ? 'WIFI' : 'GPS');
  return {
    in: { time: pick(habit.inFrom, habit.inTo, 'in'), method: method('in-method') },
    out: { time: pick(habit.outFrom, habit.outTo, 'out'), method: method('out-method') },
    workMode: 'IN_OFFICE',
  };
}

type Override = Partial<DayPlan> & { story: string };
const day = (inTime: string | null, outTime: string | null, extra: Partial<Override> & { story: string }): Override => ({
  in: inTime === null ? null : { time: inTime, method: 'WIFI' },
  out: outTime === null ? null : { time: outTime, method: 'WIFI' },
  ...extra,
});

/**
 * Ngày có diễn biến riêng (`ngày|mã NV`). Ngày nghỉ phép cả ngày không cần
 * khai ở đây: không có bản ghi chấm công là đúng nghiệp vụ.
 */
export const DAY_OVERRIDES: Record<string, Override> = {
  // ── Tháng 9 ────────────────────────────────────────────────────────────────
  '2026-09-02|NV-KT-001': day('07:56:10', '17:08:40', { story: 'Trực vận hành hệ thống ngày Quốc khánh (OT ngày lễ 300%)' }),
  '2026-09-02|NV-KT-002': day('08:03:10', '12:06:40', { story: 'Trực hỗ trợ buổi sáng ngày Quốc khánh, CHƯA khai OT (giờ làm ngoài lịch không ai đặt)' }),
  '2026-09-02|NV-KT-003': day('07:58:30', '17:12:10', { story: 'Trực vận hành hệ thống ngày Quốc khánh (OT ngày lễ 300%)' }),
  '2026-09-04|NV-KD-001': { in: null, out: null, workMode: 'IN_OFFICE', story: 'Quên chấm công cả ngày (điện thoại hết pin) → giải trình, QL duyệt' },
  '2026-09-08|NV-KD-002': day('08:26:40', '17:05:12', { story: 'Đi muộn (kẹt xe)' }),
  '2026-09-08|NV-KT-003': day('07:52:12', '19:02:40', { story: 'Hỗ trợ khách hàng ngoài giờ (OT 150%)' }),
  '2026-09-09|NV-KT-003': day('07:58:20', null, { story: 'Quên chấm công ra → giải trình, QL duyệt' }),
  '2026-09-10|NV-KT-002': day('07:49:05', '19:42:15', { story: 'Làm thêm giờ ngày thường hỗ trợ khách hàng (OT 150%)' }),
  '2026-09-11|NV-KD-002': day('07:51:30', '12:03:10', { story: 'Nghỉ phép buổi chiều, làm buổi sáng' }),
  '2026-09-14|QL-KD-001': day('08:34:10', '17:46:30', { story: 'Đi muộn (họp khách hàng sớm, kẹt xe)' }),
  '2026-09-15|NV-KD-001': {
    in: { time: '08:02:40', method: 'SELFIE', site: 'SAIGON_XANH', note: 'Gặp khách hàng Sài Gòn Xanh demo sản phẩm' },
    out: { time: '17:12:05', method: 'SELFIE', site: 'SAIGON_XANH', note: 'Kết thúc làm việc tại khách hàng' },
    workMode: 'OUT_OFFICE', story: 'Công tác tại khách hàng — chấm công selfie, QL duyệt',
  },
  '2026-09-16|NV-KD-002': day('08:41:02', '17:10:44', { story: 'Đi muộn' }),
  '2026-09-16|NV-KT-002': day('07:54:40', null, { story: 'Vào làm rồi về giữa giờ, không đơn, không giải trình → QL xử lý vắng không phép' }),
  '2026-09-17|NV-KD-001': day('07:47:30', '12:02:15', { story: 'Nghỉ phép buổi chiều, làm buổi sáng' }),
  '2026-09-18|NV-KD-003': day('08:07:33', null, { story: 'Vào làm rồi tự ý rời văn phòng, không đơn, không giải trình → vắng không phép' }),
  '2026-09-22|NV-KD-002': day('07:58:15', '16:30:00', { story: 'Về sớm 30 phút' }),
  '2026-09-22|NV-KT-002': day('07:49:20', '19:12:35', { story: 'Ứng trực sự cố đồng bộ dữ liệu cho khách hàng (OT 150%)' }),
  '2026-09-20|NV-KD-001': day('07:58:40', '11:02:40', { story: 'Chủ nhật đi cùng khách hàng khai trương showroom (OT cuối tuần 200%)' }),
  '2026-09-23|NV-KT-002': {
    in: { time: '07:57:30', method: 'SELFIE', note: 'Điện thoại không bắt được Wi-Fi văn phòng, chụp selfie tại quầy lễ tân' },
    out: { time: '17:09:20', method: 'WIFI' },
    workMode: 'IN_OFFICE', story: 'Selfie dự phòng tại văn phòng (Wi-Fi lỗi) → QL duyệt',
  },
  '2026-09-24|NV-KD-001': day('07:44:51', '19:05:30', { story: 'Làm thêm chuẩn bị hồ sơ thầu (OT 150%)' }),
  '2026-09-25|NV-KT-003': day('07:52:40', '16:02:00', { story: 'Về sớm 58 phút việc cá nhân (không xin phép)' }),
  '2026-09-26|NV-KT-001': day('07:55:12', '17:06:30', { story: 'Thứ Bảy triển khai ERP cho khách hàng (OT cuối tuần 200%)' }),
  '2026-09-26|NV-KT-003': day('07:58:44', '17:11:02', { story: 'Thứ Bảy triển khai ERP cho khách hàng (OT cuối tuần 200%)' }),
  '2026-09-29|QL-KT-001': day('08:22:30', '17:52:10', { story: 'Đi muộn' }),
  '2026-09-30|NV-KD-003': day('08:18:05', '17:12:40', { story: 'Đi muộn' }),
  '2026-09-30|NV-KD-002': day('07:53:24', '19:20:15', { story: 'Chốt số liệu báo cáo quý (OT 150%)' }),

  // ── Tháng 10 ───────────────────────────────────────────────────────────────
  '2026-10-05|NV-KD-002': day('08:23:18', '17:06:02', { story: 'Đi muộn' }),
  '2026-10-06|NV-KT-003': day('07:59:10', null, { story: 'Quên chấm công ra → giải trình, QL duyệt' }),
  '2026-10-07|QL-KD-001': day('08:28:40', '18:02:15', { story: 'Đi muộn' }),
  '2026-10-08|NV-KD-001': {
    in: { time: '08:05:20', method: 'SELFIE', site: 'MINH_PHAT_BD', note: 'Khảo sát kho khách hàng Minh Phát (Bình Dương)' },
    out: { time: '17:25:48', method: 'SELFIE', site: 'MINH_PHAT_BD', note: 'Hoàn tất khảo sát kho' },
    workMode: 'OUT_OFFICE', story: 'Công tác Bình Dương — selfie, QL duyệt',
  },
  '2026-10-12|NV-KD-002': day('13:02:40', '17:06:20', { story: 'Nghỉ phép buổi sáng, làm ca chiều' }),
  '2026-10-13|NV-KT-002': day('07:55:10', null, { story: 'Vào làm rồi về giữa giờ, không đơn, không giải trình → QL xử lý vắng không phép' }),
  '2026-10-14|NV-KT-001': day('07:58:02', '20:38:40', { story: 'Release v2.3 ngoài giờ (OT 150%)' }),
  '2026-10-15|NV-KD-002': {
    in: { time: '08:10:05', method: 'SELFIE', site: 'DONG_A_BT', note: 'Gặp khách hàng Đông Á ký phụ lục hợp đồng' },
    out: { time: '17:18:30', method: 'SELFIE', site: 'DONG_A_BT', note: 'Kết thúc làm việc tại khách hàng' },
    workMode: 'OUT_OFFICE', story: 'DEMO: selfie công tác chưa duyệt → giữ lại cho QL KD duyệt tay. ẢNH MINH HỌA: seed chỉ ghi metadata, chưa upload ảnh lên storage.',
  },
  '2026-10-15|NV-KD-003': day('07:52:10', '12:03:40', { story: 'Nghỉ không lương buổi chiều, làm buổi sáng' }),
  '2026-10-16|NV-KT-003': day('08:31:50', '17:20:05', { story: 'Đi muộn' }),
  '2026-10-16|NV-KT-001': day('07:55:40', '12:04:10', { story: 'Nghỉ phép buổi chiều, làm buổi sáng' }),
  '2026-10-19|NV-KT-001': { in: null, out: null, workMode: 'IN_OFFICE', story: 'Quên điện thoại ở nhà, không chấm công cả ngày → giải trình CHỜ duyệt (script bổ sung xử lý)' },
  '2026-10-20|NV-KT-002': day('07:54:12', null, { story: 'Quên chấm công ra → giải trình CHỜ duyệt (script bổ sung xử lý)' }),
  '2026-10-21|NV-KD-003': day('07:57:40', null, { story: 'DEMO: quên chấm ra, đã gửi giải trình CHỜ QL KD duyệt' }),
  '2026-10-21|NV-KD-002': day('07:52:35', '19:18:40', { story: 'Rà soát hợp đồng khung với đối tác (OT 150%)' }),
  '2026-10-22|NV-KT-002': day('07:47:33', '19:36:20', { story: 'Fix lỗi khẩn module thanh toán (OT 150%)' }),
  '2026-10-23|NV-KD-002': day('13:40:00', '16:30:00', { story: 'Nghỉ phép buổi sáng + vào ca chiều muộn 25 phút + về sớm 30 phút → 0,5 công' }),
  '2026-10-24|NV-KT-001': day('07:54:30', '17:08:10', { story: 'Thứ Bảy chuyển hệ thống sang data center mới (OT 200%)' }),
  '2026-10-24|NV-KT-003': day('07:57:05', '17:05:42', { story: 'Thứ Bảy chuyển hệ thống sang data center mới (OT 200%)' }),
  '2026-10-26|QL-KT-001': day('07:52:18', '16:45:00', { story: 'Về sớm 15 phút' }),
  '2026-10-27|NV-KD-001': day('07:48:10', '12:01:30', { story: 'Nghỉ phép buổi chiều, làm buổi sáng' }),
  '2026-10-27|NV-KD-003': day('07:56:05', null, { story: 'Quên chấm công ra → giải trình, QL duyệt' }),
  '2026-10-28|NV-KT-003': day('08:03:25', null, { story: 'DEMO: vào làm rồi về giữa giờ, không đơn, không giải trình → xử lý vắng không phép' }),
  '2026-10-29|NV-KD-001': day('07:46:05', '19:11:35', { story: 'Hoàn thiện báo giá dự án (OT 150%)' }),
  '2026-10-29|NV-KT-001': day('13:03:40', '17:08:15', { story: 'Nghỉ phép buổi sáng, làm ca chiều' }),
  '2026-10-30|NV-KD-001': day('07:50:12', null, { story: 'Quên chấm công ra, CHƯA giải trình (script bổ sung xử lý)' }),
  '2026-10-30|NV-KD-002': day('07:56:40', '18:42:05', { story: 'Ở lại làm báo cáo tháng — OT đã gửi, CHƯA duyệt' }),
  // Thứ Bảy nhưng là ngày lễ công ty: OT 300%, không phải 200%.
  // KT-003 đã khai + duyệt; KT-002 đi trực nhưng KHÔNG khai OT → demo tạo đơn
  // OT ngày lễ ngay trên app, rồi QL KD/KT duyệt tại chỗ.
  '2026-10-31|NV-KT-002': day('07:56:10', '17:09:40', { story: 'Trực hỗ trợ ngày lễ thành lập công ty — CHƯA khai OT (demo tạo đơn)' }),
  '2026-10-31|NV-KT-003': day('08:01:25', '17:12:05', { story: 'Trực vận hành ngày lễ thành lập công ty (OT lễ 300%)' }),

  // ── Tháng 11 (kỳ hiện tại — chỉ để demo OT, kỳ chưa rà soát) ───────────────
  '2026-11-01|NV-KT-001': day('07:58:20', '17:06:45', { story: 'Chủ nhật trực bảo trì máy chủ (OT cuối tuần 200%)' }),
  '2026-11-01|NV-KD-001': day('07:52:10', '12:06:40', { story: 'Chủ nhật dựng gian hàng hội chợ cho khách hàng — CHƯA khai OT (demo tạo đơn OT cuối tuần trên app)' }),
  '2026-11-01|NV-KT-002': day('08:02:15', '17:10:30', { story: 'Chủ nhật trực bảo trì máy chủ (OT cuối tuần 200%) — khai OT, CHƯA duyệt' }),
  '2026-11-01|NV-KD-002': day('08:05:40', '17:03:20', { story: 'Chủ nhật làm thêm sự kiện khách hàng (OT cuối tuần 200%)' }),
};

export function planFor(code: EmployeeCode, date: string, isWorkday: boolean): DayPlan | null {
  const override = DAY_OVERRIDES[`${date}|${code}`];
  if (override) {
    const natural = naturalDay(code, date);
    return {
      in: override.in === undefined ? natural.in : override.in,
      out: override.out === undefined ? natural.out : override.out,
      workMode: override.workMode ?? 'IN_OFFICE',
      story: override.story,
    };
  }
  return isWorkday ? naturalDay(code, date) : null;
}

// ─── Quy trình nghiệp vụ (đơn từ) ───────────────────────────────────────────
type At = [date: string, time: string];

export interface LeaveSpec {
  code: EmployeeCode; startDate: string; endDate: string; leaveType: LeaveType; durationType: LeaveDurationType;
  reason: string; submitAt: At; approveAt?: At; approveComment?: string; applyAt?: At;
}

export const LEAVES: LeaveSpec[] = [
  { code: 'NV-KD-002', startDate: '2026-09-11', endDate: '2026-09-11', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Đưa con đi tiêm phòng theo lịch của phường', submitAt: ['2026-09-08', '10:15'], approveAt: ['2026-09-08', '14:02'], approveComment: 'Đồng ý, bàn giao khách hàng cho Nam', applyAt: ['2026-09-09', '09:05'] },
  { code: 'NV-KD-003', startDate: '2026-09-17', endDate: '2026-09-17', leaveType: LeaveType.UNPAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Về quê làm thủ tục giấy tờ cá nhân (đang thử việc, chưa có phép năm)', submitAt: ['2026-09-14', '16:40'], approveAt: ['2026-09-14', '17:30'], approveComment: 'Duyệt nghỉ không lương', applyAt: ['2026-09-15', '08:50'] },
  { code: 'NV-KT-001', startDate: '2026-09-21', endDate: '2026-09-21', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm giải quyết việc gia đình', submitAt: ['2026-09-15', '09:30'], approveAt: ['2026-09-15', '11:05'], approveComment: 'Đồng ý', applyAt: ['2026-09-16', '08:45'] },
  { code: 'NV-KT-002', startDate: '2026-09-28', endDate: '2026-09-29', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm về quê dự đám cưới em gái', submitAt: ['2026-09-21', '08:55'], approveAt: ['2026-09-21', '10:20'], approveComment: 'Đồng ý, nhớ bàn giao ticket cho Bảo', applyAt: ['2026-09-22', '09:10'] },
  { code: 'NV-KD-001', startDate: '2026-09-17', endDate: '2026-09-17', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Đưa mẹ đi khám bệnh buổi chiều', submitAt: ['2026-09-14', '09:20'], approveAt: ['2026-09-14', '11:40'], approveComment: 'Đồng ý', applyAt: ['2026-09-15', '08:30'] },
  { code: 'NV-KT-002', startDate: '2026-09-18', endDate: '2026-09-18', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm lo thủ tục nhà đất', submitAt: ['2026-09-14', '14:05'], approveAt: ['2026-09-14', '16:20'], approveComment: 'Đồng ý', applyAt: ['2026-09-15', '10:15'] },
  { code: 'NV-KT-003', startDate: '2026-09-24', endDate: '2026-09-24', leaveType: LeaveType.UNPAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Việc gia đình gấp, tạm nghỉ không lương một ngày', submitAt: ['2026-09-21', '15:40'], approveAt: ['2026-09-22', '08:20'], approveComment: 'Duyệt nghỉ không lương', applyAt: ['2026-09-22', '09:30'] },

  { code: 'NV-KT-001', startDate: '2026-10-09', endDate: '2026-10-09', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm đưa bố đi tái khám', submitAt: ['2026-10-05', '09:40'], approveAt: ['2026-10-05', '13:30'], approveComment: 'Đồng ý', applyAt: ['2026-10-06', '08:40'] },
  { code: 'NV-KD-003', startDate: '2026-10-12', endDate: '2026-10-13', leaveType: LeaveType.UNPAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Về quê lo việc gia đình (thử việc, xin nghỉ không lương)', submitAt: ['2026-10-07', '15:20'], approveAt: ['2026-10-08', '08:35'], approveComment: 'Duyệt nghỉ không lương 2 ngày', applyAt: ['2026-10-08', '10:00'] },
  { code: 'NV-KD-002', startDate: '2026-10-12', endDate: '2026-10-12', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.MORNING_HALF,
    reason: 'Đưa con đi khám bệnh buổi sáng', submitAt: ['2026-10-08', '10:10'], approveAt: ['2026-10-08', '14:05'], approveComment: 'Đồng ý, chiều vào bù khách hàng', applyAt: ['2026-10-09', '08:40'] },
  { code: 'NV-KT-003', startDate: '2026-10-15', endDate: '2026-10-15', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm dự lễ tốt nghiệp của em trai', submitAt: ['2026-10-09', '09:15'], approveAt: ['2026-10-09', '11:35'], approveComment: 'Đồng ý', applyAt: ['2026-10-12', '08:45'] },
  { code: 'NV-KD-003', startDate: '2026-10-15', endDate: '2026-10-15', leaveType: LeaveType.UNPAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Đi khám sức khỏe định kỳ buổi chiều (thử việc, trừ vào lương)', submitAt: ['2026-10-12', '16:20'], approveAt: ['2026-10-13', '08:30'], approveComment: 'Duyệt nghỉ không lương buổi chiều', applyAt: ['2026-10-13', '10:10'] },
  { code: 'NV-KT-001', startDate: '2026-10-16', endDate: '2026-10-16', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Nghỉ phép buổi chiều đưa bố đi khám định kỳ', submitAt: ['2026-10-12', '09:30'], approveAt: ['2026-10-12', '13:50'], approveComment: 'Đồng ý', applyAt: ['2026-10-13', '08:35'] },
  { code: 'NV-KD-001', startDate: '2026-10-20', endDate: '2026-10-20', leaveType: LeaveType.UNPAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Giải quyết việc riêng, xin nghỉ không lương một ngày', submitAt: ['2026-10-15', '14:10'], approveAt: ['2026-10-15', '16:45'], approveComment: 'Duyệt nghỉ không lương', applyAt: ['2026-10-16', '08:35'] },
  { code: 'NV-KD-002', startDate: '2026-10-23', endDate: '2026-10-23', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.MORNING_HALF,
    reason: 'Khám sức khỏe định kỳ tại bệnh viện buổi sáng', submitAt: ['2026-10-19', '10:00'], approveAt: ['2026-10-19', '15:10'], approveComment: 'Đồng ý', applyAt: ['2026-10-20', '09:00'] },
  { code: 'NV-KD-001', startDate: '2026-10-27', endDate: '2026-10-27', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Nghỉ buổi chiều làm thủ tục vay mua nhà tại ngân hàng', submitAt: ['2026-10-22', '11:25'], approveAt: ['2026-10-22', '14:00'], approveComment: 'Đồng ý', applyAt: ['2026-10-23', '08:30'] },
  { code: 'NV-KT-001', startDate: '2026-10-29', endDate: '2026-10-29', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.MORNING_HALF,
    reason: 'Đưa con đi tiêm chủng buổi sáng', submitAt: ['2026-10-23', '09:05'], approveAt: ['2026-10-23', '11:20'], approveComment: 'Đồng ý', applyAt: ['2026-10-26', '08:40'] },
];

/** Đơn tháng 11 (tạo theo ngày tham chiếu): 1 đơn đã duyệt, 1 đơn chờ QL duyệt để demo. */
export const CURRENT_MONTH_LEAVES: Array<Omit<LeaveSpec, 'submitAt' | 'approveAt' | 'applyAt'> & { approved: boolean }> = [
  { code: 'NV-KD-002', startDate: '2026-11-20', endDate: '2026-11-20', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.AFTERNOON_HALF,
    reason: 'Dự lễ kỷ niệm ngày Nhà giáo tại trường của con', approveComment: 'Đồng ý', approved: true },
  { code: 'NV-KT-002', startDate: '2026-11-13', endDate: '2026-11-13', leaveType: LeaveType.PAID_LEAVE, durationType: LeaveDurationType.FULL_DAY,
    reason: 'Nghỉ phép năm đi khám răng và giải quyết việc cá nhân', approved: false },
];

export interface OtSpec {
  code: EmployeeCode; date: string; windows: Array<[string, string]>; reason: string; workDescription: string;
  fileAt: At; approveAt?: At; approveComment?: string;
}

export const OVERTIMES: OtSpec[] = [
  { code: 'NV-KT-001', date: '2026-09-02', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Trực vận hành hệ thống dịp nghỉ lễ Quốc khánh theo phân công',
    workDescription: 'Giám sát hệ thống, xử lý cảnh báo, sao lưu dữ liệu định kỳ', fileAt: ['2026-09-02', '17:20'], approveAt: ['2026-09-03', '08:40'], approveComment: 'Xác nhận lịch trực lễ' },
  // Cùng ngày lễ 02/09: NV-KT-003 có đơn OT được duyệt; NV-KT-002 cũng đi trực
  // nhưng KHÔNG khai OT → ngày lễ vừa có vừa không có yêu cầu, đúng dữ liệu thật.
  { code: 'NV-KT-003', date: '2026-09-02', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Trực vận hành hệ thống dịp nghỉ lễ Quốc khánh theo phân công',
    workDescription: 'Trực ca cùng anh Bảo, theo dõi cảnh báo hạ tầng và sao lưu', fileAt: ['2026-09-02', '17:24'], approveAt: ['2026-09-03', '08:46'], approveComment: 'Xác nhận lịch trực lễ' },
  { code: 'NV-KT-003', date: '2026-09-08', windows: [['17:30', '19:00']], reason: 'Hỗ trợ khách hàng kiểm thử bản cập nhật ngoài giờ',
    workDescription: 'Chạy kiểm thử nghiệm thu, ghi nhận lỗi cho đội phát triển', fileAt: ['2026-09-08', '19:10'], approveAt: ['2026-09-09', '08:35'], approveComment: 'Đồng ý' },
  { code: 'NV-KT-002', date: '2026-09-10', windows: [['17:30', '19:30']], reason: 'Hỗ trợ khách hàng ABC xử lý sự cố đồng bộ dữ liệu',
    workDescription: 'Khôi phục job đồng bộ, đối soát dữ liệu đơn hàng', fileAt: ['2026-09-10', '19:50'], approveAt: ['2026-09-11', '08:52'], approveComment: 'Đồng ý' },
  { code: 'NV-KT-002', date: '2026-09-22', windows: [['17:30', '19:00']], reason: 'Ứng trực sự cố đồng bộ dữ liệu kho khách hàng',
    workDescription: 'Chạy lại job, kiểm tra đối soát tồn kho, xác nhận với khách hàng', fileAt: ['2026-09-22', '19:20'], approveAt: ['2026-09-23', '08:40'], approveComment: 'Đồng ý' },
  { code: 'NV-KD-001', date: '2026-09-20', windows: [['08:00', '11:00']], reason: 'Chủ nhật hỗ trợ khách hàng khai trương showroom',
    workDescription: 'Trưng bày sản phẩm, hướng dẫn khách tham quan gian hàng', fileAt: ['2026-09-20', '11:15'], approveAt: ['2026-09-21', '08:30'], approveComment: 'Đã phân công' },
  { code: 'NV-KD-001', date: '2026-09-24', windows: [['17:30', '19:00']], reason: 'Chuẩn bị hồ sơ dự thầu gói thiết bị cho khách hàng Minh Phát',
    workDescription: 'Hoàn thiện bảng giá, catalogue và hồ sơ năng lực', fileAt: ['2026-09-24', '19:10'], approveAt: ['2026-09-25', '08:46'], approveComment: 'Đồng ý' },
  { code: 'NV-KT-001', date: '2026-09-26', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Triển khai nâng cấp ERP cho khách hàng ngoài giờ hành chính',
    workDescription: 'Cài đặt bản nâng cấp, chuyển dữ liệu và kiểm thử', fileAt: ['2026-09-26', '17:20'], approveAt: ['2026-09-28', '08:30'], approveComment: 'Đã phân công' },
  { code: 'NV-KT-003', date: '2026-09-26', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Triển khai nâng cấp ERP cho khách hàng ngoài giờ hành chính',
    workDescription: 'Kiểm thử nghiệp vụ, hướng dẫn người dùng khách hàng', fileAt: ['2026-09-26', '17:25'], approveAt: ['2026-09-28', '08:32'], approveComment: 'Đã phân công' },
  { code: 'NV-KD-002', date: '2026-09-30', windows: [['17:30', '19:00']], reason: 'Chốt số liệu báo cáo quý III gửi ban giám đốc',
    workDescription: 'Đối soát doanh số quý, lập báo cáo tổng hợp', fileAt: ['2026-09-30', '19:30'], approveAt: ['2026-10-01', '08:35'], approveComment: 'Đồng ý' },

  { code: 'NV-KT-001', date: '2026-10-14', windows: [['17:30', '20:30']], reason: 'Triển khai bản phát hành v2.3 lên môi trường production',
    workDescription: 'Deploy, chạy migration, theo dõi hệ thống sau phát hành', fileAt: ['2026-10-14', '20:45'], approveAt: ['2026-10-15', '08:40'], approveComment: 'Đồng ý' },
  { code: 'NV-KD-002', date: '2026-10-21', windows: [['17:30', '19:00']], reason: 'Rà soát hợp đồng khung với đối tác chiến lược',
    workDescription: 'Đối chiếu điều khoản, lập bảng tóm tắt gửi trưởng phòng', fileAt: ['2026-10-21', '19:25'], approveAt: ['2026-10-22', '08:40'], approveComment: 'Đồng ý' },
  { code: 'NV-KT-002', date: '2026-10-22', windows: [['17:30', '19:30']], reason: 'Sửa lỗi khẩn cấp module thanh toán cho khách hàng',
    workDescription: 'Hotfix lỗi trùng giao dịch, kiểm thử hồi quy', fileAt: ['2026-10-22', '19:40'], approveAt: ['2026-10-23', '08:31'], approveComment: 'Đồng ý' },
  { code: 'NV-KT-001', date: '2026-10-24', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Di chuyển hệ thống sang data center mới',
    workDescription: 'Chuyển máy chủ, cấu hình mạng, kiểm tra dịch vụ', fileAt: ['2026-10-24', '17:15'], approveAt: ['2026-10-26', '08:35'], approveComment: 'Đã phân công' },
  { code: 'NV-KT-003', date: '2026-10-24', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Di chuyển hệ thống sang data center mới',
    workDescription: 'Kiểm thử dịch vụ sau di chuyển, cập nhật tài liệu vận hành', fileAt: ['2026-10-24', '17:18'], approveAt: ['2026-10-26', '08:37'], approveComment: 'Đã phân công' },
  { code: 'NV-KD-001', date: '2026-10-29', windows: [['17:30', '19:00']], reason: 'Hoàn thiện báo giá cho khách hàng dự án Phú Mỹ Hưng',
    workDescription: 'Lập báo giá, đối chiếu chiết khấu với phòng kế toán', fileAt: ['2026-10-29', '19:15'], approveAt: ['2026-10-30', '08:45'], approveComment: 'Đồng ý' },
  // Đã gửi nhưng QL chưa duyệt → chưa được tính lương cho tới khi duyệt.
  { code: 'NV-KD-002', date: '2026-10-30', windows: [['17:30', '18:30']], reason: 'Tổng hợp báo cáo doanh số tháng 10 gửi ban giám đốc',
    workDescription: 'Đối soát doanh số, lập báo cáo tháng', fileAt: ['2026-10-30', '18:50'] },
  // Ngày lễ công ty rơi vào thứ Bảy: OT 300% (lễ thắng cuối tuần), vẫn có
  // trường hợp đã duyệt (KT-003) và trường hợp đi làm KHÔNG khai OT (KT-002)
  // để buổi demo thao tác tạo đơn OT ngày lễ ngay trên app.
  { code: 'NV-KT-003', date: '2026-10-31', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Trực vận hành ngày lễ kỷ niệm thành lập công ty',
    workDescription: 'Giám sát dịch vụ, xử lý cảnh báo, sao lưu dữ liệu', fileAt: ['2026-10-31', '17:20'], approveAt: ['2026-10-31', '18:10'], approveComment: 'Xác nhận lịch trực lễ' },

  // Tháng 11 — OT gần ngày demo, kỳ hiện tại chưa rà soát (chỉ để xem màn hình OT).
  { code: 'NV-KT-001', date: '2026-11-01', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Trực bảo trì máy chủ định kỳ ngày Chủ nhật',
    workDescription: 'Cập nhật bản vá bảo mật, kiểm tra sao lưu, khởi động lại dịch vụ', fileAt: ['2026-11-01', '17:25'], approveAt: ['2026-11-01', '18:40'], approveComment: 'Xác nhận lịch trực bảo trì' },
  { code: 'NV-KD-002', date: '2026-11-01', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Chủ nhật tổ chức sự kiện tri ân khách hàng',
    workDescription: 'Đón tiếp khách, trưng bày sản phẩm, tổng kết sự kiện', fileAt: ['2026-11-01', '17:20'], approveAt: ['2026-11-01', '18:55'], approveComment: 'Đã phân công' },
  { code: 'NV-KT-002', date: '2026-11-01', windows: [['08:00', '12:00'], ['13:00', '17:00']], reason: 'Chủ nhật trực bảo trì máy chủ cùng anh Bảo',
    workDescription: 'Kiểm tra sao lưu, cập nhật bản vá bảo mật', fileAt: ['2026-11-01', '18:30'] },
];

export interface ConfirmationSpec { code: EmployeeCode; date: string; reason: string; fileAt: At; approveAt?: At }

/** Giải trình chấm công (luồng ATTENDANCE_CONFIRMATION của hệ thống V2). */
export const CONFIRMATIONS: ConfirmationSpec[] = [
  { code: 'NV-KD-001', date: '2026-09-04', reason: 'Điện thoại hết pin cả ngày 04/09 nên không chấm công được; vẫn làm việc tại văn phòng và dự họp giao ban sáng với anh Hưng',
    fileAt: ['2026-09-07', '08:35'], approveAt: ['2026-09-07', '09:12'] },
  { code: 'NV-KT-003', date: '2026-09-09', reason: 'Quên bấm ra ca do vội đi đón con, thực tế rời văn phòng lúc 17h05',
    fileAt: ['2026-09-10', '08:20'], approveAt: ['2026-09-10', '09:05'] },
  { code: 'NV-KT-003', date: '2026-10-06', reason: 'Mạng điện thoại mất kết nối lúc 17h nên chưa bấm ra ca được, rời văn phòng lúc 17h10',
    fileAt: ['2026-10-07', '08:15'], approveAt: ['2026-10-07', '08:52'] },
  // Còn chờ duyệt — script bổ sung (demo:resolve) duyệt hộ QL.
  { code: 'NV-KT-001', date: '2026-10-19', reason: 'Quên điện thoại ở nhà nên không chấm công ngày 19/10; vẫn làm việc cả ngày tại văn phòng, có anh Long xác nhận',
    fileAt: ['2026-10-20', '08:30'] },
  { code: 'NV-KT-002', date: '2026-10-20', reason: 'Quên bấm ra ca, rời văn phòng lúc 17h15 sau khi họp xong với đội dự án',
    fileAt: ['2026-10-21', '08:42'], approveAt: ['2026-10-21', '14:10'] },
  // DEMO: QL Kinh doanh duyệt trực tiếp trong buổi bảo vệ.
  { code: 'NV-KD-003', date: '2026-10-21', reason: 'Quên chấm công ra do đi gặp khách hàng ở Thủ Đức rồi về thẳng nhà lúc 17h30, đã báo anh Hưng qua Zalo',
    fileAt: ['2026-10-22', '09:03'] },
  // Đã duyệt trong seed — để tài khoản KD-003 có nhiều hơn một ngày vắng/giải
  // trình trong tháng, không đụng tới 2 vướng cố ý giữ cho demo tay.
  { code: 'NV-KD-003', date: '2026-10-27', reason: 'Quên bấm ra ca, thực tế rời văn phòng lúc 17h20 sau khi dọn hồ sơ khách hàng',
    fileAt: ['2026-10-28', '08:20'], approveAt: ['2026-10-28', '09:05'] },
];

export interface SelfieApprovalSpec { code: EmployeeCode; date: string; at: At; comment?: string }
export const SELFIE_APPROVALS: SelfieApprovalSpec[] = [
  { code: 'NV-KD-001', date: '2026-09-15', at: ['2026-09-15', '17:40'] },
  { code: 'NV-KT-002', date: '2026-09-23', at: ['2026-09-23', '09:20'] },
  { code: 'NV-KD-001', date: '2026-10-08', at: ['2026-10-08', '17:52'] },
  // 2026-10-15 NV-KD-002: cố ý để PENDING.
];

export interface ForfeitSpec { code: EmployeeCode; date: string; at: At; reason: string }
export const FORFEITS: ForfeitSpec[] = [
  { code: 'NV-KD-003', date: '2026-09-18', at: ['2026-09-21', '10:05'],
    reason: 'Rời văn phòng từ 10h không báo cáo, không có đơn xin nghỉ và không giải trình — tính vắng không phép theo nội quy' },
  { code: 'NV-KT-002', date: '2026-09-16', at: ['2026-09-18', '09:20'],
    reason: 'Rời văn phòng từ giữa giờ không báo cáo, không có đơn xin nghỉ và không giải trình — tính vắng không phép theo nội quy' },
  { code: 'NV-KT-002', date: '2026-10-13', at: ['2026-10-14', '08:40'],
    reason: 'Rời văn phòng từ giữa giờ không báo cáo, không có đơn xin nghỉ và không giải trình — tính vắng không phép theo nội quy' },
  // Tháng 10: QL Kỹ thuật xử lý ngay trong lúc seed, để kỳ 10 chỉ còn vướng ở phòng KD.
  { code: 'NV-KT-003', date: '2026-10-28', at: ['2026-10-30', '09:15'],
    reason: 'Rời văn phòng từ giữa giờ không báo cáo, không có đơn xin nghỉ và không giải trình — tính vắng không phép theo nội quy' },
];

/**
 * Vướng mắc để lại cho người trình bày tự xử lý trên Web/Mobile.
 * Cố ý chỉ chọn tài khoản phòng KD: một quản lý, một phòng ban, không phải đổi tài khoản giữa các phòng.
 */
export const DEMO_KEEP: EmployeeCode[] = ['NV-KD-002', 'NV-KD-003'];

/** Tài khoản tự bấm "Xác nhận bảng công" trên app — cùng 2 mã KD ở trên. */
export const DEMO_SKIP_ACK: EmployeeCode[] = ['NV-KD-002', 'NV-KD-003'];

// ─── KPI ────────────────────────────────────────────────────────────────────
/** Bậc KPI — dùng chung cho `KpiPolicy` (seed qua CompensationService) và `kpiFor`. */
export const KPI_TIERS = [
  { min: 90, name: 'Xuất sắc', percentage: 100 },
  { min: 80, name: 'Tốt', percentage: 75 },
  { min: 70, name: 'Đạt', percentage: 50 },
  { min: 0, name: 'Chưa đạt', percentage: 0 },
];
/** Mức KPI cơ sở của công ty (scope ALL) — một chính sách chung cho mọi phòng ban. */
export const KPI_BASE_AMOUNT = 2_000_000;
export const KPI_SCORES: Record<string, Partial<Record<EmployeeCode, number>>> = {
  [HISTORY_PERIOD]: { 'QL-KD-001': 92, 'QL-KT-001': 88, 'NV-KD-001': 95, 'NV-KD-002': 78, 'NV-KD-003': 72, 'NV-KT-001': 91, 'NV-KT-002': 85, 'NV-KT-003': 81 },
  [ACTIVE_PERIOD]: { 'QL-KD-001': 86, 'QL-KT-001': 93, 'NV-KD-001': 89, 'NV-KD-002': 74, 'NV-KD-003': 68, 'NV-KT-001': 96, 'NV-KT-002': 90, 'NV-KT-003': 79 },
};
/** Bậc KPI đúng hình dạng `KpiPolicy.tiers` (khoảng điểm liền kề, không chồng lấn). */
export function kpiPolicyTiers() {
  return KPI_TIERS.map((tier, index) => ({
    name: tier.name, percentage: tier.percentage, minScore: tier.min,
    maxScore: index === 0 ? 100 : KPI_TIERS[index - 1].min - 1, order: index + 1,
  }));
}

export function kpiFor(score: number) {
  const tier = KPI_TIERS.find(row => score >= row.min)!;
  return { score, tierName: tier.name, tierPercentage: tier.percentage, baseAmount: KPI_BASE_AMOUNT, amount: Math.round(KPI_BASE_AMOUNT * tier.percentage / 100) };
}
