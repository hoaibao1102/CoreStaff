# CoreStaff — Scope Decision Log

> Ghi nhận các quyết định resolve mâu thuẫn thuộc QC_REVIEW_CORESTAFF_DOCS.md. SRS v4.0 là source of truth.
> Ngày chốt: 12/09/2026. Mỗi dòng: Decision / Date / ảnh hưởng docs.

| ID | Decision | Giá trị chốt | Tác động |
|---|---|---|---|
| D01 (QC-001) | OT pay | **Payroll tính tiền OT** theo OvertimePayPolicy; Attendance/Timesheet chỉ lưu phút (requested/approved/actual/eligible) | FR-OT-03, 30D.2 |
| D02 (QC-002) | Payroll bên trong/ngoài | **Tính lương nội bộ** qua PayrollRun/Payslip | Proposal §5.3 |
| D03 (QC-003) | Must Have | Thêm Flow 4A (Payroll) + 4B (OT) + Adjustment (before close) vào Must Have | Proposal §1, §16 |
| D04 (QC-004) | Leave | **Cập nhật 12/09/2026:** Employee → Manager duyệt → HR apply. **NC-1 = A:** MVP **cấm** HR CRUD `EmployeeDayOverride` ngoài apply. Quota/accrual/balance = LATER | **Synced:** FR-HRCFG-05, FR-LEAVE-03, BR-LEAVE-03, API, UC-13, routes §14 |
| D05 (QC-005) | Expected outcomes | Bỏ "schedule registration/swap" | Proposal §15 |
| D06 (QC-006) | Adjustment | Before-close = MVP; After-close = qua reopen (giữ tách bạch) | Proposal Flow 5, SRS FR-ADJ |
| D07 (QC-007) | RecurringSchedule | **Chỉ HR CRUD**; Manager chỉ xem department scope | FR-SCH-02 |
| D08 (QC-008) | Reset mật khẩu | HR reset trong Organization mình; System Admin reset nền tảng/HR đầu tiên | FR-AUTH-04 |
| D09 (QC-009) | employmentType | Field thuộc `EmployeeProfile`, không nằm trên User | §15.2, 29A.2 |
| D10 (QC-010) | Tên entity | Duy nhất `LaborCompliancePolicy` (có probationMinimumRate) | 29A.3, 29B, 29F |
| D11 (QC-011) | Event REJECTED | Là blocker chốt kỳ; resolve qua resubmit/clarification hoặc HR quyết dayResult | FR-HR-02, BR, §7.2 |
| D12 (QC-012/028) | Payslip release / PAID | Payslip phát hành khi Payroll `LOCKED`; `PAID` = HR xác nhận chi trả thủ công (paidAt + note), không ngân hàng | 29E, AC-PAYROLL |
| D13 (QC-013/014) | Role naming | Enum: `SYSTEM_ADMIN`, `HR`, `DEPARTMENT_MANAGER`, `EMPLOYEE`; display: System Admin / HR (Payroll Officer) / Department Manager / Employee | Proposal §5, glossary |
| D14 (QC-018) | Use Case numbering | Đánh lại UC-11 (OT), UC-12 (tenant isolation) | SRS §13 |
| D15 (QC-041) | overallApprovalStatus | Ưu tiên: REJECTED > CLARIFICATION_REQUESTED > PENDING > APPROVED > NOT_REQUIRED | §7.2, AC |
| D16 (QC-042) | Export | CSV kỳ chốt = Must Have (thuộc Flow 4); custom report export = SHOULD | Proposal Flow 6 |
| D17 (QC-045) | GPS anomaly | MVP chỉ auto-approval cho SELFIE; GPS anomaly = SHOULD | Proposal Flow 3, FR-MGR-03 |
| D18 | Chuyên cần (Attendance bonus) | Hệ thống cung cấp **cách tính mẫu** (vd tier % 100/70/50, rule đi trễ…). **HR từng Organization tự setup** policy + tự thêm điều kiện tính; **không hard-code** rule công ty trong code | **Synced 12/09/2026:** FR-COMP-01, models/APIs/AC, TASK-034/088 |
| D19 | Phụ cấp (Allowance) | **Hybrid:** seed **library mặc định** (ăn trưa, xăng xe, điện thoại…) để HR chọn/bật; HR vẫn **tạo thêm mục phụ cấp riêng** trong Organization | **Synced 12/09/2026:** FR-COMP-02, models/APIs/AC, TASK-033/088 |

| D20 | Backend stack | **NestJS + PostgreSQL** cho MVP | **Resolved 12/09/2026:** OQ-01 / ADR Sprint 2 |
| D21 | Approval delegation | Ưu tiên `ApprovalDelegation` active; fallback HR queue chung; actorId != employeeId | **Resolved 12/09/2026:** model/routing rule |

Các QC Low (chính tả, format, slug) không ghi ở đây; sẽ xử lý trực tiếp trong file.

## Ghi chú bổ sung (12/09/2026)

### Leave (D04 cập nhật)
```text
Employee tạo LeaveRequest
→ Department Manager approve/reject (đúng department scope; không tự duyệt)
→ HR apply → tạo EmployeeDayOverride (PAID_LEAVE / UNPAID_LEAVE) gắn leaveRequestId
→ đưa vào TimesheetSummary / PayrollInputSnapshot khi chốt kỳ

MVP: không có đường HR ghi override thẳng ngoài LeaveRequest apply.
```

### Chuyên cần (D18)
- Platform/seed: template phương pháp tính (percent tiers, late/early counters…).
- HR: chọn template, nhập mức thưởng, thêm/bớt điều kiện theo công ty.
- Engine payroll chỉ đọc policy version có hiệu lực + dữ liệu snapshot công.

### Phụ cấp (D19) — khuyến nghị đã chốt hướng
- **Không chỉ library cứng** (thiếu linh hoạt multi-tenant).
- **Không chỉ HR tự gõ từ trắng** (lệch tên, khó báo cáo chuẩn).
- **Hybrid:** library seed + HR custom trong tenant.
