# Kế hoạch refactor Ca làm việc — phạm vi và lịch lặp

## 1. Mục tiêu

Thay flow hiện tại gồm hai màn hình `Ca làm việc` và `Lịch lặp Full-time` bằng một flow duy nhất:

1. HR tạo ca làm việc.
2. Chọn phạm vi áp dụng:
   - `Toàn bộ công ty`;
   - `Phòng ban` và chọn đúng một phòng ban.
3. Chọn trực tiếp các ngày lặp trong tuần khi tạo hoặc sửa ca.
4. Không gắn ca với nơi làm việc.
5. Xóa màn hình, route và API `RecurringSchedule` độc lập.

Workplace vẫn tồn tại trong `Assignment` và Attendance để kiểm tra GPS, địa chỉ và hình thức chấm công. Việc bỏ workplace khỏi ca không có nghĩa là xóa workplace khỏi hệ thống.

## 2. Quy tắc nghiệp vụ chốt cho implementation

### 2.1 Phạm vi

Thêm enum:

```ts
ShiftScope = {
  ORGANIZATION: 'ORGANIZATION',
  DEPARTMENT: 'DEPARTMENT',
}
```

Quy tắc dữ liệu:

- Mỗi công ty có tối đa một ca chung `ORGANIZATION`, đồng thời có thể có các ca riêng `DEPARTMENT`.
- Mỗi phòng ban có tối đa một ca riêng; phòng ban đã có ca không xuất hiện trong dropdown tạo mới.
- Ca phòng ban được ưu tiên khi có hiệu lực; nếu không có ca phòng ban phù hợp thì dùng ca chung. Việc có ca phòng ban không ngăn tạo hoặc sửa ca chung.
- Form tạo mới để trống tên, ngày hiệu lực, giờ làm, số phút và chưa chọn ngày lặp. “Ca hành chính 1” chỉ là ví dụ trong placeholder.
- Modal chi tiết dùng badge trạng thái theo UI chung: xanh cho “Đang hoạt động”, xám cho “Ngưng hoạt động”.

| `scope` | `departmentId` | Ý nghĩa |
|---|---|---|
| `ORGANIZATION` | Không được có | Ca mặc định cho toàn bộ nhân viên trong organization |
| `DEPARTMENT` | Bắt buộc | Ca chỉ áp dụng cho nhân viên thuộc phòng ban đã chọn |

Mọi truy vấn phải tiếp tục lọc theo `organizationId`. `departmentId` phải thuộc cùng organization và đang active tại thời điểm tạo ca.

### 2.2 Quy tắc ưu tiên

UI dùng ô chọn giờ mặc định của trình duyệt như flow ban đầu; định dạng AM/PM hoặc 24 giờ tuân theo thiết lập vùng của thiết bị. Thông báo lỗi vượt giới hạn dùng tiếng/phút, ví dụ: “Giờ làm mỗi ngày là 11 tiếng, vượt quá 3 tiếng so với giới hạn 8 tiếng”. Trường ngày kết thúc tùy chọn không hiển thị dấu *.

Lịch tổ chức liên kết Chính sách lương tăng ca theo ngày:

- Khi tạo/sửa ngày lịch, API yêu cầu chính sách active của đúng công ty có hiệu lực tại ngày đó.
- Dropdown loại ngày gồm Ngày thường (`SPECIAL_WORKING_DAY`, giữ tương thích dữ liệu cũ), Ngày nghỉ tuần (`WEEKLY_OFF`), Ngày lễ (`PUBLIC_HOLIDAY`). UI hiển thị hệ số tương ứng `workingDayRate`, `weeklyOffRate`, `publicHolidayRate`, kèm phiên bản chính sách trong danh sách, form và chi tiết.
- Hệ số chỉ áp dụng cho giờ tăng ca được duyệt; không tự biến toàn bộ giờ làm trong ngày thành giờ tăng ca.
- Ngày lịch cũ thiếu chính sách vẫn hiển thị để HR bổ sung chính sách.

Ca tạo mới, ca chỉnh sửa và ca kích hoạt lại phải đáp ứng Chính sách tuân thủ lao động của cùng công ty:

- Phút làm/ngày = giờ kết thúc − giờ bắt đầu − thời gian nghỉ; thời gian nghỉ phải nhỏ hơn thời lượng ca.
- Phút làm/tuần = phút làm/ngày × số ngày lặp khác nhau.
- Kiểm tra các giới hạn `normalDailyMinutes`, `normalWeeklyMinutes`, `maxCombinedDailyMinutes` bằng bộ đánh giá chính sách hiện có. Đúng giới hạn được phép, vượt giới hạn bị chặn.
- Chính sách phải bao phủ khoảng hiệu lực của ca, bao gồm các phiên bản tương lai đã cấu hình. Ca không có ngày kết thúc cần chính sách bao phủ không thời hạn.
- Form tạo/sửa hiển thị lỗi API khi thiếu chính sách, vượt giờ ngày/tuần hoặc thời gian nghỉ không hợp lệ.
- Kiểm tra này đánh giá mẫu ca; hạn mức tăng ca tháng/năm cần dữ liệu tăng ca thực tế và được xử lý ở luồng tăng ca.

Khi xác định ca của một nhân viên trong một ngày:

1. Tìm ca active phạm vi `DEPARTMENT` khớp phòng ban, ngày trong tuần và khoảng hiệu lực.
2. Nếu không có, dùng ca active phạm vi `ORGANIZATION` khớp ngày và khoảng hiệu lực.
3. Nếu không có cả hai thì ngày đó không có nghĩa vụ làm việc, trừ `SPECIAL_WORKING_DAY` từ Organization Calendar.

Như vậy ca phòng ban luôn ghi đè ca toàn công ty.

### 2.3 Chống cấu hình chồng lấn

Trong cùng organization không cho phép hai ca active:

- cùng scope;
- cùng `departmentId` nếu scope là `DEPARTMENT`;
- có ít nhất một weekday giống nhau;
- có khoảng hiệu lực giao nhau.

Ca phòng ban và ca toàn công ty được phép trùng nhau vì ca phòng ban có độ ưu tiên cao hơn.

### 2.4 Lịch lặp

- `weekdays` dùng ISO weekday: `1 = Thứ 2`, ..., `7 = Chủ nhật`.
- Bắt buộc chọn ít nhất một ngày.
- `effectiveFrom` bắt buộc.
- `effectiveTo` tùy chọn; nếu có phải lớn hơn hoặc bằng `effectiveFrom`.
- Việc sửa ngày lặp chỉ ảnh hưởng phân loại/chấm công từ cấu hình hiện tại; không tạo WorkSchedule snapshot.

## 3. Thiết kế dữ liệu mới

Mở rộng `ShiftTemplate`:

```ts
interface ShiftTemplate {
  organizationId: ObjectId;
  code: string;
  name: string;
  scope: 'ORGANIZATION' | 'DEPARTMENT';
  departmentId?: ObjectId;
  weekdays: number[];
  effectiveFrom: string;
  effectiveTo?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  gracePeriodMinutes: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Thay đổi:

- Xóa `workplaceId` khỏi `ShiftTemplate`.
- Xóa schema và collection `RecurringSchedule` sau migration.
- Giữ `Assignment.workplaceId` cho Attendance.
- `Assignment.shiftTemplateId` chuyển thành trường legacy, không còn là nguồn xác định ca chính. Có thể xóa ở migration sau khi toàn bộ Attendance dùng resolver mới.

Indexes đề xuất:

```ts
{ organizationId: 1, code: 1 } unique
{ organizationId: 1, scope: 1, departmentId: 1, active: 1 }
{ organizationId: 1, effectiveFrom: 1, effectiveTo: 1 }
```

Overlap theo weekday và khoảng ngày phải kiểm tra ở service, không thể chỉ dựa vào unique index.

## 4. API mới

### `POST /api/hr/shift-templates`

Payload:

```json
{
  "code": "OFFICE-01",
  "name": "Ca hành chính",
  "scope": "DEPARTMENT",
  "departmentId": "...",
  "weekdays": [1, 2, 3, 4, 5],
  "effectiveFrom": "2026-10-01",
  "effectiveTo": null,
  "startTime": "08:00",
  "endTime": "17:00",
  "breakMinutes": 60,
  "gracePeriodMinutes": 10
}
```

Validation:

- `code` unique trong organization;
- scope/department tuân thủ bảng ở mục 2.1;
- weekdays từ 1 đến 7, không trùng;
- khoảng ngày hợp lệ;
- giờ bắt đầu trước giờ kết thúc;
- không overlap với ca active cùng scope.

### `GET /api/hr/shift-templates`

Filters mới:

- `scope`;
- `departmentId`;
- `active`;
- giữ search phía client hoặc bổ sung `query` sau.

Xóa filter `workplaceId`.

### `PATCH /api/hr/shift-templates/:id`

Cho phép sửa scope, department, weekdays, khoảng hiệu lực và giờ ca. Service phải validate document sau khi merge patch, không chỉ validate từng field được gửi lên.

### API resolver dùng nội bộ

Tạo `ShiftResolverService.resolveForEmployeeDate(organizationId, employeeId, date)` để dùng chung cho:

- Attendance today/check-in/check-out;
- DayClassificationService;
- Attendance history và timesheet sau này.

Không mở API ghi lịch lặp riêng.

### API phải xóa

- `POST /api/hr/recurring-schedules`;
- `GET /api/hr/recurring-schedules`;
- `GET /api/hr/recurring-schedules/:id`;
- `PATCH /api/hr/recurring-schedules/:id`;
- activate/deactivate endpoints của recurring schedule.

## 5. Flow UI mới

### Màn hình Quản lý ca làm việc

Header và danh sách giữ design system hiện tại.

Bộ lọc:

- tìm mã hoặc tên ca;
- phạm vi: tất cả / toàn công ty / phòng ban;
- phòng ban, chỉ hiện khi lọc phạm vi phòng ban;
- trạng thái.

Cột bảng:

1. Mã và tên ca;
2. Phạm vi;
3. Ngày lặp;
4. Giờ làm;
5. Khoảng hiệu lực;
6. Trạng thái;
7. Thao tác.

Không còn cột hoặc filter nơi làm việc.

### Dialog Tạo ca làm việc

Thứ tự field:

1. Mã ca;
2. Tên ca;
3. Phạm vi dạng radio/card:
   - Toàn bộ công ty;
   - Phòng ban.
4. Chọn phòng ban, chỉ hiện và bắt buộc khi chọn `Phòng ban`;
5. Ngày lặp dạng nút T2–CN, mặc định T2–T6;
6. Hiệu lực từ / đến ngày;
7. Giờ bắt đầu / kết thúc;
8. Thời gian nghỉ;
9. Grace period.

Khi đổi từ `DEPARTMENT` sang `ORGANIZATION`, client phải xóa `departmentId` khỏi form và payload.

Dialog sửa và chi tiết phải hiển thị cùng mô hình dữ liệu. Không giữ bất kỳ field workplace nào.

### Điều hướng phải xóa

- Sidebar `Lịch lặp Full-time`;
- route `/hr/schedules`;
- `RecurringScheduleScreen.tsx`;
- recurring schedule functions trong `scheduling.service.ts`;
- test FE riêng cho recurring schedule.

## 6. Migration dữ liệu

Không drop `recurring_schedules` trước khi migration hoàn tất.

Quy trình:

1. Backup/count `shift_templates` và `recurring_schedules`.
2. Với mỗi recurring schedule hiện có:
   - resolve employee profile và department;
   - lấy shift template cũ;
   - nhóm theo organization, department, shift times, weekdays và khoảng hiệu lực;
   - tạo ca mới scope `DEPARTMENT`;
   - nếu một template cũ được dùng cho nhiều department thì tạo bản sao với code có suffix department.
3. Template không có recurring schedule được chuyển thành scope `ORGANIZATION`, weekdays T2–T6 và `effectiveFrom` bằng ngày migration hoặc ngày cấu hình được chốt.
4. Đối chiếu số rule trước/sau và chạy dry-run report.
5. Chỉ sau khi verify mới drop collection `recurring_schedules` và gỡ schema/code.

Seed Nguyễn Văn An phải chuyển từ tạo RecurringSchedule sang tạo ShiftTemplate scope `DEPARTMENT` cho Engineering.

## 7. Thứ tự triển khai

### Phase 1 — Domain và migration

- Thêm `ShiftScope` enum.
- Mở rộng ShiftTemplate schema/DTO.
- Viết overlap validator.
- Viết migration dry-run và apply.
- Thêm `ShiftResolverService`.

### Phase 2 — Chuyển consumer

- Attendance dùng ShiftResolverService thay vì `Assignment.shiftTemplateId`.
- DayClassificationService dùng ShiftResolverService thay vì RecurringSchedule.
- Cập nhật LeaveModule/AttendanceModule dependency.

### Phase 3 — API cleanup

- Cập nhật ShiftTemplate controller/service.
- Xóa ScheduleModule nếu không còn consumer.
- Xóa RecurringSchedule schema/DTO/controller/service khỏi registry.
- Xóa collection sau verify migration.

### Phase 4 — FE

- Cập nhật types/service ShiftTemplate.
- Refactor màn hình danh sách.
- Refactor create/edit/detail dialogs.
- Xóa route, sidebar và screen lịch lặp.

### Phase 5 — Test và rollout

- Unit/integration/API contract tests.
- Chạy migration dry-run.
- Apply migration ở môi trường local/staging.
- Smoke test Attendance và Leave day classification.
- Build API/Web.

## 8. Acceptance criteria

- Form tạo ca không còn nơi làm việc.
- HR chọn được chính xác một trong hai scope.
- Scope phòng ban bắt buộc department hợp lệ cùng tenant.
- Scope toàn công ty không lưu departmentId.
- Bắt buộc chọn ít nhất một ngày lặp.
- Ca phòng ban ghi đè ca toàn công ty trong cùng ngày.
- Không tạo được hai ca active chồng lấn trong cùng scope.
- Attendance dùng đúng giờ, break và grace của ca được resolve.
- Public holiday/leave/weekly off tiếp tục phân loại đúng.
- Không còn sidebar, route, screen hoặc API RecurringSchedule.
- Không còn `workplaceId` trong ShiftTemplate/API/UI.
- Workplace của Assignment vẫn hoạt động cho GPS/chấm công.
- Migration chạy lại không tạo trùng.

## 9. Kiểm thử bắt buộc

### Backend

- Create company scope thành công và không có departmentId.
- Create department scope thiếu departmentId trả validation error.
- Department khác tenant hoặc inactive bị từ chối.
- Weekdays rỗng, trùng hoặc ngoài 1–7 bị từ chối.
- Effective range và time range không hợp lệ bị từ chối.
- Overlap cùng department/weekday bị từ chối.
- Department scope và organization scope được phép cùng hiệu lực.
- Resolver chọn department trước organization.
- Resolver trả null khi weekday không áp dụng.
- Attendance và classification dùng cùng resolver.
- Tenant isolation cho list/get/update/deactivate.

### Frontend

- Create payload company scope không gửi departmentId.
- Create payload department scope gửi departmentId.
- Đổi scope xóa department cũ.
- Weekday selector gửi đúng mảng ISO weekday.
- List/filter/detail/edit hiển thị đúng scope và ngày lặp.
- Không còn link `/hr/schedules`.

### Migration

- Dry-run không ghi dữ liệu.
- Nhiều employee cùng department/rule chỉ sinh một scoped shift phù hợp.
- Một template dùng nhiều department được tách đúng.
- Chạy apply lần hai không tạo duplicate.
- Chỉ drop recurring collection khi số liệu đối chiếu hợp lệ.

## 10. Các file dự kiến thay đổi

Backend:

- `database/schemas/shift-template.schema.ts`
- `database/schemas/enums.ts`
- `hr/shift-template/dto/create-shift-template.dto.ts`
- `hr/shift-template/shift-template.service.ts`
- `hr/shift-template/shift-template.controller.ts`
- `attendance/attendance.service.ts`
- `hr/leave/day-classification.service.ts`
- module wiring và schema registry
- migration/seed scripts

Frontend:

- `services/shift-template.service.ts`
- `screens/ShiftTemplates/ShiftTemplateScreen.tsx`
- `ShiftTemplateEditDialog.tsx`
- `ShiftTemplateDetailDialog.tsx`
- `components/Sidebar.tsx`
- `routes/WorkspaceRoutes.tsx`

Files sẽ xóa sau migration:

- `api/src/database/schemas/recurring-schedule.schema.ts`
- `api/src/hr/schedule/`
- `web/src/screens/Scheduling/RecurringScheduleScreen.tsx`
- `web/tests/recurring-schedules.test.tsx`

## 11. Điểm cần đặc biệt lưu ý khi code

- Không xóa Workplace khỏi Assignment hoặc Attendance.
- Không dùng `Assignment.shiftTemplateId` làm nguồn ca sau refactor.
- Không drop recurring data trước khi có dry-run report.
- Không để FE tự quyết định ca ưu tiên; quy tắc phải nằm trong ShiftResolverService.
- Resolver phải được dùng chung để Attendance và day classification không cho kết quả khác nhau.
