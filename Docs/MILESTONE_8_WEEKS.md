# TimeLock — Kế hoạch Milestone 8 tuần

> **Thời gian:** 07/09/2026–01/11/2026  
> **Quy ước tuần:** Thứ Hai–Chủ nhật  
> **Tuần hiện tại:** Tuần 1 — 07/09/2026–13/09/2026  
> **Mục tiêu:** Hoàn thiện MVP TimeLock multi-tenant cho văn phòng/doanh nghiệp nhỏ khoảng 10–50 nhân viên mỗi Organization.  
> **Lưu ý phân công:** Chưa có tên thành viên nên cột “Người phụ trách” sử dụng vai trò trong nhóm; thay bằng tên thật sau khi chia team.

## 1. Bảng milestone tổng thể

| Sprint/Milestone | Mục tiêu | Ngày bắt đầu | Ngày kết thúc | Deliverable cần bàn giao | Người phụ trách | Số task liên quan | Tỷ lệ hoàn thành | Trạng thái | Ghi chú |
|---|---|---:|---:|---|---|---:|---:|---|---|
| **Sprint 1 — Product Baseline & Planning** | Chốt phạm vi, actor, multi-tenant, lịch làm việc, OT và kiến trúc MVP | 07/09/2026 | 13/09/2026 | SRS v3.x; Project Proposal; wiki; prototype responsive; backlog; ERD/API/ADR baseline | BA/PM, UI/UX, Tech Lead | 10 | 90% | 🟡 Đang thực hiện | SRS, Proposal, wiki và prototype đã có. Còn chốt backlog, ERD/API baseline và phân công tên thật. |
| **Sprint 2 — Foundation, Auth & Tenant Isolation** | Dựng frontend/backend/database; xác thực; RBAC; cô lập Organization | 14/09/2026 | 20/09/2026 | Monorepo/app shell; DB migrations; Organization/User/Session; login/logout/me/change-password; tenant middleware; seed Organization A/B; CI cơ bản | Backend Lead, Frontend Lead, DevOps/QA | 12 | 0% | ⚪ Chưa bắt đầu | Gate bắt buộc: HR-A không đọc được dữ liệu Organization B. |
| **Sprint 3 — HR Configuration & Scheduling** | Hoàn thiện cơ cấu tenant, ShiftTemplate và lịch Full-time/Part-time | 21/09/2026 | 27/09/2026 | CRUD Department/Workplace/Network/ShiftTemplate/User; EmployeeAssignment; Calendar; RecurringSchedule; ShiftRegistration; WorkSchedule; UI HR/Manager | Backend, Frontend, QA | 14 | 0% | ⚪ Chưa bắt đầu | 08:00–17:00 chỉ là seed; phải demo ca 07:30–16:30 để chứng minh không hard-code. |
| **Sprint 4 — Attendance Core** | Check-in/out Network/GPS; lịch sử và tính ngày công | 28/09/2026 | 04/10/2026 | Today API/UI; Network/GPS validation; attendance state machine; server time; idempotency; late/early/working minutes; history/detail; responsive mobile | Backend, Frontend, QA | 13 | 0% | ⚪ Chưa bắt đầu | Tính theo WorkSchedule snapshot; không dựa vào 17:00 cố định. |
| **Sprint 5 — Selfie, Approval, Adjustment & Shift Swap** | Hoàn thiện bằng chứng ảnh, duyệt ngoại lệ, sửa công và đổi ca | 05/10/2026 | 11/10/2026 | Camera/preview/upload; private Evidence; Approval workflow; clarification; AdjustmentRequest; ShiftSwapRequest; target consent; manager approval; audit before/after | Backend, Frontend, QA/Security | 15 | 0% | ⚪ Chưa bắt đầu | Chặn tự duyệt bằng `SELF_APPROVAL_FORBIDDEN`; swap cập nhật hai lịch trong một transaction. |
| **Sprint 6 — Overtime Automation** | Request OT, tự phân loại và tính OT đủ điều kiện | 12/10/2026 | 18/10/2026 | OvertimeRequest/Result; manager approval; automatic OT classification; interval calculation; provisional/final recalculation; OT UI; unit/integration tests | Backend Lead, Frontend, QA | 12 | 0% | ⚪ Chưa bắt đầu | Employee không chọn loại OT; backend phân loại Working day/Weekly off/Public holiday. |
| **Sprint 7 — Timesheet Closing & Export** | Rà soát blocker, xác nhận phòng ban, chốt/mở kỳ và xuất bảng công | 19/10/2026 | 25/10/2026 | TimesheetPeriod; blocker dashboard; DepartmentConfirmation; period version; TimesheetSummary; close/reopen transaction; CSV/XLSX export; bảng công chi tiết | Backend, Frontend, HR-domain owner, QA | 14 | 0% | ⚪ Chưa bắt đầu | Bảng công gồm công chuẩn/thực tế, nghỉ/vắng, late/early và OT theo ba loại. |
| **Sprint 8 — Hardening, Deployment & Final Delivery** | Hoàn tất kiểm thử, bảo mật, tối ưu, deploy và chuẩn bị bảo vệ | 26/10/2026 | 01/11/2026 | Full test suite; E2E hero flow; tenant IDOR/security report; accessibility/responsive pass; Docker/deployment; production seed; README; demo video/script; final report | Cả nhóm, QA Lead, DevOps, PM | 14 | 0% | ⚪ Chưa bắt đầu | Không nhận thêm feature sau giữa tuần; ưu tiên sửa lỗi và ổn định demo. |

## 2. Task breakdown theo Sprint

### Sprint 1 — Product Baseline & Planning

1. Chốt phân khúc mục tiêu 10–50 nhân viên/Organization.
2. Chốt 4 role và quyền chấm công cá nhân của Manager/HR.
3. Chốt multi-tenant và tenant-isolation rules.
4. Chốt Full-time/Part-time, đăng ký ca và đổi ca.
5. Chốt OT tự phân loại và công thức eligible OT.
6. Đồng bộ SRS TimeLock.
7. Đồng bộ Project Proposal.
8. Hoàn thiện prototype responsive dùng mock data.
9. Hoàn thiện wiki tài liệu và link prototype.
10. Chốt backlog, ERD/API baseline và phân công thành viên.

**Exit criteria:** SRS được nhóm thống nhất; backlog 8 tuần có owner; không còn câu hỏi nghiệp vụ chặn Sprint 2.

### Sprint 2 — Foundation, Auth & Tenant Isolation

1. Chốt cấu trúc repository và convention.
2. Khởi tạo frontend production shell.
3. Khởi tạo backend và environment configuration.
4. Kết nối PostgreSQL và migration framework.
5. Tạo Organization/User/UserSession models.
6. Seed System Admin, Organization A/B và HR-A/HR-B.
7. Làm login/logout/me.
8. Làm change/reset temporary password.
9. Thêm tenant-context middleware từ session.
10. Thêm RBAC và protected routes.
11. Viết integration tests cross-tenant IDOR.
12. Thiết lập lint/test/build/CI baseline.

**Exit criteria:** đăng nhập đúng role; Organization bị suspend bị chặn; mọi test truy cập chéo tenant thất bại đúng 403/404.

### Sprint 3 — HR Configuration & Scheduling

1. CRUD Department.
2. CRUD Workplace và geofence.
3. CRUD AllowedNetwork/CIDR.
4. CRUD ShiftTemplate.
5. CRUD Employee/Department Manager tenant users.
6. EmployeeAssignment có effective dates.
7. ManagerAssignment có effective dates.
8. OrganizationCalendar và CalendarException.
9. EmployeeDayOverride tối thiểu.
10. RecurringSchedule cho Full-time.
11. Sinh WorkSchedule theo ngày.
12. ShiftRegistration cho Part-time.
13. Manager approve/reject đăng ký ca.
14. UI HR/Manager responsive và test overlap.

**Exit criteria:** HR cấu hình được ca bất kỳ trong ngày; Full-time sinh lịch; Part-time chỉ có nghĩa vụ làm sau khi ca được duyệt.

### Sprint 4 — Attendance Core

1. Today state API.
2. Resolve assignment/schedule theo work date.
3. Check-in state transition.
4. Check-out state transition.
5. Network validation.
6. GPS/Haversine validation.
7. Server-time recording.
8. Idempotency-Key store/middleware.
9. Unique constraints chống event trùng.
10. Tính working/late/early minutes.
11. History API/UI.
12. Day detail và audit timeline.
13. Responsive employee experience và integration tests.

**Exit criteria:** Employee hoàn thành check-in/out Network/GPS; refresh không mất state; double-click không tạo event trùng.

### Sprint 5 — Selfie, Approval, Adjustment & Shift Swap

1. Camera permission/capture flow.
2. Preview và retake.
3. File validation MIME/signature/size.
4. Private evidence storage.
5. Selfie attendance event.
6. Tạo ApprovalRequest tự động.
7. Manager approval queue/detail.
8. Approve/reject/request clarification.
9. Employee clarification response.
10. Chặn self-approval.
11. Tạo AdjustmentRequest.
12. Manager review và HR apply adjustment.
13. Tạo ShiftSwapRequest.
14. Target consent + Manager decision.
15. Atomic apply, audit before/after và period-version invalidation.

**Exit criteria:** Selfie tạo request thật; Manager không tự duyệt; adjustment/swap có audit và rollback đúng khi lỗi.

### Sprint 6 — Overtime Automation

1. Tạo OvertimeRequest model/API.
2. Form gửi OT không có trường overtimeType.
3. Manager approve/reject approved window.
4. Chặn self-approval OT.
5. Phát hiện overlapping request.
6. Phân loại `OT_PUBLIC_HOLIDAY`.
7. Phân loại `OT_WEEKLY_OFF`.
8. Phân loại `OT_WORKING_DAY`.
9. Tính requested/approved/actual/eligible minutes.
10. Tạo kết quả PROVISIONAL và tính lại FINAL.
11. UI OT cá nhân/phòng ban/HR.
12. Unit và integration tests cho precedence, interval và không đếm trùng phút.

**Exit criteria:** check-out muộn không có approval cho eligible OT bằng 0; public holiday ưu tiên weekly off; kết quả không vượt approved window.

### Sprint 7 — Timesheet Closing & Export

1. TimesheetPeriod state machine.
2. Period version.
3. Blocker calculation.
4. Blocker drill-down UI.
5. DepartmentTimesheetConfirmation.
6. Vô hiệu confirmation khi dữ liệu thay đổi.
7. Tổng hợp lịch/công chuẩn.
8. Tổng hợp công thực tế/nghỉ/vắng.
9. Tổng hợp OT theo ba loại.
10. TimesheetSummary snapshot.
11. Close-period transaction.
12. Reopen-period có reason/audit.
13. CSV export từ snapshot.
14. XLSX export và đối chiếu dữ liệu.

**Exit criteria:** không chốt được khi còn blocker; CLOSED chặn mutation; export khớp snapshot DB.

### Sprint 8 — Hardening, Deployment & Final Delivery

1. Chạy và sửa toàn bộ unit tests.
2. Chạy và sửa integration/API tests.
3. Viết/chạy E2E hero flow.
4. Security test SQL injection/IDOR/path traversal/file spoofing.
5. Kiểm tra evidence/cache/export/job không lẫn tenant.
6. Responsive test từ 360px tới desktop.
7. Accessibility audit các flow chính.
8. Performance smoke test.
9. Docker hóa ứng dụng/database.
10. Deploy HTTPS production.
11. Migration/seed từ database rỗng.
12. Hoàn thiện README/setup guide.
13. Chuẩn bị demo script/video và dữ liệu dự phòng.
14. Final regression, đóng scope và bàn giao báo cáo.

**Exit criteria:** build/deploy thành công từ môi trường sạch; hero demo chạy end-to-end; không còn lỗi P0/P1.

## 3. Tổng quan khối lượng và tiến độ

| Chỉ số | Giá trị |
|---|---:|
| Tổng số Sprint | 8 |
| Tổng số task nhóm | 104 |
| Task thuộc Sprint 1 | 10 |
| Task đã hoàn thành ước tính | 9 |
| Tiến độ toàn kế hoạch hiện tại | **8,7%** |
| Ngày kết thúc dự kiến | **01/11/2026** |

> Tỷ lệ hiện tại được tính từ 9 task có artifact kiểm chứng trong Sprint 1 trên tổng 104 task. Sau khi chốt backlog/ERD/API baseline và phân công thành viên, cập nhật Sprint 1 thành 100% và tổng tiến độ theo task thực tế.

## 4. Quy ước cập nhật trạng thái

| Trạng thái | Điều kiện |
|---|---|
| ⚪ Chưa bắt đầu | Chưa có task nào được chuyển sang In Progress |
| 🔵 Sẵn sàng | Dependency đã hoàn tất, backlog đã được phân công |
| 🟡 Đang thực hiện | Có task đang làm nhưng chưa đạt exit criteria |
| 🟠 Có rủi ro | Có blocker ảnh hưởng ngày kết thúc Sprint |
| 🟢 Hoàn thành | Tất cả deliverable và exit criteria đã được kiểm chứng |
| 🔴 Trễ hạn | Qua ngày kết thúc nhưng chưa đạt exit criteria |

## 5. Nguyên tắc quản lý Sprint

- Mỗi task phải có một owner chính và acceptance criteria.
- Không đánh dấu hoàn thành chỉ vì đã viết code; phải có test hoặc bằng chứng chạy thực tế.
- Demo cuối Sprint dùng database seed, không dùng dữ liệu hard-code trong UI.
- Task làm thay đổi attendance, schedule, OT hoặc closing phải có test tenant isolation.
- Feature chưa hoàn tất ở cuối Sprint được đánh giá lại phạm vi, không tự động kéo sang Sprint sau mà không cập nhật milestone.
- Từ giữa Sprint 8 chỉ nhận bug fix; không nhận thêm feature mới.
