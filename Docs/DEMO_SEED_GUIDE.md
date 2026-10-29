# CoreStaff Demo Seeding & Rehearsal Guide

Hướng dẫn sử dụng dữ liệu mẫu (demo tenant) phục vụ thuyết trình, kiểm thử nghiệm thu (UAT) và diễn tập hệ thống CoreStaff.

---

## 1. Thông tin Tổ chức Demo

- **Tên công ty**: Công ty Cổ phần Công nghệ An Phát
- **Mã tổ chức (code)**: `ANPHAT`
- **Mật khẩu dùng chung cho tất cả tài khoản**: `Demo123456!` (hoặc biến môi trường `DEMO_SEED_PASSWORD`)
- **Chính sách mật khẩu**: `mustChangePassword = false` (đăng nhập trực tiếp, không bắt buộc đổi mật khẩu lần đầu).

---

## 2. Danh sách Tài khoản Đăng nhập

| Email | Họ và tên | Mã NV | Vai trò | Phòng ban | Mục đích Demo |
|---|---|---|---|---|---|
| `hr@anphat.local` | Lê Thị Mai HR | `HR-001` | `HR` | — | Quản trị HR, chốt bảng công, duyệt snapshot, phát hành phiếu lương, duyệt phiếu giải trình/nghỉ phép |
| `quan.ly.kinh-doanh@anphat.local` | Trần Văn Quản Lý KD | `QL-KD-001` | `DEPARTMENT_MANAGER` | Kinh doanh (KD) | Duyệt bảng công phòng KD, duyệt đơn xin nghỉ, duyệt giải trình chấm công |
| `quan.ly.ky.thuat@anphat.local` | Nguyễn Văn Quản Lý KT | `QL-KT-001` | `DEPARTMENT_MANAGER` | Kỹ thuật (KT) | Duyệt bảng công phòng KT, có 2 ngày làm thêm (OT) cuối tuần 200% |
| `nv.kinh-doanh.1@anphat.local` | Phạm Hoàng Nam | `NV-KD-001` | `EMPLOYEE` | Kinh doanh (KD) | Nhân viên tiêu chuẩn, chấm công đúng giờ, đủ công |
| `nv.kinh-doanh.2@anphat.local` | Vũ Thị Mai | `NV-KD-002` | `EMPLOYEE` | Kinh doanh (KD) | Đi muộn (Sep 10) & về sớm (Sep 24) có ghi nhận chênh lệch phút |
| `nv.kinh-doanh.3@anphat.local` | Đặng Văn Khoa | `NV-KD-003` | `EMPLOYEE` | Kinh doanh (KD) | **Chặn chốt công**: Quên chấm công vào (Sep 15), đang có đơn giải trình `PENDING` |
| `nv.ky.thuat.1@anphat.local` | Lê Quốc Bảo | `NV-KT-001` | `EMPLOYEE` | Kỹ thuật (KT) | Đã được duyệt nghỉ phép năm 1 ngày (Sep 21) |
| `nv.ky.thuat.2@anphat.local` | Hoàng Minh Tuấn | `NV-KT-002` | `EMPLOYEE` | Kỹ thuật (KT) | Có đơn xin nghỉ phép ngày Sep 25 trạng thái `PENDING` (chờ demo duyệt) |
| `nv.ky.thuat.3@anphat.local` | Bùi Phương Thảo | `NV-KT-003` | `EMPLOYEE` | Kỹ thuật (KT) | **Chặn chốt công**: Quên chấm công ra (Sep 18), thiếu dữ liệu |

---

## 3. Dữ liệu 3 Kỳ Công

1. **Kỳ Lịch sử (`2026-08`)**:
   - Trạng thái kỳ: `CLOSED`.
   - Bảng tổng hợp công (`TimesheetSummary`): Đầy đủ 8 nhân viên.
   - Snapshot chốt lương (`PayrollInputSnapshot`): Đầy đủ 8 nhân viên.
   - Bảng lương (`PayrollRun`): Trạng thái `RELEASED`.
   - Phiếu lương (`Payslip`): 8 phiếu lương tính toán từ engine thật (BHXH 8%, BHYT 1.5%, BHTN 1%, Thuế TNCN biểu lũy tiến).

2. **Kỳ Demo Live (`2026-09`)**:
   - Trạng thái kỳ: `OPEN`.
   - Có đầy đủ các biến thể dữ liệu:
     - Chấm công hợp lệ (Wi-Fi, GPS, selfie).
     - 2 điểm nghẽn chấm công (NV-KD-003 thiếu check-in, NV-KT-003 thiếu check-out) để trình diễn cảnh báo khi HR chốt bảng công.
     - 1 đơn giải trình đang chờ Quản lý/HR duyệt.
     - 1 đơn xin nghỉ phép đang chờ duyệt.
     - Làm thêm giờ cuối tuần (QL-KT-001 làm ngày thứ Bảy, hệ số 2.0).

3. **Kỳ Hiện tại (`2026-10`)**:
   - Trạng thái kỳ: `OPEN`.
   - Dữ liệu chấm công từ ngày 01/10/2026 đến ngày hiện tại (29/10/2026).
   - Ngày 29/10/2026 đã có chấm công vào buổi sáng.
   - Không có dữ liệu trong tương lai.

---

## 4. Các Lệnh Thực thi (CLI Scripts)

Chạy từ thư mục gốc hoặc thư mục `CoreStaff/Apps/api`:

```bash
# 1. Reset và gieo mới toàn bộ dữ liệu demo (ANPHAT)
npm --prefix CoreStaff/Apps/api run seed:demo:reset

# 2. Kiểm tra xác thực tính toàn vẹn dữ liệu demo
npm --prefix CoreStaff/Apps/api run verify:demo

# 3. Dry-run (chạy thử nghiệm tính toán, không ghi DB)
npm --prefix CoreStaff/Apps/api run seed:demo:dry

# 4. Diễn tập chốt kỳ tháng 9 (đóng kỳ để kiểm tra luồng chốt)
npm --prefix CoreStaff/Apps/api run seed:demo:rehearsal
```

*Lưu ý an toàn: Lệnh reset (`seed:demo:reset`) chỉ xóa dữ liệu có `organizationId` của `ANPHAT`, tuyệt đối không xóa collections hay ảnh hưởng đến các tổ chức/tenant khác trên MongoDB.*

---

## 5. File Mẫu Import Nhân viên Excel

Các file test phục vụ kiểm thử tính năng Import Nhân viên từ Excel được lưu tại:
`CoreStaff/Apps/api/demo-import/`

1. `01_nhan_vien_hop_le.xlsx`: Dữ liệu nhân viên mẫu hợp lệ, đầy đủ các cột bắt buộc.
2. `02_loi_thieu_cot_bat_buoc.xlsx`: Dữ liệu thiếu cột Họ tên / Email để kiểm tra validate.
3. `03_loi_trung_ma_nhan_vien.xlsx`: Trùng mã nhân viên đã tồn tại.
4. `04_loi_email_khong_hop_le.xlsx`: Định dạng email sai chuẩn.
