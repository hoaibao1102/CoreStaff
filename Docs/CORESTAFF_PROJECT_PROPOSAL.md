# CoreStaff — Human Resource, Attendance & Payroll Management System

> **Tên tiếng Việt:** CoreStaff — Hệ thống Quản trị Nhân sự, Chấm công và Tiền lương  
> **Tên tiếng Anh:** CoreStaff — Human Resource, Attendance & Payroll Management System  
> **Loại dự án:** Nền tảng web multi-tenant, responsive, mobile-first  
> **Đối tượng mục tiêu:** Văn phòng và doanh nghiệp nhỏ khoảng 10–50 nhân viên/Organization; không phải giới hạn kỹ thuật  
> **Môn học:** SWP391 — Software Development Project  
> **Học kỳ:** FA26  
> **Trạng thái:** Đề xuất dự án sinh viên

---

## 1. Thông tin theo bảng FA26_SWP391

### Thông tin nhận diện

| Trường | Giá trị |
|---|---|
| No. | `TBD` |
| Lecturers | `TBD` |
| Project Name (VI) | **CoreStaff — Hệ thống Quản trị Nhân sự, Chấm công và Tiền lương** |
| Project Name (EN) | **CoreStaff — Human Resource, Attendance & Payroll Management System** |

> `Lecturers` và số thứ tự chưa có thông tin nên được để `TBD`, tránh tự gán sai giảng viên phụ trách. CoreStaff là đề xuất mới theo cấu trúc cột của bảng FA26_SWP391, không phải một dòng đã tồn tại trong bản Excel tham chiếu.

### Actors

1. **Employee** (`EMPLOYEE`)
2. **Department Manager** (`DEPARTMENT_MANAGER`, alias Approver)
3. **HR** (`HR`, alias Payroll Officer)
4. **System Administrator** (`SYSTEM_ADMIN`)

> Xem chi tiết luồng dữ liệu tại [CoreStaff_Context_Diagram.md](./CoreStaff_Context_Diagram.md) và sơ đồ ca sử dụng tại [Use case diagram.md](./Use case diagram.md).

### Main Features

Quản lý hồ sơ nhân viên, chức danh, hợp đồng và tài liệu; cấu hình ca Full-time hành chính; chấm công Network/GPS/Selfie; Employee gửi phép → Manager duyệt → HR apply; điều chỉnh và OT; kiểm soát giờ làm theo policy; chốt công; tạo PayrollInputSnapshot; tính Gross, bảo hiểm, PIT, Net Salary, employer cost và phát hành Payslip.

### Must Have

| Flow | Nội dung | Mức ưu tiên |
|---|---|---|
| Flow 1 | User, Role & Attendance Configuration Management | REQUIRED |
| Flow 2 | Employee Check-in/Check-out & Evidence Management | REQUIRED |
| Flow 3 | Attendance Approval & Clarification Workflow | REQUIRED |
| Flow 4 | Monthly Timesheet Review & Closing | REQUIRED |
| Flow 4A | Employee, Contract & Payroll | REQUIRED |
| Flow 4B | Overtime Request & Automatic Classification | REQUIRED |
| Adjustment | Adjustment Request (before close) | REQUIRED |
| Leave | Employee request → Manager approve → HR apply | REQUIRED |
| Compensation Policy | Attendance Bonus template + Allowance hybrid | REQUIRED |

### Nice to Have

| Flow | Nội dung | Mức ưu tiên |
|---|---|---|
| Flow 5 | Adjustment Request After Closing (reopen-based) | OPTIONAL |
| Flow 6 | Dashboard, Notification & Custom Report Export | OPTIONAL |
| Flow 7 | Advanced Security and Analytics | OPTIONAL |

---

## 2. Project Name

### Tên chính thức

**CoreStaff — Hệ thống Quản trị Nhân sự, Chấm công và Tiền lương**

### Tên tiếng Anh

**CoreStaff — Human Resource, Attendance & Payroll Management System**

### Tagline

> **Quản trị nhân sự. Chấm công. Tính lương.**  
> *From employee records to trusted payroll.*

---

## 3. Problem Statement

Các tổ chức nhỏ thường quản lý chấm công bằng bảng tính, biểu mẫu thủ công hoặc những hệ thống chỉ ghi nhận giờ vào/ra mà chưa xử lý đầy đủ các trường hợp làm việc ngoài văn phòng. Điều này gây ra nhiều vấn đề:

- Không xác minh được nhân viên thực sự chấm công tại đâu.
- Dữ liệu Network, GPS và ảnh Selfie được quản lý rời rạc.
- Quản lý khó kiểm tra các trường hợp bất thường hoặc thiếu bằng chứng.
- Nhân viên không có quy trình giải trình minh bạch khi bản ghi bị từ chối.
- Dữ liệu ngày công có thể bị thay đổi sau khi đã tổng hợp.
- Bộ phận nhân sự mất nhiều thời gian rà soát, tổng hợp và khóa bảng công cuối tháng.
- Khó truy vết ai đã tạo, duyệt, từ chối hoặc chỉnh sửa một bản ghi.

CoreStaff giải quyết toàn bộ vòng đời từ lúc nhân viên chấm công đến khi dữ liệu được quản lý phê duyệt và bộ phận nhân sự chốt kỳ công.

---

## 4. Project Objectives

- Xây dựng CoreStaff multi-tenant có quản lý nhân viên, hợp đồng, chấm công và tiền lương.
- Hỗ trợ nhân viên chấm công tại văn phòng và ngoài văn phòng.
- Xác minh bản ghi bằng Network, GPS hoặc Selfie kết hợp vị trí.
- Quản lý bằng chứng chấm công có kiểm soát truy cập.
- Cung cấp quy trình duyệt, từ chối và yêu cầu giải trình.
- Cho phép nhân viên theo dõi lịch sử và trạng thái xử lý ngày công.
- Tổng hợp dữ liệu theo tháng và thực hiện chốt/khóa kỳ công.
- Bảo đảm dữ liệu đã chốt không bị thay đổi tùy ý.
- Lưu audit log cho các thao tác quan trọng.
- ReactJS responsive là Web MVP cho toàn bộ role; React Native là SHOULD, chỉ phục vụ Employee hero flow.
- Chỉ hỗ trợ Full-time giờ hành chính; HR cấu hình ca và giờ nghỉ, không hard-code 08:00–17:00.
- Tự phân loại OT, kiểm soát giới hạn giờ theo policy và tính lương từ snapshot bất biến.

---

## 5. Actors

### 5.1. Employee — Nhân viên

- Đăng nhập bằng email hoặc mã nhân viên và mật khẩu.
- Xem ca làm việc, nơi làm việc và trạng thái chấm công hôm nay.
- Chọn làm tại văn phòng hoặc làm ngoài văn phòng.
- Check-in và check-out bằng phương thức phù hợp.
- Chụp Selfie và gửi vị trí khi làm ngoài văn phòng.
- Xem phương thức, thời gian server và bằng chứng đã ghi nhận.
- Xem lịch sử chấm công theo tháng.
- Xem chi tiết từng ngày công.
- Xem trạng thái phê duyệt và lý do bị từ chối.
- Gửi giải trình, LeaveRequest và OT/adjustment cá nhân.
- Xem bảng tổng hợp công cá nhân trước và sau khi kỳ công được chốt.

### 5.2. Department Manager (`DEPARTMENT_MANAGER`) — Quản lý phòng ban

- Là nhân viên có thêm quyền quản lý và sử dụng cùng một tài khoản cho cả hai phạm vi.
- Nhóm **Cá nhân** gồm: **Chấm công hôm nay**, **Lịch sử công**, **Nghỉ phép & OT**.
- Nhóm **Quản lý** có một mục **Phòng ban**, gồm hai tab **Phê duyệt** và **Đánh giá nhân sự**.
- Tab **Phê duyệt** xử lý Selfie/ngoại lệ/adjustment/giải trình và OT; Network/GPS hợp lệ không phải duyệt từng ngày.
- Tab **Đánh giá nhân sự** trong MVP là KPI kỳ lương: manager tạo/sửa `DRAFT`, HR `CONFIRMED`; không phải performance review đầy đủ.
- Chỉ xem nhân viên/yêu cầu/KPI thuộc một hoặc nhiều Department được giao qua `ManagerAssignment` có hiệu lực.
- Không được tự duyệt yêu cầu của chính mình; request phải chuyển theo ApprovalDelegation hoặc HR queue.
- Xem Selfie, GPS, accuracy, server time, cảnh báo và audit timeline trong request đúng scope.
- Approve, Reject có lý do hoặc Request Clarification; duyệt khung giờ OT nhưng backend tự phân loại OT.
- Approve/reject LeaveRequest đúng department scope và xác nhận dữ liệu phòng ban đã sẵn sàng để chốt công.
- Không xem lương, hợp đồng, tài liệu private hoặc định danh thuế/bảo hiểm của nhân viên trong phòng.
- Responsive web được hoàn thiện/nghiệm thu ở desktop và mobile viewport trước; Expo chỉ port sau bằng cùng API contract.

### 5.3. HR (`HR`) — Nhân sự / Payroll Officer

- Có thể check-in/check-out và xem **Công của tôi** nếu được cấp assignment như một nhân viên nội bộ.
- Nếu không có assignment, tài khoản HR chỉ dùng nghiệp vụ quản trị/chốt công và không hiển thị action chấm công.
- Không được tự duyệt hoặc tự áp dụng yêu cầu của chính mình.
- Xem tình trạng hoàn thiện bảng công theo tháng và phòng ban.
- Xem nhân viên thiếu check-in, thiếu check-out hoặc còn yêu cầu chờ duyệt.
- Rà soát số ngày công, tổng giờ, số phút đi trễ và về sớm.
- Mở kỳ công mới.
- Kiểm tra điều kiện trước khi chốt kỳ.
- Chốt và khóa kỳ công.
- Mở lại kỳ công khi có lý do hợp lệ và lưu audit log.
- Xuất bảng công CSV/Excel; tính lương nội bộ qua PayrollRun/Payslip (xem Flow 4A).
- Apply LeaveRequest đã duyệt thành PAID/UNPAID override; xử lý AdjustmentRequest.
- Cấu hình AttendanceBonusPolicy từ template và Allowance hybrid catalog/custom.

### 5.4. System Administrator (`SYSTEM_ADMIN`) — Quản trị viên hệ thống

- Không thuộc workforce của tenant và không có chức năng check-in/check-out.
- Quản lý tài khoản người dùng.
- Gán vai trò `EMPLOYEE`, `DEPARTMENT_MANAGER`, `HR`, `SYSTEM_ADMIN`.
- Khóa, mở khóa hoặc vô hiệu hóa tài khoản.
- Đặt lại mật khẩu tạm thời.
- Quản lý workplace và thông tin geofence.
- Quản lý mạng/IP/CIDR được phép chấm công.
- Quản lý ca làm và lịch làm việc.
- Gán workplace, shift và approver cho nhân viên.
- Cấu hình chính sách chấm công và thời hạn lưu bằng chứng.
- Xem audit log toàn hệ thống.

---

## 6. Main Features

### 6.1. Authentication and Account Management

- Đăng nhập bằng email hoặc mã nhân viên.
- Đăng xuất và quản lý phiên đăng nhập.
- Đổi mật khẩu.
- Bắt buộc đổi mật khẩu tạm thời trong lần đăng nhập đầu tiên.
- Khóa đăng nhập tạm thời khi nhập sai nhiều lần.
- Admin tạo, cập nhật, khóa và vô hiệu hóa tài khoản.
- Role-based access control ở cả frontend và backend.

### 6.2. Workplace, Network and Shift Configuration

- Quản lý danh sách địa điểm làm việc.
- Cấu hình latitude, longitude và bán kính geofence.
- Cấu hình độ chính xác GPS tối đa.
- Cấu hình public IP hoặc CIDR mạng văn phòng.
- Bật/tắt Network Attendance, GPS Attendance và Selfie fallback.
- Quản lý ca làm, giờ bắt đầu, giờ kết thúc, thời gian nghỉ và grace period.
- Gán nhân viên vào workplace, shift và approver.

### 6.2A. Full-time Office Scheduling

- MVP chỉ hỗ trợ nhân viên Full-time và ca hành chính trong cùng ngày.
- HR cấu hình ShiftTemplate gồm start/end/break/grace/weekdays; 08:00–17:00 chỉ là seed.
- Không hỗ trợ Part-time, đăng ký/đổi ca, ca đêm, ca qua ngày hoặc nhiều ca/ngày.
- Scheduled working minutes được tính sau khi trừ break do HR nhập.

### 6.2B. Leave Request Management

- Employee gửi LeaveRequest nguyên ngày (`PAID_LEAVE` hoặc `UNPAID_LEAVE`).
- Department Manager approve/reject đúng scope; HR apply thành EmployeeDayOverride.
- Quota/accrual, half-day, hourly leave, carry-over và balance đầy đủ là LATER.

### 6.2C. Attendance Bonus & Allowance

- Platform seed AttendanceBonusTemplate tier 100/70/50; HR clone/custom tiers và conditions theo Organization.
- Allowance dùng hybrid: catalog seed (ăn trưa, xăng xe, điện thoại) + custom allowance tenant.
- Payroll chỉ đọc policy/allowance version trong PayrollInputSnapshot.

### 6.3. Employee Check-in/Check-out

- Xem trạng thái ngày công hôm nay.
- Chọn `IN_OFFICE` hoặc `OUT_OFFICE` khi check-in.
- Chấm công tại văn phòng bằng Network hoặc GPS.
- Tự động chuyển sang Selfie fallback nếu Network/GPS không hợp lệ và chính sách cho phép.
- Chấm công ngoài văn phòng bằng Selfie + GPS.
- Check-out theo work mode đã chọn lúc check-in.
- Không cho check-out trước check-in.
- Không tạo hai check-in hoặc hai check-out trong cùng ngày.
- Sử dụng thời gian backend làm thời gian chính thức.
- Chống gửi trùng bằng Idempotency-Key.

### 6.4. Evidence Management

- Chụp ảnh trực tiếp bằng camera trước.
- Xem trước ảnh và chụp lại trước khi gửi.
- Mỗi check-in/check-out sử dụng ảnh mới.
- Lưu vị trí, độ chính xác và thời gian client để audit.
- Kiểm tra MIME type, file signature và dung lượng ảnh.
- Lưu bằng chứng trong private storage.
- Chỉ người sở hữu, người phê duyệt được gán và Admin mới được truy cập.

### 6.5. Approval and Clarification Workflow

- Selfie tạo yêu cầu phê duyệt tự động; GPS bất thường tự tạo request là SHOULD.
- Network/GPS hợp lệ theo policy không cần manager duyệt từng ngày.
- Department Manager vào **Phòng ban → Phê duyệt** để xem Selfie/ngoại lệ/adjustment/giải trình và OT thuộc `managedDepartmentIds`.
- Approve, Reject hoặc Request Clarification; Reject/Clarification bắt buộc có nội dung.
- Nhân viên gửi phản hồi; yêu cầu trở lại trạng thái Pending.
- Quyết định dùng expected version, lưu transaction/audit và trả conflict nếu request đã được xử lý.
- Manager không tự duyệt và không thể dùng `departmentId` từ client để vượt `ManagerAssignment`.

### 6.6. Attendance History and Calculation

- Xem lịch sử theo tháng.
- Xem thời gian check-in/check-out và phương thức thực tế.
- Hiển thị trạng thái ngày công và trạng thái phê duyệt.
- Tính tổng phút làm việc.
- Tính số phút đi trễ và về sớm.
- Xem chi tiết bằng chứng và audit timeline của từng ngày.

### 6.6A. Overtime Management

- Employee gửi ngày, khung giờ, lý do và nội dung OT; không được tự chọn loại OT.
- Department Manager duyệt khoảng thời gian OT trong đúng phạm vi và không tự duyệt request của mình.
- Backend tự phân loại `OT_WORKING_DAY`, `OT_WEEKLY_OFF`, `OT_PUBLIC_HOLIDAY` từ WorkCalendar và WorkSchedule.
- Hệ thống lưu requested, approved, actual và eligible minutes; check-out muộn không tự động thành OT.
- Eligible OT là phần được duyệt giao với attendance thực tế và nằm ngoài lịch chính thức.
- HR rà soát và hệ thống tính lại kết quả FINAL khi chốt kỳ; Payroll dùng OvertimePayPolicy có hiệu lực để tính tiền OT.

### 6.6B. Employee, Contract and Payroll Management

- HR quản lý EmployeeProfile, Position, hợp đồng thử việc/chính thức và tài liệu private.
- Lương thử việc do HR nhập, không thấp hơn minimum policy; seed 85% mức lương công việc.
- HR cấu hình SalaryProfile, lương đóng bảo hiểm, phụ cấp, chuyên cần và KPI.
- Các policy lao động, OT, bảo hiểm và PIT có version/ngày hiệu lực/căn cứ pháp lý.
- Timesheet CLOSED tạo PayrollInputSnapshot; payroll tính Gross Income, BHXH/BHYT/BHTN, PIT, Net Salary và Employer Cost.
- Payroll đi qua DRAFT → CALCULATED → REVIEWING → APPROVED → LOCKED → PAID.
- Employee xem Payslip cá nhân sau phát hành; Manager/System Admin không xem lương ngoài quyền.

### 6.7. Monthly Timesheet Closing

- Tạo kỳ công theo tháng.
- Theo dõi trạng thái `OPEN`, `REVIEWING`, `READY_TO_CLOSE`, `CLOSED`.
- Tổng hợp ngày công theo nhân viên và phòng ban.
- Kiểm tra các lỗi chặn chốt công:
  - Thiếu check-in hoặc check-out.
  - Yêu cầu phê duyệt chưa xử lý.
  - Yêu cầu giải trình chưa hoàn tất.
  - Ngày công chưa xác định trạng thái cuối.
- Department Manager xác nhận bảng công của phòng ban.
- HR chốt kỳ sau khi các điều kiện bắt buộc được đáp ứng.
- Khóa dữ liệu thuộc kỳ đã chốt.
- Mở lại kỳ phải có lý do và audit log.
- Xuất bảng tổng hợp CSV/Excel.

### 6.8. Audit and Reporting

- Audit login, logout, đổi/reset mật khẩu.
- Audit thay đổi workplace, shift và assignment.
- Audit check-in/check-out và bằng chứng.
- Audit approve, reject, clarification và response.
- Audit thao tác chốt hoặc mở lại kỳ công.
- Dashboard thống kê nhân viên đã check-in, đã hoàn thành và đang chờ duyệt.

---

## 7. Must-have Flows

### Flow 1 — User, Role & Attendance Configuration Management (REQUIRED)

```text
Admin đăng nhập
→ tạo Workplace và cấu hình geofence
→ cấu hình Network/IP được phép
→ tạo Shift
→ tạo Employee/Department Manager/HR
→ gán Workplace + Shift + Department Manager
→ cấp tài khoản và mật khẩu tạm thời
→ người dùng đăng nhập và đổi mật khẩu
```

**Kết quả:** Nhân viên có đầy đủ cấu hình và có thể bắt đầu chấm công.

### Flow 2 — Employee Check-in/Check-out & Evidence Management (REQUIRED)

```text
Employee đăng nhập
→ xem ca và nơi làm việc hôm nay
→ chọn IN_OFFICE hoặc OUT_OFFICE
→ hệ thống xác minh Network/GPS/Selfie
→ backend ghi nhận Check-in bằng server time
→ Employee thực hiện Check-out bằng bằng chứng mới
→ backend tính tổng giờ, đi trễ và về sớm
→ Employee xem lịch sử ngày công
```

**Kết quả:** Một ngày công hoàn chỉnh được lưu bền vững, không bị tạo trùng.

### Flow 3 — Attendance Approval & Clarification Workflow (REQUIRED)

```text
Employee gửi Selfie (tự tạo ApprovalRequest)
→ hệ thống tạo ApprovalRequest
→ Department Manager xem bằng chứng
→ Department Manager chọn Approve / Reject / Request Clarification
→ nếu cần, Employee gửi giải trình
→ yêu cầu trở lại Pending
→ Department Manager đưa ra quyết định cuối cùng
→ Employee thấy trạng thái mới sau khi tải lại
```

**Kết quả:** Bản ghi bất thường được xử lý minh bạch và có audit trail.

> MVP chỉ tự tạo ApprovalRequest cho **SELFIE**; GPS anomaly là SHOULD (geo-verification ngoài bán kính hiển thị cảnh báo, không tự tạo request duyệt).

### Flow 4 — Monthly Timesheet Review & Closing (REQUIRED)

```text
HR mở kỳ công tháng
→ hệ thống tổng hợp dữ liệu của từng nhân viên
→ Department Manager rà soát dữ liệu phòng ban
→ xử lý hết bản ghi thiếu hoặc Pending
→ Department Manager xác nhận phòng ban sẵn sàng
→ HR kiểm tra điều kiện chốt
→ HR chốt và khóa kỳ công
→ hệ thống tạo snapshot tổng hợp
→ HR xuất CSV/Excel
```

**Kết quả:** Kỳ công được khóa và tạo PayrollInputSnapshot làm nguồn duy nhất cho tính lương.

### Flow 4A — Employee, Contract & Payroll (REQUIRED)

```text
HR tạo EmployeeProfile + Position + Contract
→ cấu hình Salary/Insurance/Tax profiles
→ chốt Timesheet
→ tạo PayrollInputSnapshot
→ tính/review/approve/lock Payroll
→ phát hành Payslip cho Employee
```

### Flow 4B — Overtime Request & Automatic Classification (REQUIRED)

```text
Employee gửi OT không chọn loại
→ Manager duyệt approved window
→ Employee thực hiện attendance
→ backend tự classify và tính eligible OT
→ HR rà soát
→ kết quả FINAL vào bảng công tháng
```

---

## 8. Nice-to-have Flows

### Flow 5 — Adjustment Request After Closing (OPTIONAL)

- Employee hoặc HR tạo yêu cầu điều chỉnh ngày công.
- Bắt buộc nêu lý do và đính kèm bằng chứng nếu cần.
- Department Manager/HR xem xét yêu cầu.
- Nếu được chấp nhận, hệ thống tạo phiên bản điều chỉnh thay vì ghi đè dữ liệu cũ.
- Lưu giá trị trước/sau và người phê duyệt trong audit log.

### Flow 6 — Dashboard, Notification & Export (OPTIONAL)

- Dashboard theo ngày, tháng và phòng ban.
- Thông báo trong ứng dụng khi yêu cầu được xử lý.
- Nhắc Department Manager về yêu cầu sắp quá hạn.
- Nhắc HR khi kỳ công sẵn sàng chốt.
- Export CSV/Excel theo biểu mẫu tùy chỉnh.
- Gửi email thông báo sau khi chốt công.

### Flow 7 — Advanced Security and Analytics (OPTIONAL)

- Refresh token rotation hoặc session rotation.
- Cảnh báo đăng nhập bất thường.
- Phát hiện mẫu chấm công bất thường.
- Thống kê xu hướng đi trễ/về sớm.
- Bản đồ tổng hợp vị trí chấm công ngoài văn phòng.
- Nhận diện khuôn mặt/liveness detection ở giai đoạn sau.

---

## 9. Core Business Rules

| Code | Business Rule |
|---|---|
| BR-AUTH-01 | Mọi API ngoài login/reset password phải yêu cầu session hợp lệ. |
| BR-RBAC-01 | Backend kiểm tra quyền trên từng API và từng resource. |
| BR-SCOPE-01 | Employee chỉ xem và thao tác dữ liệu của chính mình. |
| BR-MGR-01 | Department Manager chỉ xử lý nhân viên được phân công. |
| BR-DAY-01 | Một nhân viên chỉ có một AttendanceDay cho mỗi ngày làm việc. |
| BR-ORDER-01 | Không được check-out trước check-in. |
| BR-DUP-01 | Không tạo hai check-in hoặc hai check-out hợp lệ trong cùng ngày. |
| BR-MODE-01 | Work mode được chọn lúc check-in và giữ nguyên đến hết ngày. |
| BR-METHOD-01 | Backend quyết định phương thức Network, GPS hoặc Selfie. |
| BR-TIME-01 | Thời gian chính thức lấy từ backend/database. |
| BR-GPS-01 | Backend tự tính khoảng cách và không tin kết quả từ frontend. |
| BR-NET-01 | Public IP lấy từ request hoặc trusted proxy, không lấy từ payload frontend. |
| BR-SELFIE-01 | Mỗi event Selfie phải sử dụng ảnh và vị trí mới. |
| BR-EVID-01 | Evidence là private resource và phải kiểm tra authorization khi truy cập. |
| BR-IDEM-01 | Mutation chấm công phải có Idempotency-Key. |
| BR-CLOSE-01 | Không được chốt kỳ khi còn bản ghi Pending hoặc ngày công chưa hoàn tất. |
| BR-CLOSE-02 | Dữ liệu thuộc kỳ đã chốt không được chỉnh sửa trực tiếp. |
| BR-CLOSE-03 | Mở lại kỳ công bắt buộc nhập lý do và ghi audit log. |
| BR-AUDIT-01 | Các thao tác quan trọng phải được lưu audit. |
| BR-DELETE-01 | Dữ liệu có lịch sử không được hard-delete. |

---

## 10. Main Entities

- `User`
- `UserSession`
- `EmployeeProfile`
- `Position`
- `EmploymentContract`
- `EmployeeDocument`
- `Workplace`
- `AllowedNetwork`
- `ShiftTemplate`
- `RecurringSchedule`
- `WorkSchedule`
- `EmployeeAssignment`
- `AttendanceDay`
- `AttendanceEvent`
- `Evidence`
- `ApprovalRequest`
- `ApprovalHistory`
- `TimesheetPeriod`
- `TimesheetSummary`
- `TimesheetClosingHistory`
- `AdjustmentRequest`
- `OvertimeRequest`
- `OvertimeResult`
- `SalaryProfile`
- `LaborCompliancePolicy`
- `OvertimePayPolicy`
- `InsuranceProfile`, `InsurancePolicy`
- `TaxProfile`, `TaxPolicy`, `DependentRegistration`
- `PayrollInputSnapshot`, `PayrollRun`, `Payslip`
- `AuditLog`
- `IdempotencyRecord`

---

## 11. Suggested Technology Stack

| Layer | Suggested Technology |
|---|---|
| Web MVP | ReactJS + TypeScript + Vite + responsive CSS/Tailwind CSS |
| Mobile 【SHOULD】 | React Native + Expo + TypeScript; port Employee + Department Manager flow sau khi responsive web desktop/mobile đã nghiệm thu |
| Backend | NestJS + TypeScript + Mongoose + Swagger/OpenAPI |
| Database | MongoDB replica set; transaction và compound indexes tenant-scoped |
| Authentication | HttpOnly cookie cho web; SecureStore cho mobile; refresh/session rotation |
| File storage | Private local cho demo hoặc S3-compatible storage |
| Testing | Jest/Supertest, Vitest, Playwright; unit, integration/API và E2E |
| Deployment | MongoDB Atlas (replica set) + HTTPS hosting; không dùng Docker |

---

## 12. Project Scope Boundaries

### Trong phạm vi MVP

- Authentication và RBAC.
- Admin quản lý tài khoản và cấu hình chấm công.
- Employee check-in/check-out.
- Full-time office scheduling do HR cấu hình.
- Overtime request, automatic classification và eligible calculation.
- Network/GPS/Selfie evidence.
- Approval và clarification workflow.
- Lịch sử và chi tiết ngày công.
- Tổng hợp/chốt kỳ công và tạo PayrollInputSnapshot.
- Quản lý Employee/Position/Contract/Document.
- Salary/Insurance/Tax profiles và policy versioning.
- Tính Gross, OT pay, BHXH/BHYT/BHTN, PIT, Net Salary, Employer Cost và Payslip.
- Audit log cho nghiệp vụ chính.
- Mock data/seed data phục vụ demo.

### Ngoài phạm vi MVP

- Chuyển khoản ngân hàng, quyết toán PIT năm và kê khai điện tử BHXH/thuế.
- Leave nâng cao (quota/accrual/half-day/hourly/carry-over/balance; **không** bao gồm flow request→Manager→HR apply thuộc MVP).
- Nhận diện khuôn mặt bằng AI.
- Theo dõi vị trí liên tục trong nền.
- Chấm công offline và đồng bộ sau.
- Máy chấm công vân tay.
- React Native/Expo trước khi responsive web desktop/mobile được nghiệm thu; native mobile là phase SHOULD sau Mốc Web, không phải acceptance gate của Web MVP.
- Billing/subscription SaaS.

---

## 13. Demo Accounts and Mock Scenarios

| Account | Password | Role | Demo Scenario |
|---|---|---|---|
| `CS-EMP-01` | `Employee@123` | Employee (`EMPLOYEE`) | Check-in/check-out GPS/Selfie, gửi OT/adjustment, xem Payslip cá nhân. |
| `CS-MGR-01` | `Manager@123` | Department Manager (`DEPARTMENT_MANAGER`) | Duyệt Selfie/OT/adjustment và xác nhận bảng công phòng ban. |
| `CS-HR-01` | `HR@123` | HR / Payroll Officer (`HR`) | Quản lý hồ sơ, policy, chốt công, tính/khóa Payroll và phát hành Payslip. |
| `CS-SYS-01` | `SystemAdmin@123` | System Administrator (`SYSTEM_ADMIN`) | Quản lý Organization và HR đầu tiên; không xem dữ liệu lương tenant. |

---

## 14. Hero Demo Flow

```text
System Admin tạo Organization + HR
→ HR tạo Employee/Position/Contract và ca Full-time
→ Employee check-in/out, gửi LeaveRequest/OT/adjustment
→ Manager duyệt; HR apply leave vào ngày công
→ Manager xử lý yêu cầu
→ HR chốt công
→ hệ thống tạo PayrollInputSnapshot
→ HR tính/review/lock Payroll
→ Employee xem Payslip có Gross, bảo hiểm, PIT và Net Salary
```

---

## 15. Expected Outcomes

Sau khi hoàn thành dự án, nhóm sinh viên có thể chứng minh:

- Khả năng phân tích và hiện thực hóa quy trình nghiệp vụ nhiều vai trò.
- Thiết kế responsive cho mobile, tablet và desktop.
- Xây dựng API, database và authentication thực tế.
- Áp dụng RBAC và resource-level authorization.
- Xử lý upload file và dữ liệu GPS an toàn.
- Thiết kế state machine cho attendance, overtime, approval, adjustment, timesheet period và payroll.
- Áp dụng transaction, idempotency và unique constraints.
- Xây dựng chốt công, snapshot payroll, insurance/PIT engine và Payslip có thể đối chiếu.
- Viết unit test, integration test và end-to-end test.
- Triển khai một ứng dụng full-stack có thể demo hoàn chỉnh.

---

## 16. Short Version for Spreadsheet Cell

### Actors

```text
Employee (EMPLOYEE)
Department Manager (DEPARTMENT_MANAGER, alias Approver)
HR / Payroll Officer (HR)
System Administrator (SYSTEM_ADMIN)
```

### Main Features

```text
Employee:
+ View/update permitted profile and contract information.
+ Check in/out via Network, GPS or Selfie + GPS.
+ View schedule, attendance history, timesheet and released Payslip.
+ Submit LeaveRequest, OT, clarification and adjustment-before-close requests.

Department Manager:
+ View employees and attendance in assigned departments.
+ Approve/reject/clarify Selfie, Leave, OT and adjustment requests.
+ Confirm department timesheet; cannot self-approve requests.
+ View own Payslip only, not department salary data.

HR / Payroll Officer:
+ Manage EmployeeProfile, Position, Contract, Document and Full-time schedules.
+ Apply approved LeaveRequest into attendance days (sole path for PAID/UNPAID leave overrides).
+ Resolve attendance blockers.
+ Configure versioned Labor/OT/Insurance/Tax policies and salary profiles.
+ Clone/custom AttendanceBonus templates and enable/create Allowances.
+ Close/reopen timesheets and create immutable PayrollInputSnapshot.
+ Calculate/review/approve/lock Payroll and release Payslips.

System Administrator:
+ Manage Organizations and initial HR accounts.
+ Monitor platform health/audit; cannot process attendance/payroll or view tenant salaries.
```

### Must Have

```text
Flow 1: User, Role & HR Configuration Management (REQUIRED)
Flow 2: Employee Check-in/Check-out & Evidence Management (REQUIRED)
Flow 3: Attendance Approval & Clarification Workflow (REQUIRED)
Flow 4: Monthly Timesheet Review & Closing (REQUIRED)
Flow 4A: Employee, Contract & Payroll (REQUIRED)
Flow 4B: Overtime Request & Automatic Classification (REQUIRED)
Adjustment: Adjustment Request before close (REQUIRED)
Leave: Employee request → Manager approve → HR apply (REQUIRED)
Compensation: Attendance Bonus templates + Allowance hybrid (REQUIRED)
```

### Nice to Have

```text
Flow 5: Adjustment Request After Closing via Reopen (OPTIONAL)
Flow 6: Dashboard, Notification & Custom Report Export (OPTIONAL)
Flow 7: Advanced Security and Analytics (OPTIONAL)
```
