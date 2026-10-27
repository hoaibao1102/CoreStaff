# Plan: Export CSV payroll — status gate + company-wide data

## Context

Export CSV bảng lương hiện chưa kiểm tra trạng thái `PayrollRun`. Người dùng muốn:

1. Chỉ cho phép xuất CSV khi `PayrollRun.status` là `LOCKED` hoặc `RELEASED`.
2. Nếu chưa locked, frontend vẫn hiển thị nút Export, backend trả lỗi, frontend hiển thị thông báo lỗi.
3. CSV xuất ra phải là bảng lương toàn công ty với đầy đủ thông tin chi tiết nhân viên.

## Data source decision

- **Nguồn chính: `Payslip` collection.**
  - `PayrollRun` chỉ lưu tổng (`totalGross`, `totalNet`, ...), không có chi tiết từng nhân viên.
  - `Payslip` đã lưu đầy đủ thông tin lương từng người: `employeeCode`, `employeeName`, `grossEarnings`, các loại bảo hiểm, `pitAmount`, `netSalary`, `earningBreakdown`, `allowanceBreakdown`, `deductionBreakdown`, `pitBreakdown`, `dependents`, ...
  - Để có "đầy đủ thông tin chi tiết của nhân viên toàn bộ hệ thống", cần join `EmployeeProfile` để lấy thêm `departmentName`, `positionName`, `departmentId`, `positionId`, `email`, `phone`, ... nếu cần.
- **PayrollRun chỉ dùng để:** kiểm tra trạng thái cho phép export và lấy metadata (periodLabel, runDate).

## Approach

### 1. Backend — `Apps/api/src/hr/payroll/payroll-export.service.ts`

- Inject `PayrollRun` model.
- Trước khi export, kiểm tra `PayrollRun.status`. Chỉ cho phép nếu là `LOCKED` hoặc `RELEASED`.
- Nếu không hợp lệ, throw `BadRequestException('PAYROLL_RUN_NOT_EXPORTABLE')`.
- Query `Payslip` theo `payrollRunId`.
- Join/populate `EmployeeProfile` để lấy department/position nếu cần.
- Build CSV với đầy đủ các cột: mã NV, họ tên, phòng ban, chức danh, lương gross, taxable earnings, base lương đóng bảo hiểm, BHXH, BHYT, BHTN, giảm trừ bản thân, giảm trừ phụ thuộc, PIT, khấu trừ khác, net, trạng thái payslip, kỳ công, ngày tạo, ...
- Giữ logic manual CSV string hiện tại, không thêm dependency.

### 2. Backend — `Apps/api/src/hr/payroll/payroll-export.controller.ts`

- Không cần thay đổi route. Exception filter sẽ trả `{ success: false, error: { code, message } }`.

### 3. Frontend — `Apps/web/src/screens/hr/PayrollRunScreen.tsx`

- Giữ nút Export CSV hiển thị (không ẩn theo status).
- Trong `handleExportCSV`:
  - Gọi API như cũ.
  - Kiểm tra `response.ok` / mã lỗi.
  - Nếu backend trả lỗi `PAYROLL_RUN_NOT_EXPORTABLE`, hiển thị toast lỗi bằng `hrErrorMessage` hoặc `mapHrError`.

### 4. Frontend — `Apps/web/src/services/hrService.ts`

- Thêm mã lỗi mới vào `HR_ERROR_CODES`:
  `PAYROLL_RUN_NOT_EXPORTABLE: 'Chỉ có thể xuất CSV khi bảng lương ở trạng thái Đã khóa hoặc Đã phát hành.'`

## Files to modify

- `CoreStaff/Apps/api/src/hr/payroll/payroll-export.service.ts`
- `CoreStaff/Apps/web/src/screens/hr/PayrollRunScreen.tsx`
- `CoreStaff/Apps/web/src/services/hrService.ts`

## Optional / future

- Nếu cần xuất .xlsx thay vì .csv, phải thêm thư vi library (exceljs / xlsx). CSV đủ yêu cầu hiện tại.
- Nếu cần thêm cột tổng công ty (summary) trong cùng file, có thể append summary rows ở cuối CSV hoặc sử dụng endpoint `export/summary/csv` hiện có.

## Verification

1. Unit test backend: export thành công với `LOCKED`/`RELEASED`; thất bại với `DRAFT`/`CALCULATED`/`STALE`.
2. Manual test frontend:
   - Payroll `CALCULATED` → click Export → hiện thông báo lỗi "Chỉ có thể xuất CSV khi...".
   - Payroll `LOCKED`/`RELEASED` → click Export → tải file CSV đúng.
