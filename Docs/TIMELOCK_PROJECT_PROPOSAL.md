# TimeLock — Employee Attendance & Timesheet Closing System

> **Tên tiếng Việt:** Hệ thống Chấm công, Phê duyệt và Chốt công Nhân viên  
> **Tên tiếng Anh:** TimeLock — Employee Attendance, Approval & Timesheet Closing System  
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
| Project Name (VI) | **TimeLock — Hệ thống Chấm công, Phê duyệt và Chốt công Nhân viên** |
| Project Name (EN) | **TimeLock — Employee Attendance, Approval & Timesheet Closing System** |

> `Lecturers` và số thứ tự chưa có thông tin nên được để `TBD`, tránh tự gán sai giảng viên phụ trách. TimeLock là đề xuất mới theo cấu trúc cột của bảng FA26_SWP391, không phải một dòng đã tồn tại trong bản Excel tham chiếu.

### Actors

1. **Employee**
2. **Approver / Department Manager**
3. **HR / Timekeeping Officer**
4. **System Administrator**

> Xem chi tiết luồng dữ liệu tại [TimeLock_Context_Diagram.md](./TimeLock_Context_Diagram.md) và sơ đồ ca sử dụng tại [Use case diagram.md](./Use case diagram.md).

### Main Features

Quản lý tài khoản và phân quyền; cấu hình nơi làm việc, mạng, GPS và ca làm; chấm công tại văn phòng bằng Network/GPS; chấm công ngoài văn phòng bằng Selfie + GPS; quản lý bằng chứng; phê duyệt ngoại lệ; giải trình; lịch sử ngày công; tổng hợp và chốt kỳ công; báo cáo và audit log.

### Must Have

| Flow | Nội dung | Mức ưu tiên |
|---|---|---|
| Flow 1 | User, Role & Attendance Configuration Management | REQUIRED |
| Flow 2 | Employee Check-in/Check-out & Evidence Management | REQUIRED |
| Flow 3 | Attendance Approval & Clarification Workflow | REQUIRED |
| Flow 4 | Monthly Timesheet Review & Closing | REQUIRED |

### Nice to Have

| Flow | Nội dung | Mức ưu tiên |
|---|---|---|
| Flow 5 | Adjustment Request After Closing | OPTIONAL |
| Flow 6 | Dashboard, Notification & Export | OPTIONAL |
| Flow 7 | Advanced Security and Analytics | OPTIONAL |

---

## 2. Project Name

### Tên chính thức

**TimeLock — Hệ thống Chấm công, Phê duyệt và Chốt công Nhân viên**

### Tên tiếng Anh

**TimeLock — Employee Attendance, Approval & Timesheet Closing System**

### Tagline

> **Chấm công. Duyệt công. Chốt công.**  
> *Track every minute. Close every period with confidence.*

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

TimeLock giải quyết toàn bộ vòng đời từ lúc nhân viên chấm công đến khi dữ liệu được quản lý phê duyệt và bộ phận nhân sự chốt kỳ công.

---

## 4. Project Objectives

- Xây dựng hệ thống chấm công độc lập có đăng nhập và phân quyền theo vai trò.
- Hỗ trợ nhân viên chấm công tại văn phòng và ngoài văn phòng.
- Xác minh bản ghi bằng Network, GPS hoặc Selfie kết hợp vị trí.
- Quản lý bằng chứng chấm công có kiểm soát truy cập.
- Cung cấp quy trình duyệt, từ chối và yêu cầu giải trình.
- Cho phép nhân viên theo dõi lịch sử và trạng thái xử lý ngày công.
- Tổng hợp dữ liệu theo tháng và thực hiện chốt/khóa kỳ công.
- Bảo đảm dữ liệu đã chốt không bị thay đổi tùy ý.
- Lưu audit log cho các thao tác quan trọng.
- Tạo một sản phẩm responsive có thể trình diễn trên điện thoại, tablet và desktop.
- Hỗ trợ full-time/part-time bằng lịch do HR cấu hình, không hard-code giờ ca hành chính.
- Cho phép đăng ký ca, đổi ca có đồng thuận và OT được hệ thống tự phân loại/tính từ lịch thực tế.

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
- Gửi giải trình khi quản lý yêu cầu.
- Xem bảng tổng hợp công cá nhân trước và sau khi kỳ công được chốt.

### 5.2. Approver / Department Manager — Người phê duyệt / Quản lý phòng ban

- Là nhân viên có thêm quyền quản lý và sử dụng cùng một tài khoản cho cả hai phạm vi.
- Check-in/check-out, xem lịch sử và điều chỉnh công cá nhân qua mục **Công của tôi** khi có assignment hợp lệ.
- Không được tự duyệt yêu cầu chấm công hoặc AdjustmentRequest của chính mình; request phải chuyển cho HR/người quản lý khác đủ quyền.
- Xem yêu cầu thuộc các nhân viên được phân công quản lý.
- Tìm kiếm và lọc yêu cầu theo nhân viên, trạng thái, ngày và phương thức.
- Xem ảnh Selfie, tọa độ GPS, độ chính xác và thời gian server.
- Xem cảnh báo như chấm công ngoài geofence hoặc hai địa điểm cách xa nhau.
- Phê duyệt bản ghi hợp lệ.
- Từ chối và bắt buộc nhập lý do.
- Yêu cầu nhân viên giải trình.
- Xem phản hồi của nhân viên và đưa ra quyết định cuối cùng.
- Theo dõi audit timeline của yêu cầu.
- Xác nhận dữ liệu phòng ban đã sẵn sàng để chốt công.

### 5.3. HR / Timekeeping Officer — Nhân sự / Nhân viên chấm công

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
- Xuất bảng tổng hợp CSV/Excel phục vụ xử lý lương bên ngoài.
- Xử lý hoặc phối hợp xử lý yêu cầu điều chỉnh ngày công.

### 5.4. System Administrator — Quản trị viên hệ thống

- Không thuộc workforce của tenant và không có chức năng check-in/check-out.
- Quản lý tài khoản người dùng.
- Gán vai trò Employee, Approver, HR và Administrator.
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

### 6.2A. Full-time, Part-time and Scheduling

- HR tạo và cấu hình ShiftTemplate; ca 08:00–17:00 chỉ là dữ liệu seed/demo.
- Full-time sử dụng lịch lặp RecurringSchedule.
- Part-time đăng ký ca theo ngày; Department Manager duyệt trước khi tạo WorkSchedule chính thức.
- MVP chỉ hỗ trợ ca trong cùng ngày, một lịch/ngày và không hỗ trợ ca qua đêm.
- Đổi ca cần người nhận đồng ý, sau đó Department Manager phê duyệt và hệ thống cập nhật cả hai lịch trong một transaction.

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

- Selfie tạo yêu cầu phê duyệt tự động.
- GPS bất thường có thể tạo yêu cầu xem xét.
- Approver xem danh sách yêu cầu trong phạm vi quản lý.
- Approve, Reject hoặc Request Clarification.
- Reject bắt buộc có lý do.
- Request Clarification bắt buộc có nội dung.
- Nhân viên gửi phản hồi; yêu cầu trở lại trạng thái Pending.
- Quyết định được lưu trong transaction và có audit trail.

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
- HR rà soát và hệ thống tính lại kết quả FINAL khi chốt kỳ; không tính tiền/hệ số lương.

### 6.7. Monthly Timesheet Closing

- Tạo kỳ công theo tháng.
- Theo dõi trạng thái `OPEN`, `REVIEWING`, `READY_TO_CLOSE`, `CLOSED`.
- Tổng hợp ngày công theo nhân viên và phòng ban.
- Kiểm tra các lỗi chặn chốt công:
  - Thiếu check-in hoặc check-out.
  - Yêu cầu phê duyệt chưa xử lý.
  - Yêu cầu giải trình chưa hoàn tất.
  - Ngày công chưa xác định trạng thái cuối.
- Approver xác nhận bảng công của phòng ban.
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
→ tạo Employee/Approver/HR
→ gán Workplace + Shift + Approver
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
Employee gửi Selfie hoặc phát sinh ngoại lệ GPS
→ hệ thống tạo ApprovalRequest
→ Approver xem bằng chứng
→ Approver chọn Approve / Reject / Request Clarification
→ nếu cần, Employee gửi giải trình
→ yêu cầu trở lại Pending
→ Approver đưa ra quyết định cuối cùng
→ Employee thấy trạng thái mới sau khi tải lại
```

**Kết quả:** Bản ghi bất thường được xử lý minh bạch và có audit trail.

### Flow 4 — Monthly Timesheet Review & Closing (REQUIRED)

```text
HR mở kỳ công tháng
→ hệ thống tổng hợp dữ liệu của từng nhân viên
→ Approver rà soát dữ liệu phòng ban
→ xử lý hết bản ghi thiếu hoặc Pending
→ Approver xác nhận phòng ban sẵn sàng
→ HR kiểm tra điều kiện chốt
→ HR chốt và khóa kỳ công
→ hệ thống tạo snapshot tổng hợp
→ HR xuất CSV/Excel
```

**Kết quả:** Kỳ công được khóa, dữ liệu có thể dùng làm đầu vào cho quy trình tính lương bên ngoài.

### Flow 4A — Full-time/Part-time Schedule & Shift Swap (REQUIRED)

```text
HR cấu hình ShiftTemplate
→ sinh lịch Full-time hoặc mở đăng ký Part-time
→ Manager duyệt đăng ký
→ Employee A đề nghị đổi ca
→ Employee B đồng ý
→ Manager duyệt
→ hệ thống cập nhật lịch có audit
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
- Approver/HR xem xét yêu cầu.
- Nếu được chấp nhận, hệ thống tạo phiên bản điều chỉnh thay vì ghi đè dữ liệu cũ.
- Lưu giá trị trước/sau và người phê duyệt trong audit log.

### Flow 6 — Dashboard, Notification & Export (OPTIONAL)

- Dashboard theo ngày, tháng và phòng ban.
- Thông báo trong ứng dụng khi yêu cầu được xử lý.
- Nhắc Approver về yêu cầu sắp quá hạn.
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
| BR-APV-01 | Approver chỉ xử lý nhân viên được phân công. |
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
- `Workplace`
- `AllowedNetwork`
- `ShiftTemplate`
- `RecurringSchedule`
- `ShiftRegistration`
- `WorkSchedule`
- `ShiftSwapRequest`
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
- `AuditLog`
- `IdempotencyRecord`

---

## 11. Suggested Technology Stack

| Layer | Suggested Technology |
|---|---|
| Frontend | React + TypeScript + Vite + responsive CSS/Tailwind CSS |
| Backend | Node.js with NestJS/Express hoặc Spring Boot |
| Database | PostgreSQL |
| Authentication | HttpOnly cookie session hoặc access/refresh token có rotation |
| File storage | Private local storage cho demo; có abstraction để chuyển sang S3-compatible storage |
| Testing | Unit test, integration/API test và end-to-end test |
| Deployment | Docker + HTTPS hosting |

---

## 12. Project Scope Boundaries

### Trong phạm vi MVP

- Authentication và RBAC.
- Admin quản lý tài khoản và cấu hình chấm công.
- Employee check-in/check-out.
- Full-time recurring schedule và part-time shift registration.
- Shift swap có target consent và manager approval.
- Overtime request, automatic classification và eligible calculation.
- Network/GPS/Selfie evidence.
- Approval và clarification workflow.
- Lịch sử và chi tiết ngày công.
- Tổng hợp và chốt kỳ công.
- Audit log cho nghiệp vụ chính.
- Mock data/seed data phục vụ demo.

### Ngoài phạm vi MVP

- Tính lương, thuế và bảo hiểm.
- Quản lý nghỉ phép hoàn chỉnh.
- Nhận diện khuôn mặt bằng AI.
- Theo dõi vị trí liên tục trong nền.
- Chấm công offline và đồng bộ sau.
- Máy chấm công vân tay.
- Ứng dụng native iOS/Android.
- Multi-tenant SaaS.

---

## 13. Demo Accounts and Mock Scenarios

| Account | Password | Role | Demo Scenario |
|---|---|---|---|
| `TVS-0248` | `Employee@123` | Employee A | Check-in/check-out bằng GPS hợp lệ: cách workplace 24m, accuracy ±16m. |
| `TVS-0312` | `Employee@123` | Employee C | Làm ngoài văn phòng, chấm công bằng Selfie + GPS và tạo yêu cầu phê duyệt. |
| `TVS-0102` | `Approver@123` | Approver B | Xem và xử lý danh sách yêu cầu Selfie/GPS; approve, reject hoặc yêu cầu giải trình. |
| `TVS-0001` | `Admin@123` | Administrator | Xem dashboard và quản lý dữ liệu/cấu hình hệ thống. |

---

## 14. Hero Demo Flow

```text
Admin đăng nhập
→ xem cấu hình Workplace, Shift và tài khoản đã seed
→ Employee A đăng nhập và check-in bằng GPS
→ Employee C đăng nhập và check-in ngoài văn phòng bằng Selfie
→ Approver B đăng nhập, xem ảnh/vị trí và yêu cầu giải trình
→ Employee C phản hồi
→ Approver B phê duyệt
→ HR rà soát kỳ công và chốt tháng
→ hệ thống khóa dữ liệu và xuất bảng tổng hợp
```

---

## 15. Expected Outcomes

Sau khi hoàn thành dự án, nhóm sinh viên có thể chứng minh:

- Khả năng phân tích và hiện thực hóa quy trình nghiệp vụ nhiều vai trò.
- Thiết kế responsive cho mobile, tablet và desktop.
- Xây dựng API, database và authentication thực tế.
- Áp dụng RBAC và resource-level authorization.
- Xử lý upload file và dữ liệu GPS an toàn.
- Thiết kế state machine cho attendance, schedule registration/swap, overtime, approval và timesheet period.
- Áp dụng transaction, idempotency và unique constraints.
- Xây dựng báo cáo và quy trình khóa dữ liệu cuối kỳ.
- Viết unit test, integration test và end-to-end test.
- Triển khai một ứng dụng full-stack có thể demo hoàn chỉnh.

---

## 16. Short Version for Spreadsheet Cell

### Actors

```text
Employee
Approver / Department Manager
HR / Timekeeping Officer
System Administrator
```

### Main Features

```text
Employee:
+ Login using email/employee code and password.
+ View today’s shift, workplace and attendance status.
+ Check in/out at the office using Network or GPS.
+ Check in/out outside the office using Selfie and GPS evidence.
+ View attendance history, day details and approval status.
+ Submit clarification when requested.
+ View monthly timesheet summary and closing status.

Approver / Department Manager:
+ View attendance requests of assigned employees.
+ Review Selfie, GPS, server time, location accuracy and warnings.
+ Approve or reject attendance records.
+ Request employee clarification and review responses.
+ Confirm department timesheets are ready for monthly closing.

HR / Timekeeping Officer:
+ Review monthly attendance summaries by employee and department.
+ Detect missing check-in/out and unresolved approval requests.
+ Open, review, close and reopen timesheet periods with audit logs.
+ Lock data after closing and export CSV/Excel summaries.

System Administrator:
+ Manage users, roles and account status.
+ Manage workplaces, geofences, allowed networks and shifts.
+ Assign workplace, shift and approver to employees.
+ Configure attendance policies and evidence retention.
+ View system-wide audit logs.
```

### Must Have

```text
Flow 1: User, Role & Attendance Configuration Management (REQUIRED)
Flow 2: Employee Check-in/Check-out & Evidence Management (REQUIRED)
Flow 3: Attendance Approval & Clarification Workflow (REQUIRED)
Flow 4: Monthly Timesheet Review & Closing (REQUIRED)
```

### Nice to Have

```text
Flow 5: Adjustment Request After Closing (OPTIONAL)
Flow 6: Dashboard, Notification & Export (OPTIONAL)
Flow 7: Advanced Security and Analytics (OPTIONAL)
```
