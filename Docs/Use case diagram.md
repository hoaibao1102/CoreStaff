# CoreStaff — Use Case Diagram v4

> **Baseline:** SRS v4.0 — HRM & Payroll. Các sơ đồ đã được cập nhật sang định dạng vector SVG chuẩn kiến trúc v4.0.

![CoreStaff Use Case Overview](CoreStaff_Use_Case_Overview.svg)

### Danh sách các bản vẽ chi tiết theo vai trò (Vector SVG v4.0):
- [🗺️ Sơ đồ Use Case Tổng hợp toàn hệ thống (CoreStaff_Use_Case_Overview.svg)](CoreStaff_Use_Case_Overview.svg)
- [🛡️ Sơ đồ Ca sử dụng System Admin (Use_Case_Admin.svg)](Use_Case_Admin.svg)
- [📋 Sơ đồ Ca sử dụng HR & Payroll Officer (Use_Case_HR.svg)](Use_Case_HR.svg)
- [👔 Sơ đồ Ca sử dụng Department Manager (Use_Case_Manager.svg)](Use_Case_Manager.svg)
- [👤 Sơ đồ Ca sử dụng Employee (Use_Case_Employee.svg)](Use_Case_Employee.svg)


```mermaid
flowchart LR
  SYS[System Admin]
  HR[HR / Payroll]
  MGR[Department Manager]
  EMP[Employee]

  subgraph TL[CoreStaff]
    AUTH([Authenticate & manage own profile])
    ORG([Manage Organizations / initial HR])
    PEOPLE([Manage Employees, Departments & Positions])
    CONTRACT([Manage Contracts & Employee Documents])
    POLICY([Manage Labor, OT, Insurance & Tax Policies])
    COMP([Manage Salary Profiles, Allowances, KPI])
    SCHEDULE([Manage Full-time Office Schedule])
    ATT([Check-in / Check-out Network, GPS, Selfie])
    LEAVE([Request / Approve / Apply Leave])
    OT([Request / Approve / Calculate OT])
    APPROVAL([Approve Attendance & Adjustment])
    TIMESHEET([Review & Close Timesheet])
    SNAPSHOT([Generate Payroll Input Snapshot])
    PAYROLL([Calculate / Review / Approve / Lock Payroll])
    PAYSLIP([Release / View own Payslip])
    AUDIT([View authorized Audit Logs])
  end

  SYS --- AUTH
  SYS --- ORG
  SYS --- AUDIT

  HR --- AUTH
  HR --- PEOPLE
  HR --- CONTRACT
  HR --- POLICY
  HR --- COMP
  HR --- SCHEDULE
  HR --- LEAVE
  HR --- TIMESHEET
  HR --- SNAPSHOT
  HR --- PAYROLL
  HR --- AUDIT

  MGR --- AUTH
  MGR --- ATT
  MGR --- LEAVE
  MGR --- OT
  MGR --- APPROVAL
  MGR --- TIMESHEET
  MGR --- PAYSLIP

  EMP --- AUTH
  EMP --- ATT
  EMP --- LEAVE
  EMP --- OT
  EMP --- PAYSLIP

  TIMESHEET -.->|include| SNAPSHOT
  SNAPSHOT -.->|include| PAYROLL
  PAYROLL -.->|include| PAYSLIP
  OT -.->|include| POLICY
  PAYROLL -.->|include| POLICY
```

## System Admin
- Đăng nhập; quản lý Organization và HR đầu tiên.
- Theo dõi trạng thái nền tảng/audit.
- Không thực hiện nghiệp vụ chấm công, payroll và không xem lương tenant mặc định.

## HR / Payroll
- Quản lý EmployeeProfile, Department, Position, EmploymentContract, EmployeeDocument.
- Quản lý Full-time schedule/Calendar; apply LeaveRequest đã được Manager duyệt.
- Quản lý SalaryProfile, Allowance, attendance bonus, KPI input.
- Quản lý version của Labor/OT/Insurance/Tax Policy.
- Chốt/mở kỳ công; tạo/regenerate PayrollInputSnapshot.
- Tính, review, approve, lock, mark-paid Payroll; xuất báo cáo và phát hành Payslip.

## Department Manager
- Thực hiện chức năng Employee cho dữ liệu cá nhân.
- Xem nhân viên/phê duyệt attendance, LeaveRequest, OT và adjustment đúng department scope; không tự duyệt.
- Xác nhận bảng công phòng ban.
- Không tự duyệt request và không xem lương cả phòng mặc định.

## Employee
- Xem/cập nhật hồ sơ được phép.
- Chấm công Network/GPS/Selfie; xem lịch sử và bảng công.
- Gửi LeaveRequest, OT, adjustment và clarification.
- Xem Payslip của chính mình sau release.

## Scope exclusions
- Part-time, ShiftRegistration, ShiftSwap.
- Ca đêm/qua ngày, nhiều ca/ngày và OT đêm.
- Tuyển dụng, performance review, onboarding/offboarding đầy đủ.
- Chuyển khoản ngân hàng và quyết toán PIT năm.
