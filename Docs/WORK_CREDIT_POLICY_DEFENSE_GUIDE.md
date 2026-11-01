# Hướng dẫn bảo vệ và diễn tập — WorkCreditPolicy

## 1. Phạm vi và cách sử dụng bằng chứng

Tài liệu để thuyết minh bằng tiếng Việt, theo thứ tự **facts → policy → computation → evidence → limits**. Mỗi kết quả phải đi cùng đầu vào và chính sách; không dùng một ảnh giao diện thay cho chứng minh toàn pipeline.

**Trạng thái tại lúc biên soạn:** đã đọc source evaluator, attendance calculator, compensation, projection, invalidation và snapshot; đã tính bảng minh họa bằng Python. UI/helper/parity và regression pipeline đang được các luồng triển khai khác hoàn thiện. Sự tồn tại của file test không có nghĩa test đã chạy hoặc đã pass. Tài liệu này không xác nhận Web/E2E, transaction DB hay toàn hệ thống đã nghiệm thu; kết quả cuối phải lấy từ báo cáo acceptance của phiên triển khai. Các số test trong plan là lịch sử QC, không phải kết quả của đợt này.

Nguồn thiết kế: [plan gốc](../.hermes/plans/2026-10-30_work-credit-policy-redesign-and-defense-guide.md), đặc biệt §4, §8–10. Plan là yêu cầu/định hướng; chỉ phần đã trace source bên dưới được mô tả là hành vi hiện hữu. Không sửa code, dữ liệu, seed, index, không kết nối DB và không commit trong công việc viết hướng dẫn này.

### Bản đồ bằng chứng nội bộ

Đường dẫn tính từ Git root; liên kết tính từ thư mục `Docs`. Ưu tiên tên symbol hơn số dòng vì các agent đang sửa source.

| Mã | Nguồn đã đọc | Điều được chứng minh ở mức source |
|---|---|---|
| E1 | [work-credit-domain.ts](../CoreStaff/Apps/api/src/hr/policies/work-credit-domain.ts), `validateWorkCreditPolicyRules`, `evaluateWorkCreditDay` | Threshold, thứ tự trạng thái, công thức và reason/blocking |
| E2 | [attendance-calculator.service.ts](../CoreStaff/Apps/api/src/attendance/services/attendance-calculator.service.ts), `calculateAttendance` | Late trừ grace; early không có grace riêng; nhánh intervals và fallback break |
| E3 | [compensation-domain.ts](../CoreStaff/Apps/api/src/hr/compensation/compensation-domain.ts), `evaluateAttendanceBonus`, `resolveConfirmedKpiAmount` | Bộ đánh giá tier thưởng có trace; KPI cần confirmed |
| E4 | [period-obligation.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/period-obligation.service.ts) | Projection nghĩa vụ/work/leave; nhận `attendance.workingMinutes`, không tự suy đúng từ nhãn nửa ngày |
| E5 | [timesheet-summary.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/timesheet-summary.service.ts), `buildWorkCreditSummaryProjection` | Resolve policy theo ngày; gọi evaluator; snapshot identity/version/rules, nguồn và sourceHash |
| E6 | [policies.service.ts](../CoreStaff/Apps/api/src/hr/policies/policies.service.ts), `workCreditAt`, `ensureWorkCreditCoverage`, `createWorkCredit`, `updateWorkCredit` | Effective dating; coverage mặc định 50–100 khi tổ chức chưa có policy; mutation/invalidation |
| E7 | [period-version.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/period-version.service.ts), `bumpForEffectiveWindow` | Invalidate kỳ mở giao effective window; không tự sửa kỳ CLOSED |
| E8 | [payroll-snapshot.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts), `resolvePayrollWorkdays`, `generateSnapshotsForDepartment`, `buildSnapshotForEmployee` | V2 dùng standard/payable units; proration; lưu daily/policy evidence và nguồn; điều kiện thưởng thực tế |
| E9 | [timesheet-period.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/timesheet-period.service.ts) và [payroll-run.service.ts](../CoreStaff/Apps/api/src/hr/payroll/payroll-run.service.ts) | Điều phối đóng kỳ có session/transaction và consumer frozen payroll inputs; không thay thế integration test |
| E10 | [timesheet-eligibility.service.ts](../CoreStaff/Apps/api/src/hr/timesheet/timesheet-eligibility.service.ts), `determineTimesheetEligibility` | Employment type ngoài FULL_TIME trả UNSUPPORTED_PAY_BASIS |
| E11 | [WorkCreditPolicyScreen.tsx](../CoreStaff/Apps/web/src/screens/WorkCreditPolicy/WorkCreditPolicyScreen.tsx) | Form nhập phần trăm, payload ratio; edit/diff; preset chủ động và warning kỳ mở trong source đang triển khai |
| E12 | [attendance.service.ts](../CoreStaff/Apps/api/src/attendance/attendance.service.ts) | Caller calculator và requiredWorkingIntervals cần trace để chứng minh demo punch thực tế |
| E13 | [work-credit-simulation.ts](../CoreStaff/Apps/web/src/screens/WorkCreditPolicy/work-credit-simulation.ts) và [work-credit-simulation-parity.spec.ts](../CoreStaff/Apps/api/src/hr/policies/work-credit-simulation-parity.spec.ts) | Có helper/parity source đang triển khai; chưa phải bằng chứng chạy thành công |

## 2. Facts → policy → computation → evidence → limits

### Facts — dữ kiện đầu vào, không phải kết luận lương

- `S = scheduledObligationMinutes`: nghĩa vụ ngày trước khi trừ phép ở mẫu số.
- `W = workedScheduledMinutes`: phút làm thuộc nghĩa vụ; không cộng OT để bù thiếu công.
- `L = payableLeaveMinutes`: phút phép hưởng lương; chỉ cộng khi toggle policy bật.
- `unpaidLeaveMinutes`, `dayType`, `incompleteState` là dữ kiện riêng. Không đổi timestamp hoặc điền đơn phép giả để đạt một preset.
- Dữ kiện work và leave phải được chuẩn hóa, tránh trùng khoảng. Evaluator không nhận intervals nên không tự phát hiện overlap. Projection hiện đọc `attendance.workingMinutes` rồi cap theo S; cap không chứng minh đã loại đúng break/OT/leave trong mọi caller. Cần regression active pipeline. [E1, E4, E12]

### Policy — quyết định explicit của doanh nghiệp

Backend giữ **0 ≤ half < full ≤ 1**, kết quả bậc thang **0 / 0.5 / 1**. Hai ví dụ UI 50–100 và 50–85 chỉ để HR chủ động so sánh, không tự áp dụng khi mở form, không phải migration. **Không có default 85% mới**. Không được nói hệ thống hoàn toàn không có default: `ensureWorkCreditCoverage` hiện có fallback 50–100 cho tổ chức chưa có policy. Effective window và `businessReference` cần phản ánh phê duyệt thực tế. [E1, E6, E11]

### Computation — công thức và thứ tự, không lược mất blocker

```text
Trước threshold:
  WEEKLY_OFF / PUBLIC_HOLIDAY → workCredit 0, reason tương ứng
  UNRESOLVED → workCredit 0, INCOMPLETE_DAY_BLOCKED, blocking true
  FORFEITED_MISSING_PUNCH → workCredit 0, reason tương ứng
  max(0,S) = 0 → NO_SCHEDULED_OBLIGATION
Với SCHEDULED, COMPLETE, S > 0:
  C = min(S, max(0,W) + (paidLeaveCreditEnabled ? max(0,L) : 0))
  R = C / S
  R >= full → 1; nếu không, R >= half → 0.5; còn lại → 0
  Nếu C = 0 và unpaidLeaveMinutes > 0: reason UNPAID_LEAVE
```

Không round R trước comparator, không thêm epsilon riêng cho UI. Half=0 vẫn hợp lệ theo backend: COMPLETE, S>0, C=0 có thể được 0.5. Đây là hệ quả cần cảnh báo, không âm thầm sửa schema. Special states được xử lý trước threshold; holiday 0 standard credit không kết luận mất mọi quyền hưởng lương ngày lễ. [E1]

### Evidence — đường tới snapshot và tiền

```text
Attendance + lịch/leave → PeriodObligation → policy theo ngày
→ evaluateWorkCreditDay → dailyWorkCredits + policy snapshots + sourceHash
→ review / đóng kỳ → PayrollInputSnapshot → payroll dùng frozen inputs
```

Đây là trace source, không tuyên bố toàn chuỗi đã chạy trong môi trường DB của buổi demo. V2 snapshot dùng `standardWorkUnits` và `payableWorkUnits`; phần base salary được prorate theo payable/standard rồi round. Snapshot còn có phụ cấp, thưởng, OT, bảo hiểm, thuế: **1 work unit không phải một số tiền net cố định**. Policy mutation có invalidation kỳ mở; kỳ đã chốt không tự đọc policy live để đổi lịch sử. Reopen/rebuild có quy trình riêng, không hứa lịch sử không thể thay trong mọi thao tác quản trị. [E5–E9]

**Không nhầm bộ tier với consumer payroll:** E3 có `evaluateAttendanceBonus` duyệt tier theo order và trả amount/trace. Nhưng E8 đang tính attendance bonus bằng điều kiện `payableWorkingDays >= standardWorkingDays`, totalLateMinutes=0, totalEarlyMinutes=0, absentDays=0 và incompleteDays=0, rồi lấy `bonusAmount`; không gọi tier evaluator ở nhánh này. KPI snapshot chỉ lấy input `CONFIRMED`. Vì vậy không nói các tier đã nối đầy đủ vào payroll, cũng không nói metrics tự động thành tiền phạt. [E3, E8]

### Limits — nói trước khi hội đồng hỏi

- Eligibility hiện **FULL_TIME**; công thức theo S tổng quát không chứng minh part-time/night shift/all pay bases đã được hỗ trợ. [E10]
- **Không linear**, không tự động phạt tiền/khấu trừ, không module kỷ luật mới. Giảm full threshold chỉ dời điểm gãy. [E1, E3, E8]
- **Pháp lý chưa xác minh**: tính đúng policy không bảo đảm policy hợp pháp. Không dùng Odoo để suy ra luật Việt Nam hoặc 85% là chuẩn thị trường.
- UI/helper/parity và active punch→projection regression phải có kết quả thực trước nghiệm thu; guide không tự ghi chúng là green. [E12, E13]

## 3. Bảng demo được tính bằng Python

**Giả định explicit:** SCHEDULED, COMPLETE; S/W/L là phút nguyên; không unpaid leave; W đã loại break và OT, W/L không overlap; không suy W chỉ từ nhãn punch. Các hàng S480 giả định lịch 08:00–17:00, nghỉ 12:00–13:00 đã được loại đúng: khung 9 giờ trừ nghỉ 1 giờ còn 8 giờ. Đây là facts nhập mô phỏng, không phải bản ghi nhân viên đã kiểm chứng.

Đã thực thi Python với comparator `>=` và công thức E1; tỷ lệ hiển thị 6 chữ số thập phân, so sánh dùng giá trị chưa round. Đây là phép tái lập ví dụ, **không phải chạy TypeScript evaluator hay parity test**.

| S | W | L | Tính phép | C | R (%) | 50–100 | 50–85 |
|---:|---:|---:|:---:|---:|---:|---:|---:|
| 480 | 475 | 0 | Bật | 475 | 98.958333 | 0.5 | 1 |
| 480 | 420 | 0 | Bật | 420 | 87.500000 | 0.5 | 1 |
| 480 | 408 | 0 | Bật | 408 | 85.000000 | 0.5 | 1 |
| 480 | 407 | 0 | Bật | 407 | 84.791667 | 0.5 | 0.5 |
| 480 | 240 | 0 | Bật | 240 | 50.000000 | 0.5 | 0.5 |
| 480 | 239 | 0 | Bật | 239 | 49.791667 | 0 | 0 |
| 480 | 240 | 240 | Bật | 480 | 100.000000 | 1 | 1 |
| 480 | 240 | 240 | Tắt | 240 | 50.000000 | 0.5 | 0.5 |
| 240 | 240 | 0 | Bật | 240 | 100.000000 | 1 | 1 |
| 450 | 382 | 0 | Bật | 382 | 84.888889 | 0.5 | 0.5 |
| 450 | 383 | 0 | Bật | 383 | 85.111111 | 0.5 | 1 |

Cách tái lập độc lập, chỉ tính trong bộ nhớ, không DB/seed:

```python
rows = [(480,475,0,True), (480,420,0,True), (480,408,0,True),
        (480,407,0,True), (480,240,0,True), (480,239,0,True),
        (480,240,240,True), (480,240,240,False), (240,240,0,True),
        (450,382,0,True), (450,383,0,True)]
for s, w, leave, enabled in rows:
    c = min(s, max(0, w) + (max(0, leave) if enabled else 0))
    r = c / s
    credits = [1 if r >= full else 0.5 if r >= 0.5 else 0
               for full in (1, 0.85)]
    print(s, w, leave, enabled, c, f"{r*100:.6f}", *credits, sep="|")
for s in (240, 450, 480):
    print(s, next(m for m in range(s + 1) if m / s >= 0.85))
```

Mốc full85 từ phép duyệt phút Python: S240→204, S450→383, S480→408. Với S480/half50, bậc 0.5 là 240–407 khi full85. Không gọi phần thiếu so với S là “grace”; work-credit threshold khác grace check-in. Python cũng cho late 60−15=45, grace0→60; early 16:55 so 17:00→5 theo E2.

**Cập nhật root-cause fix:** calculator và snapshot punch thông thường đã được bổ sung giao khoảng khi ca có `breakStartTime`/`breakEndTime` rõ ràng. Regression service có persistence cho sáng08–12→240, chiều13–17→240 và07–19→480 đã được chạy bởi nhánh triển khai; kết quả parent gate cuối xem acceptance report. Ca/snapshot lịch sử chỉ có tổng break vẫn giữ fallback cũ (có thể cho180): không đoán vị trí nghỉ, không backfill lịch sử. Khi demo punch phải chỉ rõ ca có nghỉ12–13 explicit; không khẳng định mọi dữ liệu cũ đã sửa. Manual adjustment legacy còn implementation riêng, không dùng nó thay bằng chứng cho ordinary punch. [E2, E4, E12]

## 4. Diễn tập: 13 câu hỏi và trả lời ngắn

### Q1. 85% từ đâu, có giống hãng khác hoặc đúng luật không?

“Đây là ví dụ do doanh nghiệp tự chọn, không phải chuẩn thị trường hay tỷ lệ luật định đã được nhóm chứng minh. Evaluator nhận rules; backend coverage hiện vẫn 50–100. Tài liệu Odoo được dẫn chỉ hỗ trợ nguyên tắc cấu hình, không chứng minh rule 50–85.” **Mở:** E1, E6, §6 bên dưới.

### Q2. Về sớm 5 phút được mấy công?

“Giả sử S480, COMPLETE, W475, không leave: R=98.958333%. Half50/full100 cho0.5; half50/full85 cho1. Early vẫn được tính riêng, không thể suy số tiền net mất/được chỉ từ credit.” **Mở:** bảng §3, E1, E2, E8.

### Q3. Đi muộn một giờ vẫn 1 công có dung túng không?

“Nếu W420/S480 thì ratio87.5% đạt full85. Nhưng công không phải điểm kỷ luật: grace15 cho late45, grace0 cho late60. Snapshot thưởng hiện vẫn kiểm totalLateMinutes=0; tier evaluator không đồng nghĩa đã được nối vào payroll. Không có kết luận phạt tự động.” **Mở:** E2, E3, E8.

### Q4. 407 và 408 phút khác một phút mà khác nửa công, công bằng ở đâu?

“Đúng, đó là cliff của bậc thang. Nhóm hiển thị biên để HR quyết định, không gọi việc giảm threshold là giải quyết triệt để. Muốn liên tục theo phút cần thiết kế linear riêng.” **Mở:** E1, bảng §3.

### Q5. Vì sao không dùng cố định 4h/8h?

“Tỷ lệ dùng nghĩa vụ S của ngày: S240, W240 cũng có ratio1. Tuy nhiên eligibility hiện chỉ FULL_TIME; ví dụ toán không chứng minh đã hỗ trợ payroll part-time hoặc mọi ca đêm.” **Mở:** E1, E4, E10.

### Q6. Làm nửa ngày, nghỉ phép hưởng lương nửa ngày thì sao?

“Với S480, W240/L240 không trùng, bật toggle cho C480→1; tắt cho C240→0.5. Không trừ leave khỏi mẫu số rồi cộng lại tử số. Kết quả toggle không thay thế thẩm định quyền hưởng lương hợp pháp.” **Mở:** E1, E4, bảng §3.

### Q7. Làm OT để bù đi muộn được không?

“Contract work credit dùng phút trong nghĩa vụ, OT có evidence/result riêng; ở lại muộn không tự thành approved OT hay đủ công. Cần kiểm upstream đã loại OT khỏi W, không chỉ cap tổng phút.” **Mở:** E4, E5, E12; báo regression active pipeline còn chờ nếu chưa có kết quả.

### Q8. Thiếu checkout tự động 0 công à?

“UNRESOLVED trả workCredit0 nhưng blocking=true, không phải ngày 0 công đã chốt. FORFEITED_MISSING_PUNCH là trạng thái riêng. Summary bình thường chặn unresolved; không sửa timestamp thật để vượt gate.” **Mở:** E1, E5.

### Q9. Sửa threshold có làm đổi lương tháng trước không?

“Mutation invalidates xác nhận kỳ mở giao effective window. Kỳ đóng dùng snapshot đã lưu, không tự cập nhật từ policy live. Quy trình reopen/rebuild riêng; source transaction không đủ chứng minh DB rollback/lineage đã pass trong buổi này.” **Mở:** E6–E9.

### Q10. Chứng minh UI tính giống backend bằng gì?

“Backend là authority; preview không có quyền ghi công. Có helper và parity source để so cả dải phút, biên, leave và special states. Tôi chỉ khẳng định pass khi có log test thật của phiên này; bảng Python không thay thế parity.” **Mở:** E1, E13; kèm acceptance report nếu đã được parent xác nhận.

### Q11. Tại sao chưa làm linear?

“Đợt này giữ contract0/0.5/1, cải thiện cấu hình và giải thích. Linear ảnh hưởng precision, proration, hash, review và frozen snapshots; phải có quyết định sản phẩm và compatibility/migration riêng.” **Mở:** E1, E5, E8, plan §11.

### Q12. Có bảo đảm doanh nghiệp không vi phạm luật không?

“Không. Phần mềm tách facts, policy, credit và monetary outcomes để kiểm tra; tính hợp lệ của nội quy, trả lương, thưởng, khấu trừ phải được HR/pháp chế thẩm định. Không đổi tên khoản phạt thành KPI/thưởng để hợp thức hóa.” **Mở:** E1, E3, E8; giới hạn pháp lý §6.

### Q13. Các điều luật cụ thể đâu?

“Chưa có bộ nguồn pháp luật chính thức được xác minh nguyên văn và hiệu lực trong công việc này. Không dùng các số điều102/118/127 của bản cũ làm kết luận. Trước khi đưa lên slide phải có văn bản, điều/khoản, trích nguyên văn, hiệu lực và người thẩm định.” **Mở:** plan §8 legal evidence gate; không dùng Odoo làm nguồn luật Việt Nam.

## 5. Kịch bản demo không seed, không sửa dữ liệu thật

1. Mở màn chính sách hiện hữu bằng quyền được cấp; chỉ rõ policy identity/version, ngày hiệu lực và tham chiếu thực. Không tự tạo dữ liệu tenant, không chạy script để có cảnh quay.
2. Chỉ khi preview UI của bản đang chạy đã được xác minh: nhập S480/W475, chọn chủ động ví dụ50–100 rồi50–85; nói rõ “mô phỏng, chưa lưu”. Nếu UI chưa hoàn tất, dùng bảng Python §3 và ghi “chưa demo UI”; không giả ảnh/output.
3. Cho W407 rồi408, tự nêu cliff; sau đó W240/L240 bật/tắt toggle. Cho S450/W382 rồi383 và S240/W240 để giải thích nghĩa vụ khác nhau.
4. Chọn UNRESOLVED nếu preview hỗ trợ và đã được kiểm; phân biệt blocking với0 công chốt. Không suy late/early từ ô W vì thiếu dữ kiện giờ vào/ra.
5. Demo punch08–12 chỉ sau khi active caller→calculator→projection→summary regression thật xác nhận W240. Nếu đang pending, ghi rõ và không dùng bảng toán để chứng minh pipeline.
6. Review/snapshot chỉ xem dữ liệu demo sẵn có, đã được cho phép, có identity/source thật và không lộ dữ liệu nhạy cảm. Nếu chưa có thì nói “chưa demo phần snapshot”, không tạo JSON giả hoặc chốt kỳ chỉ để trình diễn.
7. Hủy form sau mô phỏng. Preset không tự save. Mặc định không tạo/update policy trong buổi diễn tập; nếu cần lưu demo sau này phải được cấp phạm vi tenant/môi trường riêng, tham chiếu phê duyệt và window rõ, tránh overlap. Không sửa seed/ensure/verifier để chuyển ngầm sang85.
8. Kết: FULL_TIME; không linear; không phạt tự động; pháp lý chưa xác minh; nêu chính xác test nào đã chạy và gate nào còn thiếu theo báo cáo acceptance hiện hành.

## 6. Nguồn ngoài: bằng chứng được cung cấp, không xác minh mới

Hai trích đoạn dưới đây **được cung cấp trong plan §12/Sources**, dẫn tài liệu Odoo19. Công việc viết guide không fetch lại trang chính thức; không tuyên bố ngày truy cập mới hoặc nội dung hiện tại đã được kiểm. Mọi diễn giải chỉ trong phạm vi câu trích.

- Odoo19 Attendances — URL được cung cấp: https://www.odoo.com/documentation/19.0/applications/hr/attendances.html
  > "Tolerance Time In Favor Of Employee : Enter the amount of time, in minutes, that an employee is given, which does not adversely affect their attendance if they log less time than their working hours."

  Hỗ trợ hẹp: có khái niệm cấu hình tolerance theo phút có lợi cho employee. Không chứng minh threshold85, thuật toán credit CoreStaff, hay grace hiện tại của E2 giống Odoo.

- Odoo19 Payroll Work Entries — URL được cung cấp: https://www.odoo.com/documentation/19.0/applications/hr/payroll/work_entries.html
  > "No Rounding : Work entries are not modified. Half Day : Work entries are rounded to the closest half day amount. Day : Work entries are rounded to the closest full day amount."

  Hỗ trợ hẹp: tài liệu mô tả các lựa chọn rounding. Không suy Odoo dùng half50/full85, không suy thị phần, chuẩn85, khuyến nghị pháp lý hoặc tính hợp pháp tại Việt Nam.

**Checklist HR/pháp chế trước áp dụng:** xác nhận loại lao động/pay basis; nội quy và thỏa thuận lương; quyền nghỉ hưởng lương; cơ chế thưởng khác kỷ luật/khấu trừ; xử lý thiếu punch và giải trình; ngày hiệu lực và ảnh hưởng kỳ mở; lưu bản phê duyệt. Các mục này là gate cần thẩm định, không phải kết luận pháp lý đã đạt.

## 7. Checklist trước khi bảo vệ

- [ ] Công bố assumptions và threshold ngay cạnh mỗi ví dụ; không gọi85 là mặc định thị trường.
- [ ] Mở được source E1/E2/E8 để phân biệt credit, late/early và thưởng thực tế.
- [ ] Có log parity/UI thật nếu nói chúng pass; nếu chưa có, nói pending.
- [ ] Có regression active punch08–12→W240 trước khi dùng demo punch; không che fallback180.
- [ ] Snapshot/transaction/E2E chỉ nói đã kiểm khi có evidence đúng tier, không lấy unit thay DB integration.
- [ ] Không chạy DB/seed/index/migration/commit, không đổi dữ liệu thật để dựng kết quả.
- [ ] Kết luận đúng phạm vi: FULL_TIME, no linear, no automatic penalties, legal not verified.
