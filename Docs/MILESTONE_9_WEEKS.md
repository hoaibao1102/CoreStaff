# CoreStaff — Kế hoạch Milestone 9 tuần

> **Thời gian:** 07/09/2026–08/11/2026  
> **Quy ước tuần:** Thứ Hai–Chủ nhật  
> **Mục tiêu:** Hoàn thiện MVP HRM multi-tenant cho doanh nghiệp 10–50 nhân viên: hồ sơ/hợp đồng, chấm công, tuân thủ giờ làm, chốt công, Payroll và Payslip.  
> **Phạm vi đã cắt:** Part-time, đăng ký/đổi ca, ca đêm, tuyển dụng, performance, chuyển khoản lương và quyết toán PIT năm.  
> **Ghi chú:** Sprint 1 (tuần này) đã hoàn thành với SRS v4 + QC review + decision log + docs đồng bộ. Sprint 9 là tuần buffer cho UAT, demo và bảo vệ dự án.

## 1. Bảng milestone tổng thể

| Sprint/Milestone | Mục tiêu | Ngày bắt đầu | Ngày kết thúc | Deliverable cần bàn giao | Người phụ trách | Số task liên quan | Tỷ lệ hoàn thành | Trạng thái | Ghi chú |
|---|---|---:|---:|---|---|---:|---:|---|---|
| **Sprint 1 — HRM Scope & Architecture** | Chốt HRM/Payroll scope, policy pháp lý, ERD/API và UX | 07/09/2026 | 13/09/2026 | SRS v4; Proposal; wiki; context/use-case; decision log; backlog | Chưa phân công | 12 | 100% | 🟢 Hoàn thành | SRS v4 + QC review (48 findings) + DOCS_DECISION_LOG đã chốt. |
| **Sprint 2 — Foundation, Tenant & Employee Core** | Auth, tenant isolation, hồ sơ nhân viên, phòng ban/chức danh | 14/09/2026 | 20/09/2026 | Organization/User/Session; EmployeeProfile; Department/Position; RBAC; tenant tests | Chưa phân công | 14 | 0% | ⚪ Chưa bắt đầu | User login tách khỏi EmployeeProfile. |
| **Sprint 3 — Contract, Salary Profile & Policies** | Hợp đồng, tài liệu và cấu hình pháp lý/tài chính có hiệu lực | 21/09/2026 | 27/09/2026 | Contract/Document; SalaryProfile; Allowance hybrid; AttendanceBonusPolicy templates; Labor/OT/Insurance/Tax policies | Chưa phân công | 15 | 0% | ⚪ Chưa bắt đầu | 85%, tỷ lệ bảo hiểm, thuế và OT đều versioned. |
| **Sprint 4 — Full-time Scheduling, Leave & Attendance** | Lịch hành chính Full-time và chấm công Network/GPS | 28/09/2026 | 04/10/2026 | ShiftTemplate; RecurringSchedule; Calendar/Leave; Today API; Network/GPS; history; calculation | Chưa phân công | 14 | 0% | ⚪ Chưa bắt đầu | HR config ca; 08:00–17:00 chỉ là seed. |
| **Sprint 5 — Selfie, Approval, Adjustment & OT** | Evidence, approval và OT tự phân loại/kiểm soát giới hạn | 05/10/2026 | 11/10/2026 | Camera/Selfie; private evidence; approval/clarification; adjustment; OT request/result; labor compliance | Chưa phân công | 15 | 0% | ⚪ Chưa bắt đầu | Kiểm tra giờ ngày/tuần/tháng/năm theo policy. |
| **Sprint 6 — Timesheet Closing & Payroll Snapshot** | Chốt công và tạo đầu vào Payroll bất biến | 12/10/2026 | 18/10/2026 | TimesheetPeriod; blockers; confirmation; summary; close/reopen; PayrollInputSnapshot; stale/regenerate | Chưa phân công | 13 | 0% | ⚪ Chưa bắt đầu | Payroll không đọc live attendance. |
| **Sprint 7 — Payroll, Insurance, PIT & Payslip** | Tính Gross, khấu trừ, Net Salary và phát hành phiếu lương | 19/10/2026 | 25/10/2026 | PayrollRun workflow; earning/deduction lines; BHXH/BHYT/BHTN; PIT; employer cost; Payslip/export | Chưa phân công | 16 | 0% | ⚪ Chưa bắt đầu | Policy/profile theo effective date; kiểm tra phép tính độc lập. |
| **Sprint 8 — Hardening & Deployment** | Security, E2E, deploy production | 26/10/2026 | 01/11/2026 | Full tests; payroll reconciliation; IDOR report; responsive/accessibility; Docker/deploy; seed; README | Chưa phân công | 12 | 0% | ⚪ Chưa bắt đầu | Không nhận feature mới; chỉ bug fix + ổn định. |
| **Sprint 9 — UAT, Demo & Final Delivery** | Buffer: UAT, demo, bảo vệ và bàn giao | 02/11/2026 | 08/11/2026 | UAT HR→Payroll→Payslip; demo video; defense slides; final report; wiki sync; repo tag | Chưa phân công | 6 | 0% | ⚪ Chưa bắt đầu | Dự phòng cho trễ hạn các sprint trước. |

## 2. Task breakdown theo Sprint

### Sprint 1 — HRM Scope & Architecture (🟢 Hoàn thành)
1. Chốt tên CoreStaff và phạm vi bốn trụ nghiệp vụ.
2. Chốt Full-time office schedule và loại Part-time/shift swap.
3. Chốt EmployeeProfile/Position/Contract/Document.
4. Chốt probation policy và validation minimum rate.
5. Chốt labor compliance policy ngày/tuần/tháng/năm.
6. Chốt PayrollInputSnapshot và stale/regenerate behavior.
7. Chốt SalaryProfile, allowances, attendance bonus và KPI input.
8. Chốt InsuranceProfile/Policy và employee/employer contribution.
9. Chốt TaxProfile/Policy, dependents và PIT methods.
10. Chốt PayrollRun/Payslip workflow và quyền riêng tư lương.
11. Đồng bộ SRS/Proposal/context/use-case/wiki.
12. Chốt ERD, API contract, ADR và backlog.

**Exit criteria ĐẠT (sync delta 12/09/2026):** D04/D18/D19 đã đồng bộ SRS/Proposal/Use Case/Milestone/Backlog; stack/delegation đã chốt.

### Sprint 2 — Foundation, Tenant & Employee Core
1. Khởi tạo frontend/backend/database và CI.
2. Organization/User/UserSession migrations.
3. Login/logout/me/change/reset password.
4. Tenant-context middleware.
5. RBAC/resource scope.
6. Seed Organization A/B và HR.
7. EmployeeProfile model/API.
8. Department CRUD.
9. Position CRUD.
10. Employment status/history.
11. ManagerAssignment/EmployeeAssignment.
12. HR employee directory UI.
13. Employee self-profile UI.
14. Tenant IDOR integration tests.

### Sprint 3 — Contract, Salary Profile & Policies
1. EmploymentContract model/API/UI.
2. EmployeeDocument private upload/access.
3. Contract status/expiry warning.
4. Probation salary validation.
5. SalaryProfile effective dating.
6. Allowance hybrid: platform catalog + Organization custom.
7. AttendanceBonusPolicy: clone template 100/70/50 + custom tiers/conditions.
8. KPI payroll input.
9. LaborCompliancePolicy.
10. OvertimePayPolicy.
11. InsuranceProfile.
12. InsurancePolicy rate/base/caps.
13. TaxProfile và dependents.
14. TaxPolicy brackets/deductions/withholding.
15. Policy audit/version/effective-date tests.

### Sprint 4 — Full-time Scheduling, Leave & Attendance
1. ShiftTemplate HR-configurable.
2. RecurringSchedule Full-time.
3. Generate WorkSchedule.
4. OrganizationCalendar/holiday.
5. LeaveRequest: Employee submit → Manager approve/reject.
6. HR apply LeaveRequest → EmployeeDayOverride; phân loại ABSENT/INCOMPLETE.
7. Today state API/UI.
8. Network validation.
9. GPS/Haversine validation.
10. Check-in transaction/idempotency.
11. Check-out transaction.
12. Working/late/early calculation trừ break.
13. History/day detail/audit.
14. Schedule/attendance integration tests.

### Sprint 5 — Selfie, Approval, Adjustment & OT
1. Camera capture/preview/retake.
2. File MIME/signature/size validation.
3. Private Evidence storage.
4. Selfie attendance event.
5. ApprovalRequest tự động.
6. Manager queue/detail.
7. Approve/reject/clarification.
8. Self-approval protection.
9. Adjustment request/review/apply.
10. OvertimeRequest.
11. Manager approve window.
12. OT automatic classification.
13. Eligible OT interval calculation.
14. Labor limits daily/weekly/monthly/annual.
15. OT/compliance unit/integration tests.

### Sprint 6 — Timesheet Closing & Payroll Snapshot
1. TimesheetPeriod state machine.
2. Period version.
3. Blocker calculation/drill-down.
4. Department confirmation.
5. Invalidate confirmation after change.
6. TimesheetSummary working/leave/OT totals.
7. Close-period transaction.
8. Reopen-period reason/audit.
9. CSV/XLSX timesheet export.
10. PayrollInputSnapshot schema.
11. Snapshot generation/source hash.
12. Mark snapshot/payroll STALE after reopen.
13. Regenerate snapshot with audit/tests.

### Sprint 7 — Payroll, Insurance, PIT & Payslip
1. PayrollPeriod/PayrollRun models.
2. Payroll workflow state machine.
3. Prorated base salary calculation.
4. Allowance/attendance bonus/KPI earnings.
5. OT pay by effective policy.
6. Employee BHXH calculation.
7. Employee BHYT calculation.
8. Employee BHTN calculation.
9. Employer contribution lines/cost.
10. Taxable earnings/exemptions.
11. Personal/dependent deductions.
12. PIT progressive/withholding calculation.
13. Other authorized deductions.
14. Gross/Net reconciliation.
15. Payslip generate/release/self-view.
16. Payroll export, lock và calculation tests.

### Sprint 8 — Hardening & Deployment
1. Full unit test pass.
2. Integration/API test pass.
3. End-to-end HR-to-Payslip flow.
4. Payroll golden-case reconciliation.
5. Cross-tenant/IDOR/security tests.
6. Payroll privacy/access tests.
7. File upload/path traversal tests.
8. Responsive/accessibility audit.
9. Performance smoke test.
10. Docker/migration/seed clean run.
11. HTTPS deployment.
12. README/setup/operator guide.

### Sprint 9 — UAT, Demo & Final Delivery
1. Final regression & release checklist.
2. UAT stakeholder walkthrough (HR → Payroll → Payslip).
3. Demo script + video ghi hình.
4. Defense/presentation slides + Q&A prep.
5. Wiki + context/use-case sync + final report.
6. Repository tag, backup & handover.

## 3. Tổng quan

| Chỉ số | Giá trị |
|---|---:|
| Tổng Sprint | 9 |
| Tổng task (sprint) | 117 |
| Task pre-sprint (TASK-001) | 1 |
| Sprint 1 đã hoàn thành | 12 task |
| Tiến độ hiện tại | **10%** (12 / 117 sprint tasks) |
| Kết thúc dự kiến | **08/11/2026** |

## 4. Nguyên tắc

- Chỉ đánh dấu hoàn thành khi có artifact và bằng chứng test/review.
- Không hard-code tỷ lệ pháp lý trong calculation service; dùng policy version/effective date.
- Payroll calculation chỉ đọc PayrollInputSnapshot.
- Mọi module chứa dữ liệu nhạy cảm phải có tenant/resource authorization tests.
- Part-time, shift swap và night work không quay lại MVP nếu chưa có change request được duyệt.
- Sprint 9 là buffer; nếu Sprint 2–8 đúng tiến độ thì dùng Sprint 9 để polish demo/report, không thêm feature.