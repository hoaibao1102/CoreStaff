# Work Credit Policy

## Mục đích

`WorkCreditPolicy` quy đổi dữ liệu chấm công đã xác định thành đơn vị công trả lương có thể kiểm toán. Policy không sửa `AttendanceDay`; dữ liệu chấm công tiếp tục là dữ kiện, còn kết quả quy đổi được tạo trong projection và đóng băng khi HR chốt kỳ công.

## Phân lớp dữ liệu

1. `AttendanceDay`: giờ vào/ra, phút làm, đi muộn/về sớm và trạng thái chấm công.
2. Period obligation projection: tập nhân viên/ngày phải xét, lịch, ca, nghỉ phép, attendance và OT theo kỳ.
3. Employee review projection: dữ liệu an toàn cho nhân viên, gắn `periodVersion` và SHA-256 hash.
4. `TimesheetSummary`: kết quả work credit append-only khi HR close.
5. `PayrollInputSnapshot`: đầu vào payroll bất biến, trỏ trực tiếp tới summary.

Payroll không resolve lại WorkCreditPolicy và không tái tạo summary/snapshot khi calculate hoặc recalculate.

## Công thức theo ngày

Với ngày có nghĩa vụ làm việc:

```text
creditedMinutes = min(
  scheduledObligationMinutes,
  workedScheduledMinutes + payableLeaveMinutes
)
ratio = creditedMinutes / scheduledObligationMinutes
```

Kết quả:

- `ratio >= fullDayMinimumRatio` → `1.0` công.
- `ratio >= halfDayMinimumRatio` → `0.5` công.
- thấp hơn ngưỡng nửa ngày → `0` công.
- Nghỉ không lương không cộng vào `creditedMinutes`.
- Ngày nghỉ tuần/ngày lễ có `0` standard work unit; công làm thêm được xử lý qua OT.
- Ngày chưa xử lý thiếu punch là blocker; `FORFEITED_MISSING_PUNCH` là kết quả `0` công có audit.

`scheduledObligationMinutes` được lấy từ ca gốc sau break nhưng trước khi trừ leave. Không dùng `requiredWorkingMinutes` sau leave làm mẫu số.

## Effective dating

Policy thuộc một organization và có cửa sổ nửa mở:

```text
[effectiveFrom, effectiveTo)
```

Nếu không có `effectiveTo`, policy có hiệu lực vô thời hạn. Các policy active trong cùng organization không được chồng lấn.

Không có threshold mặc định trong production. Nếu một ngày nghĩa vụ không có policy hiệu lực, close phải dừng với `WORK_CREDIT_POLICY_MISSING`.

Tạo hoặc sửa WorkCreditPolicy phải tăng version của mọi kỳ chưa đóng giao với cửa sổ hiệu lực bị ảnh hưởng. Policy write và period invalidation dùng cùng MongoDB transaction; invalidation lỗi làm policy write thất bại.

## Review và xác nhận

Nhân viên chỉ được xem projection của chính mình. Response dùng allowlist và không chứa lương, thuế, bảo hiểm, người phụ thuộc, IP, Wi-Fi, GPS, địa chỉ, evidence, user-agent, raw metadata hoặc tọa độ nơi làm việc.

Acknowledge/dispute yêu cầu:

- `expectedPeriodVersion` hiện hành;
- `projectionHash` đúng nội dung đã xem;
- dispute có lý do hợp lệ.

Action được lưu append-only. Idempotency key gắn với action trước đó để retry cùng transition không tạo bản ghi trùng nhưng vẫn cho phép transition ngược hợp lệ sau đó.

Manager chỉ có quyền theo effective `ManagerAssignment`. Bất kỳ nhân viên nào `PENDING` hoặc `DISPUTED` đều chặn xác nhận phòng ban. Không có silent auto-acknowledgement hay exception endpoint khi authority/reason-code chưa được Product/HR phê duyệt.

## OT trong review và close

Review đọc OT đã duyệt ở trạng thái `PROVISIONAL` hoặc đã `FINAL`. Khi HR close, OT còn provisional được recompute/promote sang `FINAL`:

- nếu chỉ thay trạng thái và giá trị không đổi, không tăng `periodVersion`;
- nếu type/minutes/input hash thay đổi, tăng `periodVersion`, làm acknowledgement cũ hết hiệu lực.

Summary close chỉ đọc OT `FINAL`.

## Append-only và payroll lineage

Summary/snapshot mới được định danh theo:

```text
organizationId + periodId + sourcePeriodVersion + employeeProfileId
```

Không overwrite artifact của version cũ. Payroll run giữ exact snapshot IDs và snapshot-set hash; payslip giữ exact snapshot lineage. Recalculation dùng lại cùng snapshot set, không đọc policy/master data live.

## Reopen guard

Kỳ công chỉ được reopen bình thường khi chưa có payroll claim. Khi đã có run, backend chặn bằng CAS và Web hiển thị lý do. Payroll `CALCULATED`, `LOCKED` hoặc `RELEASED` không được biến thành stale bằng thao tác reopen thông thường.

## Trạng thái xác minh

Đã xác minh bằng unit tests, TypeScript typecheck và Web build không cần database.

Chưa xác minh do ràng buộc không truy cập database hiện có:

- Mongo transaction rollback và race thực;
- unique/partial indexes sau migration;
- migration dry-run/apply/verify/rollback;
- seed apply/idempotency/verifier;
- API integration, browser E2E và replica-set concurrency/failure injection.
