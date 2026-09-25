# Kế hoạch TASK-043 đến TASK-048 — Full-time Scheduling, Leave & Attendance

> Flow ShiftTemplate/RecurringSchedule đang được thiết kế lại. Kế hoạch triển khai mới nằm tại [SHIFT_SCOPE_AND_REPEAT_FLOW_PLAN.md](./SHIFT_SCOPE_AND_REPEAT_FLOW_PLAN.md); khi thực hiện, tài liệu mới thay thế phần TASK-043/TASK-044 liên quan workplace và RecurringSchedule riêng.

## 1. Thông tin chung

| Thuộc tính | Nội dung |
|---|---|
| Sprint | Sprint 4 — Full-time Scheduling, Leave & Attendance |
| Phạm vi | ShiftTemplate, RecurringSchedule, WorkSchedule, Calendar, LeaveRequest và phân loại ngày công |
| Người phụ trách | Nguyễn Thành Tài |
| Tổng estimate | 28 story points |
| Tài liệu nguồn | `Docs/SRS_CORESTAFF.md`, `Docs/MILESTONE_9_WEEKS.md`, `Docs/TASK_BACKLOG_9_WEEKS.md` |

## 2. Role liên quan

| Role | Trách nhiệm trong phạm vi TASK-043–048 |
|---|---|
| Employee | Xem lịch làm việc cá nhân; tạo và theo dõi LeaveRequest của chính mình. |
| Department Manager | Xem lịch nhân viên thuộc department được giao; approve/reject LeaveRequest đúng scope; không được tự duyệt request của mình. |
| HR | Quản lý ShiftTemplate, RecurringSchedule, WorkSchedule và Calendar; apply LeaveRequest đã được Manager approve; không được tự apply request của mình. |
| System | Sinh WorkSchedule, chống trùng lịch, thực thi state transition, tạo EmployeeDayOverride, lưu snapshot/audit và phân loại ngày công. |
| SYSTEM_ADMIN | Không tham gia nghiệp vụ scheduling/leave của tenant; không được dùng quyền platform để thay thế HR trong các API nghiệp vụ. |

## 3. Dependency

```text
TASK-043 ShiftTemplate
        ↓
TASK-044 RecurringSchedule
        ↓
TASK-045 Generate WorkSchedule
        ↓
TASK-046 Organization Calendar
        ↓
TASK-047 Leave submit/review
        ↓
TASK-048 HR apply + day classification
```

TASK-046 và phần giao diện/API độc lập của TASK-047 có thể triển khai song song sau khi thống nhất định dạng ngày, timezone và quy tắc tenant scope. TASK-048 chỉ tích hợp hoàn chỉnh sau khi WorkSchedule, Calendar và LeaveRequest ổn định.

## 4. Ma trận quyền tổng hợp

| Chức năng | Employee | Department Manager | HR | System |
|---|:---:|:---:|:---:|:---:|
| Xem lịch cá nhân | Có | Có, với tư cách employee | Có, nếu có employee assignment | Cung cấp dữ liệu |
| Xem lịch nhân viên trong department | Không | Chỉ department được giao | Toàn organization | Lọc tenant/scope |
| Quản lý ShiftTemplate | Không | Không | Có | Validate và audit |
| Quản lý RecurringSchedule | Không | Chỉ xem đúng scope | Có | Kiểm tra overlap |
| Sinh/điều chỉnh WorkSchedule | Không | Chỉ xem đúng scope | Có | Sinh idempotent và lưu snapshot |
| Quản lý Calendar/holiday | Không | Chỉ đọc khi cần | Có | Phân loại ngày |
| Tạo LeaveRequest | Của chính mình | Của chính mình | Của chính mình | Route đến queue phù hợp |
| Approve/reject LeaveRequest | Không | Có, đúng scope và không self-approve | Không ở bước Manager | Kiểm soát transition |
| Apply LeaveRequest | Không | Không | Có, không self-apply | Transaction và tạo override |
| Ghi EmployeeDayOverride trực tiếp | Không | Không | Không | Chỉ sinh từ leave apply |

---

## 5. TASK-043 — ShiftTemplate HR-configurable

**Estimate:** 4 points  
**Role chính:** HR  
**Role liên quan:** System, Employee gián tiếp qua Attendance/WorkSchedule

### Mục tiêu

Cho phép HR cấu hình nhiều mẫu ca làm việc trong Organization; giờ 08:00–17:00 chỉ là seed và không phải business rule.

### Artifact cần hoàn thiện

- Chuẩn hóa schema `ShiftTemplate` với:
  - `organizationId`, `code`, `name`;
  - `startTime`, `endTime`;
  - `breakMinutes`, `gracePeriodMinutes`, `active`;
  - unique index `(organizationId, code)`.
- Loại bỏ ràng buộc nghiệp vụ “mỗi Workplace chỉ có một ShiftTemplate”.
- Hoàn thiện API HR create/list/detail/update/activate/deactivate.
- Hoàn thiện UI quản lý ca, Web service, seed và Swagger.
- Cập nhật Assignment/Attendance để đọc đúng ShiftTemplate và lưu snapshot.
- Không cho deactivate template đang được RecurringSchedule có hiệu lực sử dụng.

### Acceptance criteria

- HR tạo được ca có giờ khác 08:00–17:00.
- `code` chỉ unique trong cùng Organization.
- `startTime < endTime`; break/grace là số nguyên không âm.
- HR tenant A không đọc hoặc sửa template của tenant B.
- Employee và Department Manager không được tạo/sửa template.
- Template đang được lịch có hiệu lực sử dụng không thể bị deactivate.
- Tính late/early dùng WorkSchedule/ShiftTemplate thực tế, không dùng giờ hard-code.

### Kiểm thử

- Unit test validation thời gian, duplicate code, tenant isolation và deactivate-in-use.
- Controller/RBAC test cho HR và các role bị từ chối.
- Web test create/edit/filter/activate/deactivate và error state.
- Regression test Assignment và Attendance snapshot.
- E2E với ca 09:00–18:00.

---

## 6. TASK-044 — RecurringSchedule Full-time

**Estimate:** 6 points  
**Role chính:** HR  
**Role liên quan:** Department Manager chỉ xem, System validate/generate

### Mục tiêu

Cho phép HR gán lịch lặp theo tuần cho nhân viên Full-time trong một khoảng hiệu lực.

### Artifact cần hoàn thiện

- Tạo schema `RecurringSchedule`:
  - `organizationId`, `employeeId`, `shiftTemplateId`;
  - `weekdays[]` theo ISO `1..7`;
  - `effectiveFrom`, `effectiveTo`, `active`;
  - actor và audit timestamps.
- API HR create/list/detail/update/deactivate.
- API Manager read-only, lọc bằng department scope.
- UI `/hr/schedules` để lọc nhân viên, chọn ca, weekdays và khoảng hiệu lực.
- Validate employee Full-time, cùng tenant, shift active và không overlap.

### Acceptance criteria

- Chỉ HR được tạo/sửa RecurringSchedule.
- Manager chỉ xem lịch nhân viên thuộc department được giao.
- Không gán được employee tenant khác, employee không Full-time hoặc shift inactive.
- Không có hai recurring rule giao khoảng hiệu lực cho cùng employee.
- Rule nối tiếp nhau, không giao ngày, được chấp nhận.
- Thay đổi rule không sửa snapshot lịch sử.

### Kiểm thử

- Unit test weekdays, effective dates, open-ended range và overlap.
- RBAC, tenant isolation và manager-scope test.
- Duplicate/concurrency test khi tạo rule đồng thời.
- Web form/list/filter tests.

---

## 7. TASK-045 — Generate WorkSchedule

**Estimate:** 6 points  
**Role chính:** System và HR  
**Role liên quan:** Employee, Department Manager

### Mục tiêu

Sinh lịch làm việc chính thức theo ngày từ RecurringSchedule và lưu snapshot ca để dữ liệu lịch sử không thay đổi.

### Artifact cần hoàn thiện

- Tạo schema `WorkSchedule`:
  - `organizationId`, `employeeId`, `shiftTemplateId`, `workDate`;
  - `status: SCHEDULED | CANCELLED | COMPLETED`;
  - snapshot `startAt`, `endAt`, `breakMinutes`, `gracePeriodMinutes`;
  - `recurringScheduleId`, actor và audit.
- Unique index `(organizationId, employeeId, workDate)`.
- Generator theo date range, weekdays và effective dates.
- Preview/generate API cho HR.
- `GET /api/schedules/mine` cho Employee.
- API xem lịch đúng department scope cho Manager.
- Attendance ưu tiên WorkSchedule snapshot thay vì ca hiện hành trên Assignment.
- Chuẩn hóa timezone Organization; `workDate` dùng `YYYY-MM-DD`, instant lưu UTC.

### Acceptance criteria

- Sinh đúng lịch theo weekdays và khoảng hiệu lực.
- Một employee tối đa một WorkSchedule mỗi ngày.
- Generator idempotent; chạy lại không tạo bản ghi trùng.
- Thay đổi ShiftTemplate sau khi sinh không đổi snapshot cũ.
- Không sinh lịch ngoài khoảng hiệu lực hoặc sai weekday.
- Employee chỉ xem được lịch của chính mình.
- Lịch đã completed hoặc có attendance không bị ghi đè ngoài workflow cho phép.

### Kiểm thử

- Table-driven unit test cho weekday, date boundary và timezone.
- Idempotency, duplicate-key và concurrent generation tests.
- Snapshot immutability test.
- Attendance integration test với ca không phải 08:00–17:00.
- E2E: recurring rule → generate → employee xem lịch.

---

## 8. TASK-046 — OrganizationCalendar/holiday

**Estimate:** 4 points  
**Role chính:** HR  
**Role liên quan:** System; Employee/Manager đọc kết quả gián tiếp

### Mục tiêu

Cho phép HR cấu hình ngoại lệ lịch của Organization và cung cấp nguồn dữ liệu chuẩn cho phân loại ngày công/OT.

### Artifact cần hoàn thiện

- Dùng model `CalendarException`:
  - `organizationId`, `date`;
  - `type: PUBLIC_HOLIDAY | SPECIAL_WORKING_DAY`;
  - `name`, actor và timestamps.
- Unique index `(organizationId, date)`.
- API HR create/list/update/delete hoặc soft-delete theo audit policy.
- UI `/hr/calendar` dạng danh sách hoặc lịch tháng.
- Domain resolver với thứ tự ưu tiên:
  1. `PUBLIC_HOLIDAY`;
  2. `SPECIAL_WORKING_DAY`;
  3. WorkSchedule có hiệu lực;
  4. Không có lịch → `WEEKLY_OFF`.
- Calendar không được dùng để ghi leave riêng của employee.

### Acceptance criteria

- HR cấu hình ngày lễ riêng cho Organization.
- Không có hai CalendarException cùng ngày trong một Organization.
- Public holiday ghi đè weekly off và WorkSchedule khi phân loại.
- Special working day có thể biến ngày nghỉ tuần thành ngày làm việc theo lịch áp dụng.
- Không truy cập hoặc sửa calendar của tenant khác.

### Kiểm thử

- Unit test resolver cho working day, weekly off, holiday và special working day.
- Test holiday trùng weekly off chỉ nhận `PUBLIC_HOLIDAY`.
- RBAC, tenant isolation và duplicate-date tests.
- Web CRUD/validation tests.
- Integration test với WorkSchedule và OT classification.

---

## 9. TASK-047 — LeaveRequest Employee submit + Manager review

**Estimate:** 4 points  
**Role chính:** Employee và Department Manager  
**Role liên quan:** System route/scope; HR nhận request đã approve ở task sau

### Mục tiêu

Triển khai workflow Employee gửi yêu cầu nghỉ nguyên ngày và Manager đúng department scope approve/reject.

### Artifact cần hoàn thiện

- Tạo schema `LeaveRequest`:
  - `organizationId`, `employeeId`, `departmentId` và snapshot cần thiết;
  - `startDate`, `endDate`;
  - `leaveType: PAID_LEAVE | UNPAID_LEAVE`;
  - `reason`, `evidenceId` nullable;
  - `status: PENDING_MANAGER | APPROVED | REJECTED | HR_APPLIED`;
  - reviewer/apply actor và timestamps.
- Employee API:
  - `POST /api/leave-requests`;
  - `GET /api/leave-requests/mine`;
  - detail của chính mình.
- Manager API:
  - `GET /api/manager/leave-requests`;
  - `POST /api/manager/leave-requests/:id/approve`;
  - `POST /api/manager/leave-requests/:id/reject`.
- Thay phần leave trên `/app/leave` bằng workflow LeaveRequest riêng.
- Thêm queue/tab review cho Manager.

### Acceptance criteria

- Employee chỉ tạo/xem LeaveRequest của chính mình.
- Request mới có trạng thái `PENDING_MANAGER`.
- Chỉ hỗ trợ nghỉ nguyên ngày trong MVP.
- `startDate <= endDate`; reason dài 10–1000 ký tự.
- Không tạo request giao với request đang hiệu lực hoặc ngày thuộc kỳ CLOSED.
- Manager chỉ approve/reject request đúng Organization và department scope.
- Reject bắt buộc có lý do.
- Manager không được tự duyệt request của mình.
- `APPROVED` chưa thay đổi AttendanceDay hoặc Timesheet.

### Kiểm thử

- State-machine tests cho approve/reject và transition không hợp lệ.
- IDOR, tenant isolation, department scope và self-approval tests.
- Date range, overlap và CLOSED-period tests.
- Web tests cho employee form/list và manager review queue.
- E2E: employee submit → manager approve/reject.

---

## 10. TASK-048 — HR apply LeaveRequest + day classification

**Estimate:** 4 points  
**Role chính:** HR và System  
**Role liên quan:** Employee, Department Manager đọc kết quả

### Mục tiêu

Apply LeaveRequest đã được Manager approve thành EmployeeDayOverride trong transaction và phân loại ngày công đúng theo schedule/calendar/leave/attendance.

### Artifact cần hoàn thiện

- Tạo schema `EmployeeDayOverride`:
  - `organizationId`, `employeeId`, `date`;
  - `type: PAID_LEAVE | UNPAID_LEAVE`;
  - `leaveRequestId` bắt buộc;
  - `reason`, `createdBy`, timestamps.
- Unique index `(organizationId, employeeId, date)`.
- Không cung cấp API create/update/delete trực tiếp cho override.
- HR API:
  - `GET /api/hr/leave-requests`;
  - `POST /api/hr/leave-requests/:id/apply`;
  - optional read-only `GET /api/hr/employee-day-overrides`.
- Apply trong một Mongo transaction:
  - request phải là `APPROVED`;
  - cấm self-apply;
  - kỳ không được `CLOSED`;
  - upsert override từng ngày, gắn `leaveRequestId`;
  - chuyển request thành `HR_APPLIED`;
  - ghi audit before/after;
  - tăng `TimesheetPeriod.version` và vô hiệu confirmation cũ khi module tương ứng tồn tại.
- Tạo `DayClassificationService` dùng chung cho Attendance history/today/timesheet.
- UI HR queue để lọc approved/applied, xem chi tiết và xác nhận apply.

### Quy tắc phân loại

| Điều kiện | Workday type/day result mong đợi |
|---|---|
| Có EmployeeDayOverride từ request `HR_APPLIED` | `PAID_LEAVE` hoặc `UNPAID_LEAVE`; không `ABSENT` |
| Calendar là public holiday | `PUBLIC_HOLIDAY`; không `ABSENT` |
| Không có nghĩa vụ làm việc | `WEEKLY_OFF`; không `ABSENT` |
| Có nghĩa vụ làm việc, không có attendance event | `WORKING_DAY` + `ABSENT` |
| Chỉ có check-in hoặc chỉ có check-out | `WORKING_DAY` + `INCOMPLETE` |
| Có đủ check-in/check-out | `WORKING_DAY` và kết quả tính công tương ứng |

### Acceptance criteria

- Chỉ request `APPROVED` mới được apply.
- Apply tạo đúng một override cho mỗi ngày và đổi status thành `HR_APPLIED` trong cùng transaction.
- Apply lặp hoặc apply đồng thời không tạo dữ liệu trùng.
- Pending/Approved chưa apply không thay đổi ngày công.
- HR không tự apply request của mình.
- Weekly off, holiday và leave đã apply không bị tính `ABSENT`.
- Ngày làm việc không có event được phân loại `ABSENT`.
- Ngày làm việc thiếu một đầu event được phân loại `INCOMPLETE`.
- Không có đường API ghi EmployeeDayOverride trực tiếp.

### Kiểm thử

- Transaction rollback test: một ngày lỗi thì không commit override hoặc status.
- Concurrent/idempotent apply test.
- Tenant isolation, self-apply và CLOSED-period tests.
- Table-driven tests cho toàn bộ ma trận phân loại.
- Priority test giữa leave, holiday, weekly off, schedule và attendance.
- Integration/E2E:
  - Employee submit;
  - Manager approve;
  - HR apply;
  - EmployeeDayOverride được tạo;
  - Attendance/history hiển thị loại ngày đúng.

---

## 11. Artifact bàn giao cho mỗi task

- Schema, enum và compound indexes.
- DTO validation và mã lỗi nghiệp vụ ổn định.
- Controller/service/module với RBAC và tenant scope.
- Web service, route, màn hình và loading/empty/error/success states.
- Unit tests API, Web tests và E2E cho luồng quan trọng.
- Swagger/API contract.
- Seed cho tối thiểu hai tenant để chứng minh tenant isolation.
- Implementation note và evidence test.
- Cập nhật trạng thái trong `Docs/TASK_BACKLOG_9_WEEKS.md`.

## 12. Definition of Done

- `npm run lint`, `npm test` và `npm run build` tại workspace `CoreStaff` đều pass.
- Database indexes được đăng ký và kiểm tra bằng `ensure-indexes`.
- Không hard-code giờ ca, ngày lễ hoặc loại nghỉ trong business service.
- Mọi truy vấn nghiệp vụ đều tenant-scoped.
- Manager APIs kiểm tra department scope theo ngày hiệu lực.
- State transition nhạy cảm có audit và chống request lặp/concurrent.
- Snapshot lịch sử không bị thay đổi khi template/rule hiện hành được chỉnh sửa.
- Có test chứng minh `AC-SCH-01`, `AC-SCH-02`, `AC-SCH-03`, `AC-CAL-01` và `AC-LEAVE-01` đến `AC-LEAVE-04` trong SRS.

## 13. Checklist thực hiện

| Task | API/Schema | Web UI | Unit/Integration | E2E | Docs | Trạng thái |
|---|:---:|:---:|:---:|:---:|:---:|---|
| TASK-043 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp |
| TASK-044 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp |
| TASK-045 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp |
| TASK-046 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp |
| TASK-047 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp |
| TASK-048 | ☑ | ☑ | ☑ | ☐ | ☑ | API và Web đã tích hợp; Timesheet version hook chờ module Timesheet |
