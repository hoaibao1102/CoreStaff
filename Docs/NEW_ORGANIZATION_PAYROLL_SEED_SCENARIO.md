# Kịch bản seed dữ liệu Organization mới để test Snapshot và Payroll

> **Phạm vi:** CoreStaff — tạo một tenant/Organization độc lập, có đủ master data, chính sách, hồ sơ nhân viên và dữ liệu kỳ công để chạy luồng thật từ rà soát công đến phát hành phiếu lương.
>
> **Nguyên tắc quan trọng:** seed **đầu vào nghiệp vụ**, không seed thẳng trạng thái cuối. `TimesheetSummary`, `PayrollInputSnapshot`, `PayrollRun` và `Payslip` phải được tạo bởi service/API thật trong luồng test.

---

## 1. Mục tiêu và tiêu chí hoàn thành

Bộ seed được xem là đạt khi có thể chạy trọn luồng:

```text
Tạo Organization
→ cấu hình cơ cấu, lịch, ca và phân quyền
→ tạo nhân viên, hợp đồng, lương và hồ sơ thuế/bảo hiểm
→ cấu hình phụ cấp, chuyên cần, KPI, OT và các policy hiệu lực
→ tạo kỳ công OPEN cùng dữ liệu chấm công/nghỉ phép/OT
→ Manager preview và chốt snapshot từng phòng ban
→ kỳ chuyển READY_TO_CLOSE
→ HR đóng kỳ thành CLOSED
→ kiểm tra đủ TimesheetSummary + PayrollInputSnapshot
→ tạo PayrollRun DRAFT
→ calculate thành CALCULATED và sinh Payslip
→ đối soát số tiền
→ lock thành LOCKED
→ release thành RELEASED
→ Employee xem Payslip của chính mình
```

### Tiêu chí bắt buộc

- [ ] Tất cả record nghiệp vụ cùng một `organizationId`; không tham chiếu chéo tenant.
- [ ] Mọi policy/profile dùng cho kỳ lương có hiệu lực tại ngày đầu kỳ và không chồng lấn khoảng hiệu lực.
- [ ] Mọi nhân viên thuộc phạm vi tính lương có `User`, `EmployeeProfile`, hợp đồng, assignment, salary profile và dữ liệu bảo hiểm cần thiết.
- [ ] Mỗi phòng ban có Manager hiệu lực để chốt snapshot; actor duyệt không tự duyệt dữ liệu của mình.
- [ ] Có đủ tình huống công bình thường, đi trễ, về sớm, nghỉ có lương, nghỉ không lương, vắng, thiếu punch và OT theo ba loại ngày.
- [ ] KPI dùng để tính lương ở trạng thái `CONFIRMED`, có `confirmedBy/confirmedAt` hợp lệ.
- [ ] OT dùng cho snapshot có `OvertimeResult.classificationStatus = FINAL` và `eligibleMinutes` đúng.
- [ ] Trước khi chạy workflow, không tồn tại `TimesheetSummary`, `PayrollInputSnapshot`, `PayrollRun` hoặc `Payslip` của fixture.
- [ ] Sau khi chốt, số snapshot hợp lệ bằng đúng số nhân viên trong scope.
- [ ] Payroll tính từ snapshot bất biến; sai số đối soát tối đa **1 VND**.
- [ ] Chạy seed lần hai không tạo bản ghi trùng và không làm thay đổi số liệu nghiệp vụ.

---

## 2. Biên workflow cần seed

Bộ seed mặc định dừng ở trạng thái **sẵn sàng để Manager chốt snapshot**.

### Phải tồn tại

- Organization và tài khoản HR/Manager/Employee.
- Department, Position, Workplace, ShiftTemplate.
- EmployeeProfile, EmploymentContract, EmployeeAssignment, ManagerAssignment.
- CalendarException của kỳ test.
- SalaryProfile, phụ cấp, chuyên cần, KPI, thuế và bảo hiểm.
- TimesheetPeriod trạng thái `OPEN` hoặc `REVIEWING`.
- AttendanceDay + AttendanceEvent, leave workflow đã apply, OT request/result đã hoàn tất theo từng scenario.

### Trạng thái chính xác

- Kỳ công: `OPEN` (mặc định).
- Ngày công hợp lệ: `AttendanceStatus.COMPLETED` và có đủ `CHECK_IN`/`CHECK_OUT`.
- KPI được đưa vào payroll: `CONFIRMED`.
- OT được đưa vào tổng hợp: `FINAL`.
- Leave tác động tới công: request phải qua workflow và ở trạng thái đã được HR apply theo contract hiện hành.

### Chưa được tồn tại

- Department snapshot closure.
- `TimesheetSummary`.
- `PayrollInputSnapshot`.
- `PayrollRun`.
- `Payslip`.

> Không dùng `scripts/seed-full-organization.ts` làm fixture chính cho E2E snapshot/payroll vì script đó tạo sẵn kỳ `CLOSED`, snapshot, payroll run `RELEASED` và payslip; cách này bỏ qua workflow cần kiểm thử.

---

## 3. Tham số fixture chuẩn

| Tham số | Giá trị đề xuất | Ghi chú |
|---|---:|---|
| `organization.code` | `PAYROLL_E2E` | Natural key ổn định, độc lập tenant khác |
| `organization.name` | `CoreStaff Payroll E2E` | Có thể thêm period vào tên hiển thị |
| Timezone | `Asia/Ho_Chi_Minh` | Dùng giờ Việt Nam cho ngày công |
| Currency | `VND` | Số tiền nguyên |
| Kỳ test | truyền bằng `--period=YYYY-MM` | Không hard-code tháng hết hạn |
| Giờ làm | `08:00–17:00` | Nghỉ trưa 60 phút, 480 phút/ngày |
| Ngày làm chuẩn | suy ra từ ca + calendar | Không hard-code 22 nếu lịch kỳ thực tế khác |
| Sai số đối soát | `≤ 1 VND` | Do quy tắc làm tròn |
| Rounding | `ROUND_HALF_UP_TO_VND` | Snapshot phải lưu quy tắc đã dùng |
| Password fixture | đọc từ biến môi trường | Không in hoặc ghi mật khẩu thật vào tài liệu/log |

Ngày của fixture phải được sinh từ `--period`; ngày lễ, thứ Bảy/Chủ nhật và ngày làm bù phải được chọn theo calendar thực tế của kỳ đó.

---

## 4. Thứ tự seed và quan hệ phụ thuộc

| Thứ tự | Nhóm dữ liệu | Collection/model chính | Khóa idempotent đề xuất |
|---:|---|---|---|
| 1 | Tenant | `Organization` | `code` |
| 2 | Danh mục dùng chung | `AllowanceCatalog`, `AttendanceBonusTemplate` | `code` |
| 3 | Cơ cấu tenant | `Department`, `Position`, `Workplace`, `ShiftTemplate` | `organizationId + code` |
| 4 | Tài khoản | `User` | `organizationId + emailN` |
| 5 | Hồ sơ nhân sự | `EmployeeProfile`, `EmploymentContract`, `EmploymentHistory` | `organizationId + employeeCode`; profile + effective date |
| 6 | Phân công | `Assignment`, `ManagerAssignment` | tenant + user/manager + effective range |
| 7 | Policy tenant | labor, OT, tax, insurance, enterprise insurance, allowance, bonus, KPI | tenant + version/effectiveFrom hoặc tenant + code |
| 8 | Compensation cá nhân | `SalaryProfile`, `InsuranceProfile`, dependents | tenant + employee + effectiveFrom |
| 9 | Calendar | `CalendarException` | `organizationId + date` |
| 10 | Kỳ công | `TimesheetPeriod` | `organizationId + period` |
| 11 | Nguồn công | `AttendanceDay`, `AttendanceEvent` | tenant + user + workDate; day + eventType |
| 12 | Nghỉ phép | `LeaveRequest`, `LeaveAction`, `EmployeeDayOverride` | tenant + employee + date range |
| 13 | OT | `ManagerRequest`, `OvertimeResult` | tenant + employee + workDate + type; request id |
| 14 | KPI tháng | `KpiPayrollInput` | tenant + employeeProfile + period |
| 15 | Verify pre-workflow | tất cả nguồn trên | chỉ đọc, không mutation |

Trong dry-run, phải giả lập ID của parent chưa được tạo để vẫn đếm đúng các record con dự kiến.

---

## 5. Cơ cấu Organization và tài khoản

### 5.1. Cơ cấu tối thiểu

| Loại | Code | Tên | Mục đích |
|---|---|---|---|
| Department | `ENG` | Engineering | Nhóm chính để test attendance, leave, KPI, OT |
| Department | `HR` | Human Resources | Có HR thực hiện close/payroll |
| Position | `DLEAD` | Engineering Lead | Manager phòng ENG |
| Position | `DEV` | Software Developer | Nhân viên ENG |
| Position | `HRBP` | HR Business Partner | Nhân viên HR |
| Workplace | `HQ` | CoreStaff E2E HQ | `IN_OFFICE`, có tọa độ/radius hợp lệ |
| Shift | `HC-0800` | Ca hành chính | T2–T6, 08:00–17:00, nghỉ 60 phút, grace 10 phút |

### 5.2. Actor bắt buộc

| Mã | Role | Phòng ban | Trách nhiệm |
|---|---|---|---|
| `E2E-HR-001` | `HR` | HR | Cấu hình, confirm KPI, close kỳ, chạy payroll |
| `E2E-MGR-001` | `DEPARTMENT_MANAGER` | ENG | Duyệt request và chốt snapshot ENG |
| `E2E-HR-MGR-001` | `DEPARTMENT_MANAGER` hoặc HR có scope hợp lệ | HR | Chốt snapshot HR; không tự duyệt dữ liệu của mình |
| Các mã `E2E-EMP-*` | `EMPLOYEE` | ENG | Các scenario tính công/lương |

Mỗi actor thuộc workforce phải có cả `User` và `EmployeeProfile`; quyền chấm công còn yêu cầu `Assignment` hiệu lực. `ManagerAssignment` là nguồn xác định scope quản lý, không thay bằng `EmployeeProfile.departmentId`.

---

## 6. Danh mục chính sách phải seed đầy đủ

Tất cả policy phải có `organizationId`, `effectiveFrom`, `effectiveTo` nếu có, `version`, trạng thái active nếu schema hỗ trợ và `legalReference` nếu contract yêu cầu.

### 6.1. LaborCompliancePolicy

| Field | Giá trị fixture đề xuất |
|---|---:|
| `normalDailyMinutes` | 480 |
| `normalWeeklyMinutes` | 2.880 |
| `maxCombinedDailyMinutes` | 720 |
| `maxMonthlyOvertimeMinutes` | 2.400 |
| `maxAnnualOvertimeMinutes` | 20.000 |
| `exceptionalAnnualOvertimeMinutes` | 24.000 |
| `warningThresholdPercent` | 80 |
| `maxRetroactiveFilingDays` | 7 |
| `probationMinimumRate` | 0,85 |

### 6.2. OvertimePayPolicy

| Loại | Hệ số fixture | Model value |
|---|---:|---|
| Ngày làm việc | 150% | `workingDayRate = 1.5` |
| Ngày nghỉ tuần | 200% | `weeklyOffRate = 2.0` |
| Ngày lễ | 300% | `publicHolidayRate = 3.0` |

Backend phải phân loại loại OT từ calendar/schedule; employee không tự chọn loại. Check-out muộn không tự thành OT nếu không có request được duyệt.

### 6.3. TaxPolicy

Seed theo contract hiện hành của `tax-policy.schema.ts`:

- `standardDeduction` — bắt buộc.
- `personalDeduction` — alias legacy nếu pipeline còn đọc.
- `dependentDeduction`.
- `progressiveBrackets[]`.
- `roundingRule`.
- `legalReference`, `version`, `active`.

Không duy trì hai bộ mức giảm trừ khác nhau giữa seed script, calculator và production service. Giá trị phải được chốt theo policy nghiệp vụ của kỳ test trước khi đóng expected ledger.

### 6.4. InsurancePolicy — BHXH/BHYT/BHTN

| Thành phần | Employee rate fixture |
|---|---:|
| BHXH | 0,08 |
| BHYT | 0,015 |
| BHTN | 0,01 |

Bắt buộc seed riêng:

- `salaryBaseRules[]` cho từng `InsuranceContributionType`.
- `capRules[]` cho từng loại; không lấy một cap chung nếu nghiệp vụ quy định khác nhau.
- `employerContributionRates[]`.
- `legalReference`, version và khoảng hiệu lực.

Snapshot phải giữ cả **insurance salary chưa áp trần** và **contribution base sau áp trần** nếu schema/pipeline được mở rộng; tuyệt đối không tính `gross × 10,5%`.

### 6.5. InsuranceProfile cho từng nhân viên

Mỗi nhân viên có một record hiệu lực tại kỳ:

- `employeeId` trỏ tới `EmployeeProfile` theo schema hiện hành.
- `participatesSocialInsurance`.
- `participatesHealthInsurance`.
- `participatesUnemploymentInsurance`.
- `note` nếu có miễn trừ.
- `version`, `createdBy`.

Không suy luận tự động việc tham gia bảo hiểm chỉ từ trạng thái thử việc hoặc loại hợp đồng.

### 6.6. EnterpriseInsurancePolicy

Seed ít nhất một chính sách bảo hiểm thương mại để UI/module có dữ liệu:

- `provider`, `policyNumber`.
- `coverageDescription`.
- `premiumPerEmployee`.
- `costBearer`: `EMPLOYER`, `EMPLOYEE` hoặc `SHARED` theo enum hiện hành.
- `employeeContributionAmount` chỉ khi cost bearer cho phép.

> Hiện payroll snapshot không đọc `EnterpriseInsurancePolicy`. Do đó policy này phục vụ kiểm thử cấu hình bảo hiểm doanh nghiệp; chỉ đưa vào deduction/payroll khi production contract đã hỗ trợ rõ ràng.

### 6.7. AllowanceCatalog và OrganizationAllowance

| Code | Tên | Amount mẫu | Chịu PIT | Tính BH | Prorated | Mục đích test |
|---|---|---:|:---:|:---:|:---:|---|
| `MEAL` | Phụ cấp ăn trưa | 730.000 | Không | Không | Có | Khoản miễn thuế, giảm khi thiếu ngày công nếu policy quy định |
| `RESP` | Phụ cấp trách nhiệm | 1.500.000 | Có | Không | Không | Khoản chịu thuế |
| `PHONE` | Phụ cấp điện thoại | 500.000 | Có/Không theo policy fixture | Không | Không | Kiểm tra mapping cá nhân |
| `FUEL` | Phụ cấp xăng xe | 500.000 | Không | Không | Có/Không | Kiểm tra khoản miễn thuế |

Mỗi allowance phải có `taxable`, `insuranceBased`, `prorated`, effective range và version. `SalaryProfile.organizationAllowanceIds` phải tham chiếu `OrganizationAllowance`; `SalaryProfile.allowances[]` dùng cùng ID đó để override amount. Không trỏ `AllowanceCatalog` vào field yêu cầu `OrganizationAllowance`.

### 6.8. AttendanceBonusTemplate và AttendanceBonusPolicy

Template/policy đề xuất:

| Tier | Điều kiện | Tỷ lệ |
|---|---|---:|
| 1 | `LATE_COUNT = 0`, `ABSENT_DAYS = 0`, không incomplete | 100% |
| 2 | `LATE_COUNT <= 2`, `ABSENT_DAYS = 0`, không incomplete | 70% |
| 3 | `LATE_COUNT <= 4`, `ABSENT_DAYS = 0`, không incomplete | 50% |
| Không đạt | Có absent/incomplete hoặc vượt ngưỡng | 0% |

- `calculationBase = FIXED_AMOUNT`.
- `bonusAmount = 1.000.000 VND`.
- Policy scope `ALL` hoặc `DEPARTMENT` phải khớp phòng ban fixture.
- Mỗi `SalaryProfile` phải gắn đúng `attendanceBonusPolicyId`.

> Production snapshot hiện chỉ trả 100% hoặc 0% dựa trên late/early/absent/incomplete, chưa áp tier 70%/50%. Vì vậy E2E tính lương chuẩn nên có ít nhất một nhân viên đạt 100% và một người 0%; tier trung gian là scenario phát hiện gap, không được ghi expected sai để làm test xanh giả.

### 6.9. KpiPolicy và KpiPayrollInput

Policy mẫu:

| Tier | Score | Tỷ lệ trên base amount |
|---|---:|---:|
| Xuất sắc | 90–100 | 120% |
| Tốt | 80–89 | 100% |
| Đạt | 60–79 | 80% |
| Chưa đạt | 0–59 | 50% |

- `policyType = GRADE`.
- `baseAmount = 2.000.000 VND`.
- Mỗi nhân viên in-scope có đúng một `KpiPayrollInput` theo `organizationId + employeeProfileId + period`.
- Manager có thể tạo/sửa `DRAFT`; HR chuyển thành `CONFIRMED` và điền `confirmedBy`, `confirmedAt`.
- Chỉ input `CONFIRMED` được snapshot lấy vào `kpiBonus`.

### 6.10. CalendarException

Trong kỳ phải có tối thiểu:

- Một `PUBLIC_HOLIDAY` vào ngày hợp lệ trong kỳ.
- Một `SPECIAL_WORKING_DAY` nếu cần test ngày làm bù.
- Weekly off lấy từ lịch ca, không gắn nhãn “Sunday OT” riêng.

Ngày lễ trùng ngày nghỉ tuần vẫn chỉ được phân loại một loại; `PUBLIC_HOLIDAY` ưu tiên để tránh double count.

---

## 7. Hồ sơ payroll bắt buộc cho từng nhân viên

| Nhóm | Dữ liệu tối thiểu |
|---|---|
| Identity | `User`, email normalized, role, trạng thái active |
| HR profile | mã nhân viên, họ tên, ngày vào, trạng thái `ACTIVE/PROBATION`, phòng ban, vị trí, workplace |
| Sensitive payroll | tax code, bank account, citizen ID, social insurance code bằng dữ liệu giả |
| Quan hệ | direct manager, `Assignment`, manager scope nếu actor là manager |
| Hợp đồng | loại, trạng thái `ACTIVE`, effective/expiry date |
| SalaryProfile | base salary, insurance salary, allowance IDs/amounts, attendance policy, currency, rounding, version |
| InsuranceProfile | ba cờ tham gia, khoảng hiệu lực, version |
| PIT | danh sách dependent active/inactive để test giảm trừ |
| KPI tháng | score/tier/amount/status và actor xác nhận |
| Kỳ công | attendance/leave/OT theo scenario |

Mọi mã định danh nhạy cảm phải là dữ liệu giả, không dùng dữ liệu cá nhân thật.

---

## 8. Ma trận nhân viên và scenario nghiệp vụ

Bộ đầy đủ đề xuất gồm 8 nhân viên tính lương. Nếu cần smoke test nhanh, chỉ dùng `EMP-01`; regression phải dùng toàn bộ ma trận.

| Mã | Scenario | Lương cơ bản | Dependent | Công/nghỉ | OT | Kỳ vọng trọng tâm |
|---|---|---:|---:|---|---|---|
| `EMP-01` | Happy path | 25.000.000 | 1 | Đủ công, đúng giờ | Ngày thường + nghỉ tuần + lễ | Full salary, 100% chuyên cần, KPI confirmed, đủ ba loại OT |
| `EMP-02` | Đi trễ/về sớm | 18.000.000 | 0 | 2 lần trễ, 1 lần về sớm | Không | Kiểm tra late/early và tier chuyên cần hiện được hỗ trợ |
| `EMP-03` | Nghỉ có lương | 20.000.000 | 2 | 1 ngày annual/paid leave đã HR apply | Không | Standard days không giảm; paid day theo policy; không trừ lương nếu rule quy định |
| `EMP-04` | Nghỉ không lương | 22.000.000 | 0 | 1 ngày unpaid leave đã HR apply | Không | Prorate salary giảm đúng 1 payable day |
| `EMP-05` | Vắng không phép | 16.000.000 | 0 | 1 ngày absent | Không | Prorate giảm; attendance bonus = 0 |
| `EMP-06` | Thiếu punch | 17.000.000 | 0 | 1 ngày chỉ CHECK_IN | Không | Blocker trước close hoặc `incompleteDays = 1`; không được tính present giả |
| `EMP-07` | Thử việc | 15.000.000 job salary | 0 | Đủ công | Ngày thường | Agreed salary ≥ 85%; bảo hiểm theo InsuranceProfile chứ không suy diễn từ probation |
| `EMP-08` | Lương vượt trần BH | 80.000.000 | 3 | Đủ công | Không | Contribution base bị cap; PIT nhiều bậc; employer cost đúng |

### Quy tắc cho `EMP-06`

Dùng scenario này cho hai test riêng:

1. **Negative close test:** giữ thiếu punch, xác nhận Manager/HR không thể chốt nếu đây là blocker.
2. **Positive payroll test:** xử lý qua request/adjustment hợp lệ hoặc loại nhân viên khỏi lỗi chặn trước khi chốt; không sửa thẳng event để “làm sạch” dữ liệu.

---

## 9. Kịch bản ngày công chi tiết

### 9.1. Ngày làm bình thường

Mỗi ngày có:

- Một `AttendanceDay` theo unique key `organizationId + employeeId(User) + workDate`.
- `workdayType = WORKING_DAY`.
- `dayResult = PRESENT`.
- `attendanceStatus = COMPLETED`.
- `checkInAt`, `checkOutAt`, `workingMinutes`, `lateMinutes`, `earlyMinutes` nhất quán.
- `shiftSnapshot`, `workplaceSnapshot`, `employeeSnapshot` đầy đủ.
- Hai `AttendanceEvent`: `CHECK_IN` và `CHECK_OUT`, liên kết bằng `attendanceDayId`, cùng employee `User` ID.

Giờ UTC phải quy đổi đúng sang `Asia/Ho_Chi_Minh`; ví dụ 08:00 VN là 01:00 UTC nếu không có DST.

### 9.2. Đi trễ/về sớm

- Check-in sau `startTime + gracePeriodMinutes` mới phát sinh `lateMinutes` theo contract service.
- Check-out trước `endTime` phát sinh `earlyMinutes`.
- Không ghi `lateMinutes/earlyMinutes` mâu thuẫn với timestamps.

### 9.3. Incomplete

- Chỉ có một event `CHECK_IN` hoặc `CHECK_OUT`.
- `attendanceStatus = INCOMPLETE`.
- `workingMinutes` không được giả thành 480.
- Không được tính là `presentDays` chỉ vì một status cũ/mâu thuẫn nói đã check-in.

### 9.4. Absent

- Không có punch hợp lệ và không có leave đã apply.
- Ngày vẫn được calendar xác định là `WORKING_DAY`.
- Sau bước reconcile/day classification, `dayResult = ABSENT`.

### 9.5. Paid/Unpaid leave

Không seed `EmployeeDayOverride` rời rạc ngoài workflow. Dữ liệu cần gồm:

```text
LeaveRequest PENDING_MANAGER
→ Manager APPROVED
→ HR_APPLIED
→ LeaveAction audit
→ EmployeeDayOverride tương ứng
→ AttendanceDay/day result được reconcile
```

### 9.6. Số công tổng hợp cần kiểm tra

Sau khi Manager chốt, mỗi `TimesheetSummary` phải có:

- `totalDays`, `workingDays`.
- `presentDays`, `paidLeaveDays`, `unpaidLeaveDays`.
- `holidayDays`, `absentDays`, `incompleteDays`.
- `totalWorkingMinutes`, `totalLateMinutes`, `totalEarlyMinutes`.
- `otWorkingDayMinutes`, `otWeeklyOffMinutes`, `otPublicHolidayMinutes`, `totalOvertimeMinutes`.
- `sickLeaveDays`, `personalLeaveDays`, `annualLeaveDays`, `otherPaidLeaveDays`, `otherUnpaidLeaveDays`.
- `sourceHash`, `version`, `generatedAt`.

`workingDays` là ngày chuẩn theo calendar; paid leave không làm mất standard working day. `payableWorkingDays` chỉ giảm bởi absent + unpaid leave theo resolver hiện hành.

---

## 10. Kịch bản OT

Cho `EMP-01`, tạo ba request riêng:

| Ngày | Request | Actual attendance ngoài ca | Loại kết quả | Eligible mẫu |
|---|---|---|---|---:|
| Ngày làm việc | 18:00–20:00 | Có punch/attendance bao phủ | `OT_WORKING_DAY` | 120 phút |
| Ngày nghỉ tuần | 08:00–12:00 | Có attendance ngày nghỉ | `OT_WEEKLY_OFF` | 240 phút |
| Ngày lễ | 09:00–12:00 | Có attendance ngày lễ | `OT_PUBLIC_HOLIDAY` | 180 phút |

Mỗi OT cần:

1. `ManagerRequest.type = OVERTIME`, cùng tenant/department/employee.
2. Khoảng requested và approved hợp lệ; status `APPROVED`.
3. Attendance thực tế giao với requested interval.
4. `OvertimeResult` dùng `employeeId` là **User ID**, không phải EmployeeProfile ID.
5. `requestedMinutes`, `approvedMinutes`, `actualMinutes`, `eligibleMinutes` có thể audit.
6. `calendarSnapshot`, `scheduleSnapshot`, `policyVersion`, `legalReference`, `inputHash` và `calculatedAt`.
7. Trước chốt có thể `PROVISIONAL`; workflow close phải tạo/recompute thành `FINAL`.

Công thức:

```text
eligible interval = approved interval ∩ actual attendance interval − scheduled working interval
eligibleMinutes <= approvedMinutes
```

Phân loại ngày phải thực hiện trước khi trừ ca. Với ngày nghỉ tuần/ngày lễ, không trừ ca ngày thường làm mất OT hợp lệ.

---

## 11. Expected ledger độc lập

Mỗi fixture phải xuất một file JSON/record expected ledger do calculator độc lập tạo, không gọi lại production payroll service.

### Công thức đối soát

```text
prorated_salary = salary_basis × payable_working_days / standard_working_days
hourly_rate = salary_basis / (standard_working_days × hours_per_day)
ot_total = Σ(hourly_rate × ot_hours_by_type × multiplier)
ot_exempt_premium = Σ(hourly_rate × ot_hours × max(multiplier − 1, 0))
gross = prorated_salary + allowances + attendance_bonus + kpi_bonus + ot_total + additions
insurance = Σ(applied_contribution_base_by_type × employee_rate_by_type)
taxable_before_deductions = gross − non_taxable_allowances − ot_exempt_premium
pit_base = max(taxable_before_deductions − insurance − personal_deduction − dependent_deductions, 0)
pit = progressive_tax(pit_base)
net = gross − insurance − pit − other_deductions
```

> Policy về phần OT miễn/chịu PIT phải được chốt một lần và dùng nhất quán giữa tài liệu, expected ledger, snapshot và payslip. Không trừ phần miễn OT hai lần.

### Ví dụ oracle cho `EMP-01`

Giả định cố định:

- 22/22 payable days, base salary 25.000.000.
- Taxable allowance 1.500.000; non-taxable allowance 730.000.
- Attendance bonus 1.000.000; KPI bonus 2.000.000.
- OT: 600 phút ngày thường, 240 phút nghỉ tuần, 180 phút ngày lễ.
- Contribution base 25.000.000; BHXH/BHYT/BHTN lần lượt 8%/1,5%/1%.
- 1 dependent; giảm trừ bản thân 11.000.000, dependent 4.400.000.
- Bracket ví dụ: 10 triệu đầu 5%, phần tiếp theo đến 30 triệu 10%.

| Chỉ tiêu | Expected |
|---|---:|
| Hourly rate chưa làm tròn | 142.045,4545… |
| Prorated base salary | 25.000.000 |
| Tổng OT pay | 4.545.455 |
| OT base | 2.414.773 |
| OT premium | 2.130.682 |
| BHXH | 2.000.000 |
| BHYT | 375.000 |
| BHTN | 250.000 |
| Tổng insurance | 2.625.000 |
| Gross | 34.775.455 |
| Taxable trước giảm trừ cá nhân/người phụ thuộc | 31.914.773 |
| PIT base | 13.889.773 |
| PIT | 888.977 |
| Net salary | 31.261.478 |

Các số trên chỉ là oracle của bộ giả định này. Nếu policy fixture thay đổi, phải sinh lại expected ledger bằng calculator độc lập và review diff; không copy output production vào expected.

---

## 12. Workflow test sau seed

### Giai đoạn A — Verify trước khi chốt

1. Đếm đúng Organization và actor accounts.
2. Resolve toàn bộ ID bằng natural key; không dùng ObjectId hard-code.
3. Kiểm tra same-tenant reference.
4. Kiểm tra effective policy/profile tại ngày đầu kỳ.
5. Kiểm tra attendance matrix và các blocker dự kiến.
6. Kiểm tra KPI confirmed, OT approved/final đúng scenario.
7. Khẳng định `TimesheetSummary = 0`, `PayrollInputSnapshot = 0`, `PayrollRun = 0`, `Payslip = 0`.

### Giai đoạn B — Manager review/close

Với từng Department:

1. Gọi preview endpoint/service thật.
2. Kiểm tra projection của Manager chỉ có attendance, leave, absence và OT; không lộ salary, allowance, insurance, tax, dependent, net hoặc integrity metadata nhạy cảm.
3. Xử lý blocker của negative scenario qua workflow hợp lệ.
4. Manager chốt snapshot phòng ban.
5. Re-read period để xác nhận `departmentSnapshots` có đúng department/manager/timestamp.

Sau phòng ban cuối:

- `managerSnapshotClosed = true`.
- `status = READY_TO_CLOSE`.
- Số summary/snapshot bằng đúng nhân viên in-scope.

### Giai đoạn C — HR close

1. HR gọi close period.
2. Re-read chính xác target: `status = CLOSED`, `closedBy`, `closedAt` tồn tại.
3. Kiểm tra mỗi employee có đúng một `TimesheetSummary` và một `PayrollInputSnapshot` không stale.
4. Đối soát snapshot với source + expected ledger.

### Giai đoạn D — Payroll

1. Kiểm tra eligibility bằng endpoint/read model thật: đúng tenant, period, trạng thái closed, snapshot count đầy đủ, không stale và chưa có run xung đột.
2. Tạo run `DRAFT`.
3. Calculate: run thành `CALCULATED`; `processedEmployeeCount = totalEmployeeCount`; số payslip bằng số snapshot.
4. Recalculate test chỉ chạy khi run `CALCULATED` và payslip chưa release; số liệu phải giữ nguyên từ frozen snapshot.
5. Lock: run thành `LOCKED`.
6. Release: run thành `RELEASED`; employee chỉ xem payslip của chính mình.
7. Đối soát tổng run bằng tổng payslip và từng payslip bằng expected ledger, sai số ≤ 1 VND.

### Giai đoạn E — Reopen/invalidation

Trên một fixture riêng hoặc resettable fixture:

1. Reopen kỳ đã close với lý do ≥ 10 ký tự.
2. Kỳ trở lại `REVIEWING`, tăng version và xóa trạng thái manager closure.
3. Snapshot và payroll run downstream chuyển `STALE`.
4. Không sửa snapshot/payslip lịch sử tại chỗ.

---

## 13. Verification matrix

| Check | Điều kiện pass |
|---|---|
| Tenant isolation | Mọi reference resolve trong cùng Organization; tenant khác không đọc/mutation được |
| Natural-key uniqueness | Không trùng tenant+code, tenant+employee+period hoặc day+eventType |
| Effective dates | Không overlap; đúng một record hiệu lực cho mỗi policy/profile tại kỳ |
| Workforce completeness | Mỗi employee in-scope có user/profile/contract/assignment/salary/insurance/KPI |
| Manager readiness | Mỗi department bắt buộc có manager scope hiệu lực; actor không tự duyệt |
| Attendance coverage | Mỗi ngày scenario có state và event evidence nhất quán |
| Leave integrity | Override chỉ sinh từ leave workflow đã apply |
| OT integrity | Đủ request + result; category/minutes/policy snapshots đúng |
| Snapshot completeness | `summaryCount = snapshotCount = inScopeEmployeeCount` |
| Snapshot immutability | Policy/profile live thay đổi không làm đổi frozen snapshot/run/payslip |
| Payroll completeness | `processedEmployeeCount = totalEmployeeCount = payslipCount` |
| Numeric reconciliation | Employee ledger, snapshot, payroll result, payslip lệch không quá 1 VND |
| Run totals | `totalGross/totalNet/employerCost` bằng tổng employee result |
| Authorization | Manager không thấy payroll private; employee không thấy payslip người khác; chỉ HR chạy close/calculate/lock/release |
| No destructive change | Không xóa/sửa dữ liệu tenant khác hoặc baseline được bảo vệ |
| Idempotency | Apply lần hai `created = 0`, business values không đổi |
| Application read path | API/service dùng bởi UI trả đúng fixture, không chỉ DB có document |

---

## 14. Yêu cầu đối với seed script triển khai từ tài liệu này

CLI đề xuất:

```bash
# Chỉ lookup, validate và báo planned counts
npm run seed:org:payroll:dry -- --org-code=PAYROLL_E2E --period=YYYY-MM

# Tạo dữ liệu đầu vào
npm run seed:org:payroll -- --org-code=PAYROLL_E2E --period=YYYY-MM --apply

# Verify storage + business invariants + trạng thái trước workflow
npm run verify:org:payroll -- --org-code=PAYROLL_E2E --period=YYYY-MM

# Reset chỉ fixture tenant này; bắt buộc explicit flag
npm run seed:org:payroll -- --org-code=PAYROLL_E2E --period=YYYY-MM --reset-fixture --apply
```

### Hành vi bắt buộc

- Mặc định là dry-run; chỉ mutation khi có `--apply`.
- Không log `.env`, password hash, session/token hoặc dữ liệu nhạy cảm thật.
- Lookup ID động bằng business key; không hard-code ObjectId.
- Báo riêng `planned/created/updated/skipped/removed` theo collection.
- Insert missing mặc định; không overwrite effective record đang có.
- Reset chỉ xóa fixture có marker/org code rõ ràng và phải kiểm tra target trước khi xóa.
- Chạy apply lần hai để chứng minh idempotency.
- Verifier phải đọc lại DB và gọi production service/read model; không chỉ tin kết quả seed command.
- Expected ledger phải machine-readable và độc lập production calculator.

---

## 15. Lưu ý theo code hiện tại của CoreStaff

Các điểm sau phải được xử lý/khẳng định trước khi dùng fixture làm acceptance test chính thức:

1. `AttendanceDay` và `AttendanceEvent` hiện dùng `employeeId` là **User ID**; script seed không được dùng các field `employeeProfileId`, `userId`, `workDate`, `type` thay cho contract schema thực tế.
2. `KpiPayrollInput` hiện dùng `period`, `amount`, `status`; không dùng contract cũ `periodKey`, `confirmedAmount`, `confirmationStatus` nếu schema chưa đổi.
3. `InsuranceProfile` hiện dùng `employeeId` và participation flags; không dùng shape cũ `employeeProfileId`, `insuranceSalary`, insurance numbers nếu chưa có schema tương ứng.
4. `TaxPolicy.standardDeduction` là field bắt buộc theo schema hiện tại; seed phải điền cả alias legacy chỉ khi service còn đọc nó.
5. Snapshot service hiện hard-code hệ số OT 1,5/2,0/3,0 thay vì resolve `OvertimePayPolicy`; regression phải phát hiện drift giữa policy và snapshot.
6. Snapshot source hash hiện chưa bao phủ đầy đủ allowance, attendance bonus, KPI và OT policy; thay đổi các input này cần được test để tránh snapshot “hợp lệ giả”.
7. Payroll calculation hiện có đường xử lý allowance/OT taxable khác snapshot oracle; expected ledger phải là trọng tài độc lập, không điều chỉnh expectation theo output sai.
8. `scripts/seed-payroll-e2e.ts` và `scripts/verify-payroll-e2e-seed.ts` hiện thể hiện đúng ý tưởng seed-input-only nhưng cần đồng bộ field names với schema hiện tại trước khi dùng.
9. MongoDB phải chạy replica set nếu workflow manager close dùng transaction.

---

## 16. Definition of Done

- [ ] Có dry-run, apply, verify và reset scoped cho fixture.
- [ ] Seed đầy đủ mọi nhóm dữ liệu trong mục 4–10.
- [ ] Regression matrix có đủ 8 scenario hoặc có lý do rõ ràng khi rút gọn.
- [ ] Không seed trực tiếp artifact cuối luồng.
- [ ] Manager close tất cả department thành công sau khi xử lý blocker.
- [ ] Period close tạo đúng số summary/snapshot.
- [ ] Payroll run đi qua `DRAFT → CALCULATED → LOCKED → RELEASED`.
- [ ] Payslip từng nhân viên và tổng payroll reconcile với oracle ≤ 1 VND.
- [ ] Reopen đánh dấu downstream `STALE` trên fixture riêng.
- [ ] Negative authorization/tenant tests pass.
- [ ] Apply lần hai không tạo duplicate.
- [ ] Targeted tests, typecheck/build và API/browser E2E liên quan đều pass.

---

## 17. File/code tham chiếu trong repository

- `CoreStaff/Apps/api/scripts/seed-payroll-e2e.ts`
- `CoreStaff/Apps/api/scripts/verify-payroll-e2e-seed.ts`
- `CoreStaff/Apps/api/scripts/payroll-ledger.ts`
- `CoreStaff/Apps/api/scripts/seed-full-organization.ts`
- `CoreStaff/Apps/api/src/database/schemas/registry.ts`
- `CoreStaff/Apps/api/src/database/schemas/compensation.schema.ts`
- `CoreStaff/Apps/api/src/database/schemas/timesheet-summary.schema.ts`
- `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts`
- `CoreStaff/Apps/api/src/hr/timesheet/timesheet-period.service.ts`
- `CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts`
- `CoreStaff/Apps/api/src/hr/payroll/payroll-run.service.ts`
- `Docs/SRS_CORESTAFF.md`
