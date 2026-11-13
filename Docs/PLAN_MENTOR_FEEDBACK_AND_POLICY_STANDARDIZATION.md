# KẾ HOẠCH CHUẨN HÓA POLICY, PAYROLL VÀ KỊCH BẢN DEMO THEO GÓP Ý MENTOR

> **Dự án:** CoreStaff — Nền tảng Quản trị Nhân sự, Chấm công và Tiền lương  
> **Loại tài liệu:** Kế hoạch triển khai đã QC, có cổng phê duyệt pháp lý/nghiệp vụ  
> **Ngày lập:** 04/11/2026  
> **Ngày QC:** 06/11/2026  
> **Trạng thái:** **PARTIALLY IMPLEMENTED — WORKSTREAM C ĐÃ QC; CÁC WORKSTREAM CÒN LẠI VẪN QUA GATE RIÊNG**  
> **Nguyên tắc:** Không coi tài liệu này là ý kiến tư vấn pháp lý. Chỉ đưa một quy tắc vào payroll sau khi HR/người phụ trách pháp lý xác nhận văn bản, phạm vi và ngày hiệu lực.

---

## 1. Mục tiêu và phạm vi

Kế hoạch này xử lý năm góp ý chính của mentor:

1. Tổ chức phần báo cáo theo luồng **Policy → Chấm công → Chốt công → Payroll → Ngoại lệ**.
2. Phân nhóm màn hình Chính sách Tuân thủ Lao động để dễ cấu hình và giải thích.
3. Bổ sung hướng dẫn về hệ số OT nhưng không tuyên bố vượt quá phạm vi hệ thống đã hỗ trợ.
4. Thiết kế đúng ranh giới dữ liệu cho thuế TNCN thử việc và bảo hiểm, thay vì hard-code một vài con số vào UI.
5. Loại bỏ hoàn toàn KPI khỏi dữ liệu và nghiệp vụ mới, không thay bằng khoản thưởng khác; chỉ giữ khả năng đọc artifact lịch sử.

### Ngoài phạm vi của kế hoạch

- Không xây dựng hệ thống KPI/OKR/BSC hoàn chỉnh.
- Không tự động bật OT/Attendance V2 cho tenant.
- Không backfill hoặc sửa dữ liệu production khi chưa có backup, dry-run và phê duyệt riêng.
- Không cam kết “100% tuân thủ pháp luật”. CoreStaff chỉ hỗ trợ cấu hình, lưu phiên bản và giải trình theo policy đã được phê duyệt.
- Không mở rộng sang OT ban đêm/ca qua đêm nếu chưa có hợp đồng nghiệp vụ và acceptance test riêng.

---

## 2. Trạng thái đã xác minh và chưa xác minh

### 2.1. Đã xác minh từ source hiện tại

| Mã | Nội dung | Bằng chứng |
|---|---|---|
| `VER-01` | Labor policy đã có các field giờ làm chuẩn, trần OT, ngưỡng cảnh báo, lương thử việc và ba field OT/confirmation V2 tùy chọn. | `CoreStaff/Apps/web/src/screens/LaborCompliancePolicy/LaborCompliancePolicyScreen.tsx` |
| `VER-02` | OT policy đã có ba hệ số ngày thường/nghỉ tuần/ngày lễ và có version/effective date. | `CoreStaff/Apps/web/src/screens/OvertimePayPolicy/OvertimePayPolicyScreen.tsx` |
| `VER-03` | Insurance policy đã lưu floor/cap theo từng loại; UI hiện cố ý không hard-code số tiền vì phụ thuộc thời kỳ/vùng. | `CoreStaff/Apps/web/src/screens/InsurancePolicy/components/InsurancePolicyDialogs.tsx` |
| `VER-04` | Payroll snapshot đang đóng băng salary, work credit, OT, insurance, PIT inputs, KPI bonus và lineage/hash. | `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts` |
| `VER-05` | Payroll hiện dùng `kpiBonus` trong gross, snapshot hash và payslip; KPI không chỉ là một menu UI. | `CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts`, `CoreStaff/Apps/api/src/hr/payroll/payroll-run.service.ts`, `CoreStaff/Apps/api/src/hr/payroll/payslip.service.ts` |
| `VER-06` | Không có field `hasTaxCommitment08`; `PitService` chưa resolve EmploymentContract/cam kết để chọn phương pháp khấu trừ. | `CoreStaff/Apps/api/src/hr/payroll/pit.service.ts`, tìm kiếm toàn repo |
| `VER-07` | OT PIT hiện dùng cờ nhị phân: toàn bộ OT chịu thuế hoặc toàn bộ OT miễn thuế. | `CoreStaff/Apps/api/src/hr/payroll/pit.service.ts`, `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts` |
| `VER-08` | OT/Attendance V2 là triển khai additive, chưa được phê duyệt rollout. | `.hermes/skills/project-context/references/architecture.md` |

### 2.2. Chưa xác minh — bắt buộc qua cổng pháp lý/nghiệp vụ

Các mục dưới đây không được hard-code hoặc giới thiệu là “chuẩn hiện hành” cho tới khi có hồ sơ nguồn tại `LEGAL-GATE-01`:

- Mức giảm trừ gia cảnh và biểu thuế áp dụng cho kỳ tính lương cụ thể.
- Điều kiện áp dụng khấu trừ 10% cho từng loại thỏa thuận/hợp đồng và từng lần chi trả.
- Điều kiện hợp lệ, thời hạn và bằng chứng của cam kết tạm không khấu trừ.
- Cơ sở đóng, khoản bao gồm/loại trừ, tỷ lệ, mức sàn và mức trần của BHXH/BHYT/BHTN theo ngày hiệu lực và vùng.
- Cách tách phần thu nhập OT chịu thuế và miễn thuế.
- Phạm vi OT ban đêm, ca qua đêm và các trường hợp đặc thù ngoài ba day type hiện có.

---

## 3. Các quyết định thiết kế đề xuất

> Các quyết định dưới đây là **ĐỀ XUẤT CHỜ DUYỆT**. Sau khi người dùng duyệt, đổi trạng thái tương ứng thành `ĐÃ CHỐT` trước khi triển khai.

| ID | Quyết định đề xuất | Trạng thái |
|---|---|---|
| `DEC-01` | Phân nhóm Labor Policy chỉ là thay đổi trình bày; không đổi field, default, validation, effective-date hay semantics V1/V2. | ĐÃ DUYỆT |
| `DEC-02` | Banner OT giải thích ba hệ số là mức tối thiểu/cấu hình minh họa; day type phải lấy từ lịch/ca hiệu lực, không suy luận cứng Thứ Bảy/Chủ Nhật. | ĐÃ DUYỆT |
| `DEC-03` | Không hard-code sàn/trần bảo hiểm trong UI. Backend resolve policy theo ngày hiệu lực và vùng; snapshot lưu cả dữ liệu nguồn và số đã áp dụng. | ĐÃ DUYỆT |
| `DEC-04` | Không xác định PIT thử việc chỉ bằng `contractType === PROBATION` và không dùng boolean đơn lẻ `hasTaxCommitment08`. |ĐÃ DUYỆT |
| `DEC-05` | Payroll snapshot lưu phương pháp khấu trừ PIT, hợp đồng/cam kết nguồn, policy version và taxable base; recalculation chỉ dùng snapshot đã đóng băng. |ĐÃ DUYỆT|
| `DEC-06` | Loại bỏ hoàn toàn KPI khỏi UI, API writer, manager capability, seed mới và snapshot mới; không tạo khoản thưởng thay thế. | ĐÃ DUYỆT |
| `DEC-07` | Không xóa collection/snapshot lịch sử trong rollout đầu. Artifact lịch sử vẫn đọc đúng `kpiBonus`; artifact mới dùng `earningsContract: NO_KPI_V2` và không có KPI. | ĐÃ DUYỆT |
| `DEC-08` | Việc sửa cách tính thuế OT là một workstream riêng; không gộp âm thầm vào task thêm banner OT. | ĐÃ DUYỆT |
| `DEC-09` | Kịch bản demo chỉ dùng các flow đã pass acceptance trên tenant demo; flow chưa rollout được ghi rõ là “thiết kế/roadmap”. | ĐÃ DUYỆT |

### Cổng phê duyệt

Không triển khai source cho đến khi:

1. `DEC-01` đến `DEC-09` được duyệt hoặc có phương án thay thế rõ ràng.
2. Hoàn thành `LEGAL-GATE-01` cho mọi thay đổi làm thay đổi số tiền payroll.
3. Xác nhận có được dùng database replica-set dùng một lần cho integration/migration test hay không.

---

## 4. Kịch bản báo cáo và demo đã chuẩn hóa

### 4.1. Thông điệp mở đầu

> CoreStaff tách dữ liệu chấm công thực tế khỏi các policy quy đổi và payroll. Policy có ngày hiệu lực, phiên bản và được đóng băng vào snapshot khi chốt kỳ để kết quả lịch sử có thể kiểm tra lại. Hệ thống hỗ trợ HR cấu hình và giải trình; policy thực tế vẫn cần được doanh nghiệp phê duyệt.

Không sử dụng câu “hệ thống bảo đảm 100% tuân thủ pháp luật Việt Nam”.

### 4.2. Luồng trình bày

```mermaid
flowchart LR
    A["1. Cấu hình policy có hiệu lực"] --> B["2. Ghi nhận chấm công"]
    B --> C["3. Review và chốt kỳ công"]
    C --> D["4. Snapshot và tính payroll"]
    D --> E["5. Payslip và luồng ngoại lệ"]
```

#### Phần 1 — Policy và phạm vi cấu hình (2–3 phút)

- Labor Policy: thời giờ chuẩn, trần OT, cảnh báo, thử việc và rule nội bộ.
- Work Credit Policy: minh họa cách quy đổi phút công thành work unit; nhấn mạnh đây là policy doanh nghiệp, không phải ngưỡng luật định.
- OT Pay Policy: ba day type và version/effective date.
- Tax/Insurance Policy: trình bày giá trị đang có hiệu lực từ policy record, không đọc số hard-code trong slide.

#### Phần 2 — Chấm công và review (3 phút)

- Check-in/check-out sử dụng timestamp do server ghi nhận.
- Hiển thị giờ vào/ra, đi trễ/về sớm và số phút làm việc theo ca/lịch hiệu lực.
- Work credit được đánh giá riêng từ attendance facts.
- Nhân viên review dữ liệu kỳ công; quản lý xác nhận đúng scope được phân công.

#### Phần 3 — Chốt công và payroll (3 phút)

- HR chốt kỳ sau khi các blocker review được giải quyết.
- Hệ thống tạo immutable timesheet summary và payroll input snapshot có version/hash/lineage.
- Payroll run phải bind đúng snapshot set đã chốt.
- Payslip trình bày thu nhập, bảo hiểm, PIT và net salary theo dữ liệu snapshot.

#### Phần 4 — Alternative flows (chỉ demo flow đã pass) (3–4 phút)

- Quên check-out: tạo yêu cầu xác nhận công; không tự coi giờ đề xuất là bằng chứng OT.
- OT: giờ được duyệt và giờ có bằng chứng chấm công là hai khái niệm riêng.
- Dữ liệu thay đổi trong kỳ mở làm version review thay đổi và yêu cầu review lại.
- Kỳ đã đóng/payroll đã claim không được sửa nguồn bằng luồng thông thường.

### 4.3. Checklist trước ngày demo

- [ ] Tenant demo có đầy đủ policy hiệu lực cho tháng demo.
- [ ] Mỗi con số thuế/bảo hiểm trên màn hình khớp snapshot và ledger độc lập.
- [ ] Không dùng route hoặc flow OT V2 nếu feature flag chưa được phê duyệt.
- [ ] Không trình bày “giải trình”, “khóa quyết định HR” hoặc notification nếu flow đó chưa pass E2E.
- [ ] Chạy một happy path hoàn chỉnh: attendance → review → close → payroll → payslip.
- [ ] Chuẩn bị một alternative flow thật, không dựa trên mock UI.
- [ ] Ghi rõ các giới hạn MVP: KPI đầy đủ, OT ban đêm và một số trường hợp pháp lý đặc thù ngoài phạm vi.

---

## 5. Workstream A — Phân nhóm Labor Compliance Policy

### Mục tiêu

Cải thiện khả năng đọc form/detail mà không đổi hợp đồng backend.

### Nhóm giao diện

| Nhóm | Field hiện có | Diễn giải |
|---|---|---|
| Giờ làm việc tiêu chuẩn | `normalDailyMinutes`, `normalWeeklyMinutes` | Giới hạn thời giờ làm việc bình thường theo policy hiệu lực. |
| Giới hạn OT | `maxCombinedDailyMinutes`, `maxMonthlyOvertimeMinutes`, `maxAnnualOvertimeMinutes`, `exceptionalAnnualOvertimeMinutes` | Giới hạn tổng/ngày/tháng/năm. Ngoại lệ 300 giờ không được hiểu là mặc định cho mọi trường hợp. |
| Quy tắc OT và xác nhận công | `minimumOvertimeMinutes`, `overtimeRoundingMinutes`, `maxMonthlyAttendanceConfirmations` | Rule nội bộ/V2 tùy chọn. Để trống giữ legacy; không tự áp dụng preset `30/15/3`. |
| Thử việc và cảnh báo | `probationMinimumRate`, `warningThresholdPercent`, `legalReference` | Ngưỡng thử việc/cảnh báo và căn cứ policy. |

### File dự kiến

- Modify: `CoreStaff/Apps/web/src/screens/LaborCompliancePolicy/LaborCompliancePolicyScreen.tsx`
- Test: tạo mới hoặc mở rộng test dưới `CoreStaff/Apps/web/tests/`

### Acceptance criteria

- `LAB-UI-01`: Create và edit hiển thị đúng bốn nhóm.
- `LAB-UI-02`: Detail hiển thị cùng thứ tự/nhóm với form.
- `LAB-UI-03`: Mở rồi lưu không thay đổi field không chỉnh sửa.
- `LAB-UI-04`: Field V2 để trống vẫn giữ legacy V1; không phát sinh default ngầm.
- `LAB-UI-05`: Cảnh báo invalidation kỳ mở và trạng thái rollout V2 vẫn còn nguyên.
- `LAB-UI-06`: Keyboard focus, label, error và mobile scroll hoạt động.

---

## 6. Workstream B — Hướng dẫn OT có giới hạn phạm vi

### Nội dung banner đề xuất

> **Hướng dẫn ba nhóm hệ số OT trong phạm vi CoreStaff MVP**  
> Hệ số ngày làm việc bình thường, ngày nghỉ hàng tuần và ngày nghỉ lễ là mức tối thiểu/cấu hình theo policy đã được doanh nghiệp phê duyệt. Phân loại ngày dựa trên lịch, ca và ngày lễ hiệu lực của người lao động, không mặc định mọi Thứ Bảy/Chủ Nhật là ngày nghỉ. OT ban đêm, ca qua đêm và trường hợp đặc thù chỉ được áp dụng khi có rule và acceptance test riêng.

### File dự kiến

- Modify: `CoreStaff/Apps/web/src/screens/OvertimePayPolicy/OvertimePayPolicyScreen.tsx`
- Test: tạo mới hoặc mở rộng test dưới `CoreStaff/Apps/web/tests/`

### Acceptance criteria

- `OT-UI-01`: Banner xuất hiện ở list/form/detail phù hợp mà không che nội dung chính.
- `OT-UI-02`: Không gọi cứng Thứ Bảy/Chủ Nhật là weekly off.
- `OT-UI-03`: Ghi rõ hệ số là mức tối thiểu/cấu hình và day type do hệ thống resolve.
- `OT-UI-04`: Ghi rõ giới hạn MVP về OT ban đêm/ca qua đêm.
- `OT-UI-05`: Không thay đổi payload hay công thức OT chỉ vì thêm banner.

---

## 7. Workstream C — Loại bỏ KPI khỏi nghiệp vụ mới

### Quyết định sản phẩm đề xuất

CoreStaff ngừng toàn bộ nghiệp vụ KPI. Không tạo module hoặc khoản thưởng thay thế.

### Hợp đồng dữ liệu mới

- Snapshot mới ghi `earningsContract: NO_KPI_V2` và không ghi `kpiBonus`.
- Payroll/payslip dispatch theo contract: artifact `NO_KPI_V2` luôn bỏ KPI; artifact legacy thiếu contract hoặc `LEGACY_KPI_V1` vẫn dùng `kpiBonus` đã đóng băng.
- Không query `KpiPayrollInput` khi close/preview/integrity-check snapshot mới.
- Không có API tạo/sửa/xác nhận KPI và không còn capability manager liên quan KPI.

### Tương thích lịch sử

- Không xóa collection/schema KPI cũ trong rollout đầu.
- Snapshot cũ tiếp tục đọc `kpiBonus` và hiển thị “Thưởng KPI”.
- Snapshot mới không có khoản thay thế.
- Không đổi nhãn lịch sử nếu không có migration evidence.
- Hash mới bind `NO_KPI_V2`; hash legacy giữ thuật toán và giá trị KPI lịch sử.

### File dự kiến

- Modify: `CoreStaff/Apps/web/src/components/Sidebar.tsx`
- Modify: `CoreStaff/Apps/web/src/routes/WorkspaceRoutes.tsx`
- Modify: `CoreStaff/Apps/web/src/screens/Compensation/CompensationScreen.tsx`
- Delete KPI screens/dialogs and remove KPI client contracts.
- Remove KPI controller/service writer paths; preserve legacy schemas/registry only for historical data inspection.
- Modify: `CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts`
- Modify: `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts`
- Modify: `CoreStaff/Apps/api/src/hr/payroll/payslip.service.ts`
- Review: payroll export, seed và verifier scripts có `kpiBonus`.

### Acceptance criteria

- `INC-01`: Sidebar không còn mục “KPI kỳ lương”.
- `INC-02`: Truy cập trực tiếp route KPI cũ trả not-found/redirect được định nghĩa, không còn màn hình ẩn nhưng truy cập được.
- `INC-03`: Manager không còn route vòng qua workspace evaluation KPI cũ.
- `INC-04`: API KPI cũ không còn handler tạo/list/sửa/xác nhận.
- `INC-05`: Snapshot mới không query hoặc đóng băng KPI và ghi `NO_KPI_V2`.
- `INC-06`: Gross, taxable base, PIT, net và payslip mới không có thành phần KPI.
- `INC-07`: Hash snapshot mới bind contract `NO_KPI_V2`.
- `INC-08`: Manager capability/context không còn quyền hoặc tab đánh giá KPI.
- `INC-09`: Legacy snapshot/payslip vẫn đọc đúng mà không cần backfill phá hủy.
- `INC-10`: Export và Mobile chỉ có thể hiển thị KPI khi đọc artifact legacy thực sự chứa dòng `KPI_BONUS`.

---

## 8. Workstream D — PIT thử việc và phương pháp khấu trừ

### Nguyên tắc domain

Không suy luận phương pháp thuế chỉ từ employment status hoặc contract label. Resolver phải dựa trên dữ liệu hiệu lực tại **payment date** và policy pháp lý đã được duyệt.

### Mô hình đề xuất

#### 8.1. Tax treatment snapshot

Thêm vào payroll input snapshot contract mới:

- `pitWithholdingMethod: PROGRESSIVE | FLAT_RATE | EXEMPT_BY_COMMITMENT`;
- `pitFlatRate` nếu dùng flat rate;
- `taxableIncomeSubjectToFlatRate`;
- `residencyStatus`;
- `paymentDate`;
- `employmentContractId`, `contractType`, contract effective window;
- `taxCommitmentId`, commitment effective window/status nếu có;
- `taxPolicyId`, `taxPolicyVersion`, `legalReference`;
- `taxTreatmentResolvedAt` và resolver contract version.

#### 8.2. Cam kết thuế

Nếu nghiệp vụ duyệt hỗ trợ cam kết, tạo record riêng thay vì boolean trên EmployeeProfile:

- tenant và employee owner;
- loại/mã biểu mẫu;
- kỳ/năm và effective window;
- trạng thái `DRAFT | VERIFIED | REVOKED | EXPIRED`;
- reference tới tài liệu bảo mật nếu có;
- người xác minh/thời điểm xác minh;
- không lưu file nhạy cảm ở public URL.

### Luồng xử lý

1. Khi close period, resolve hợp đồng hiệu lực và tax treatment theo payment date.
2. Fail closed nếu thiếu hoặc có nhiều hợp đồng/xử lý thuế mâu thuẫn.
3. Đóng băng treatment và taxable base vào snapshot.
4. Payroll run chỉ đọc snapshot; không query live contract/cam kết khi calculate/recalculate.
5. Payslip hiển thị phương pháp khấu trừ và căn cứ ở mức phù hợp, không lộ tài liệu nhạy cảm.

### File dự kiến

- Modify: `CoreStaff/Apps/api/src/database/schemas/employment-contract.schema.ts` nếu cần phân biệt hình thức thử việc; ưu tiên additive field/record.
- Create: schema/service/DTO cho tax commitment nếu `DEC-05` được duyệt.
- Modify: registry/module registration tương ứng.
- Modify: `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts`
- Modify: `CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts`
- Modify: `CoreStaff/Apps/api/src/hr/payroll/pit.service.ts`
- Modify: `CoreStaff/Apps/api/src/hr/payroll/payroll-run.service.ts`
- Modify: `CoreStaff/Apps/api/src/hr/payroll/payslip.service.ts`
- Add: migration/inspection script read-only by default dưới `CoreStaff/Apps/api/scripts/` nếu schema contract yêu cầu.

### Acceptance criteria

- `PIT-PROB-01`: Thỏa thuận thuộc progressive method được tính theo policy bracket đã snapshot.
- `PIT-PROB-02`: Thỏa thuận thuộc flat-rate method dưới ngưỡng mỗi lần chi trả cho kết quả đã được policy duyệt.
- `PIT-PROB-03`: Flat-rate method đạt ngưỡng, không có cam kết hợp lệ.
- `PIT-PROB-04`: Cam kết `VERIFIED` và còn hiệu lực tại payment date.
- `PIT-PROB-05`: Cam kết hết hạn/thu hồi không được áp dụng.
- `PIT-PROB-06`: Non-resident hoặc case ngoài resolver contract fail closed/đi theo rule đã duyệt, không rơi vào progressive mặc định.
- `PIT-PROB-07`: Taxable base không mặc nhiên bằng gross; khoản miễn/không thuộc base được xử lý đúng policy.
- `PIT-PROB-08`: Hai hợp đồng cùng hiệu lực gây lỗi domain ổn định.
- `PIT-PROB-09`: Recalculation giữ nguyên treatment snapshot dù master data đã đổi.
- `PIT-PROB-10`: Tenant isolation và authorization cho cam kết/treatment.

---

## 9. Workstream E — Insurance effective-dated theo vùng

### Nguyên tắc

- Không dùng một `maxContributionBase` chung cho cả ba loại.
- Không coi “không nhập floor/cap” là cho phép payroll mới chạy không giới hạn.
- Không hiển thị một số tiền là “hiện hành” nếu thiếu ngày hiệu lực, vùng và nguồn.

### Policy contract đề xuất

Mỗi policy version phải xác định:

- `region` hoặc scope áp dụng;
- `regionalMinimumWage` và nguồn/ngày hiệu lực;
- `referenceAmount` và nguồn/ngày hiệu lực khi áp dụng;
- employee/employer rate theo từng loại;
- floor/cap rule theo từng loại;
- số floor/cap đã dẫn xuất;
- `effectiveFrom`, `effectiveTo`, version, legal reference.

Snapshot mới nên lưu `insuranceLines[]`, mỗi dòng gồm:

- type;
- uncapped basis;
- floor/cap applied;
- contribution basis;
- employee/employer rate;
- employee/employer amount;
- policy ID/version/legal reference.

### File dự kiến

- Modify: `CoreStaff/Apps/api/src/database/schemas/insurance-policy.schema.ts`
- Modify: DTO/service dưới `CoreStaff/Apps/api/src/hr/insurance-policy/`
- Modify: `CoreStaff/Apps/api/src/hr/insurance-policy/insurance-calculation.ts`
- Modify: `CoreStaff/Apps/web/src/screens/InsurancePolicy/components/InsurancePolicyDialogs.tsx`
- Modify: `CoreStaff/Apps/api/src/database/schemas/payroll-input-snapshot.schema.ts`
- Modify: `CoreStaff/Apps/api/src/hr/timesheet/payroll-snapshot.service.ts`
- Review/deprecate fallback trong `CoreStaff/Apps/api/src/hr/payroll/insurance.service.ts`

### Acceptance criteria

- `INS-01`: Resolve đúng policy theo organization, region và payment/work period date đã chốt.
- `INS-02`: BHXH, BHYT, BHTN áp floor/cap độc lập.
- `INS-03`: Basis dưới floor, giữa khoảng và trên cap cho kết quả đúng từng dòng.
- `INS-04`: Thiếu policy bắt buộc làm close/payroll mới fail với domain error ổn định.
- `INS-05`: Snapshot lưu uncapped basis, applied basis, rates, amounts và policy lineage.
- `INS-06`: Policy mới không thay đổi snapshot/payroll lịch sử.
- `INS-07`: UI chỉ hiển thị số minh họa kèm region/effective date/source; không tự điền vào form khi mở.
- `INS-08`: Migration đọc legacy contribution base mà không bịa ba base đã mất.

---

## 10. Workstream F — Chuẩn hóa phần thuế OT

Đây là workstream riêng và chỉ triển khai sau khi `LEGAL-GATE-01` chốt công thức.

### Hướng thiết kế

Thay cờ nhị phân `overtimeTaxable` trong contract mới bằng breakdown đóng băng:

- `otGrossPay`;
- `otNormalPayComponent`;
- `otPremiumComponent`;
- `otTaxableAmount`;
- `otExemptAmount`;
- rate/day-type evidence;
- policy/resolver contract version.

Snapshot cũ tiếp tục dispatch theo contract cũ; không diễn giải lại lịch sử.

### Acceptance criteria tối thiểu

- `OT-TAX-01`: Gross OT bằng taxable + exempt components.
- `OT-TAX-02`: Không trừ phần miễn thuế hai lần.
- `OT-TAX-03`: Working day/weekly off/public holiday reconcile với hourly rate và frozen minutes.
- `OT-TAX-04`: Legacy snapshot vẫn dùng legacy contract.
- `OT-TAX-05`: Payslip hiển thị breakdown đủ để giải trình.

---

## 11. LEGAL-GATE-01 — Hồ sơ nguồn trước khi đổi công thức tiền

Mỗi rule phải có một record review trong tài liệu hoặc bảng kiểm riêng:

| Field | Yêu cầu |
|---|---|
| `ruleId` | Mã ổn định, ví dụ `PIT-FLAT-10-2026` |
| Văn bản | Tên và số văn bản chính thức |
| Điều/khoản | Vị trí chính xác trong văn bản |
| URL | Nguồn chính thức có thể truy cập lại |
| Ngày ban hành/hiệu lực | Hai ngày tách biệt |
| Đối tượng/phạm vi | Resident/non-resident, loại hợp đồng, loại thu nhập, vùng... |
| Công thức/giá trị | Không chỉ ghi kết luận prose |
| Ngoại lệ | Cam kết, miễn/giảm, trường hợp đặc thù |
| Người xác nhận | HR/người phụ trách pháp lý |
| Ngày kiểm tra | Phục vụ audit |
| Test IDs | Các acceptance case chứng minh rule |

**Gate pass khi:** mọi rule làm thay đổi gross, insurance, taxable base, PIT hoặc net đều có record đầy đủ và được duyệt. Nếu chưa có nguồn chính thức, giữ trạng thái `UNVERIFIED` và không triển khai công thức.

---

## 12. Thứ tự triển khai

### Phase 0 — Khóa quyết định và nguồn

1. Duyệt `DEC-01` đến `DEC-09`.
2. Hoàn thành `LEGAL-GATE-01`.
3. Lập independent payroll ledger cho một nhân viên chính thức và một trường hợp thử việc.
4. Ghi baseline test hiện tại; không dùng số test cũ làm bằng chứng mới.

**Exit gate:** quyết định không còn mâu thuẫn; mọi công thức tiền có nguồn và expected ledger.

### Phase 1 — UI-only, rủi ro thấp

1. Workstream A: group Labor Policy.
2. Workstream B: OT banner có giới hạn phạm vi.
3. Targeted Web tests, typecheck và build.

**Exit gate:** không có API/schema/default/seed change; form round-trip không drift.

### Phase 2 — Tinh giản KPI

1. Viết RED tests cho route/menu/legacy compatibility.
2. Thêm earnings contract `NO_KPI_V2` theo hướng additive.
3. Ngừng KPI writer và loại KPI khỏi snapshot/hash/payroll/payslip mới.
4. Xóa KPI UI, capability và chặn deep link.
5. Chạy migration inspection read-only; không xóa dữ liệu cũ.

**Exit gate:** `INC-01..10` pass và legacy fixtures vẫn đọc được.

### Phase 3 — PIT thử việc

1. Viết RED tests `PIT-PROB-01..10` từ ledger độc lập.
2. Thêm tax treatment/commitment model và authorization.
3. Resolve tại close, đóng băng snapshot, dispatch payroll theo contract.
4. Migration additive + rollback/feature-disable path.

**Exit gate:** PIT/payslip reconcile trong sai số tối đa 1 VND; recalculation không đọc master data mới.

### Phase 4 — Insurance và OT tax

1. Chuẩn hóa insurance lines và region/effective dating.
2. Loại bỏ fallback không có căn cứ cho contract mới.
3. Sau khi pháp lý duyệt, triển khai OT taxable/exempt split thành workstream riêng.

**Exit gate:** `INS-01..08`, `OT-TAX-01..05` pass; snapshot lịch sử bất biến.

### Phase 5 — Rehearsal demo

1. Seed prerequisite trên database dùng một lần được phê duyệt.
2. Thực hiện business transitions thật, không seed trạng thái cuối.
3. Reconcile API/read model/payslip/export với ledger độc lập.
4. Chạy browser E2E happy path và một alternative flow.
5. Chốt script hội đồng chỉ với capability đã pass.

---

## 13. Chiến lược test và lệnh xác minh

Chạy từ `CoreStaff/`, theo thứ tự narrow → broad:

1. Targeted unit/Web tests cho từng workstream.
2. `npm run lint`
3. `npm run build`
4. `npm test`
5. Integration chỉ trên MongoDB replica set dùng một lần, đã chứng minh không fallback sang URI mặc định.
6. Web E2E với backend thật của môi trường test.
7. Migration `inspect → dry-run → apply → verify → rollback rehearsal` khi được cấp quyền.

### Database safety gate

Trước mọi integration/migration/seed:

- unset URI production/default;
- in rõ database target dùng một lần;
- xác nhận harness tự tạo database/replica set;
- cấm chạy nếu thiếu target hoặc target trùng production;
- không chạy `ensure-indexes`, seed hay migration apply nếu chưa được người dùng phê duyệt.

### Definition of done toàn chương trình

- Tất cả acceptance IDs thuộc scope đã pass.
- Không tăng baseline failures.
- Lint/build/unit/integration/E2E theo tier đã định đều có output thật.
- Independent ledger ↔ snapshot ↔ payroll result ↔ payslip ↔ export lệch không quá 1 VND.
- Legacy artifacts vẫn đọc được.
- Không có policy number hard-code không kèm ngày hiệu lực/nguồn.
- Tài liệu demo khớp capability đã chạy thật.
- Project context/architecture/decision records được cập nhật cùng thay đổi contract.

---

## 14. Rollout và rollback

### Rollout

- Dùng schema additive và calculation contract version.
- Reader hiểu cả legacy và contract mới trước khi writer phát sinh dữ liệu mới.
- Feature flag/cutover explicit theo tenant nếu thay đổi payroll semantics.
- Chỉ bật sau migration inspect và acceptance đầy đủ.

### Rollback

- Tắt writer contract mới, giữ reader tương thích.
- Không xóa snapshot/artifact mới hoặc lịch sử KPI cũ.
- Không chuyển ngược dữ liệu bằng cách diễn giải mất thông tin.
- Nếu payroll đã release/viewed, sửa bằng reversal/adjustment; không rewrite lịch sử.

---

## 15. Rủi ro chính

| Rủi ro | Hậu quả | Giảm thiểu |
|---|---|---|
| Dùng số pháp lý không đúng ngày hiệu lực | Sai PIT/insurance/net | `LEGAL-GATE-01`, effective dating, snapshot lineage |
| Chỉ ẩn KPI trên menu | Deep link và pipeline cũ vẫn hoạt động | Chặn route, đổi input contract, kiểm tra snapshot/export/mobile |
| Resolve live contract khi calculate | Recalculation kỳ cũ thay đổi kết quả | Resolve ở close và đóng băng snapshot |
| Một cap chung cho ba loại bảo hiểm | Sai contribution amount | `insuranceLines[]` theo từng loại |
| Đổi nghĩa field cũ | Sai lịch sử/hash | Contract version, legacy dispatch, additive migration |
| Demo flow chưa rollout | Mất uy tín trước hội đồng | Demo checklist và real E2E gate |
| Gộp OT UI với OT tax | Thay đổi tiền ngoài dự kiến | Workstream và acceptance riêng |

---

## 16. Phê duyệt cần có trước khi bắt đầu

- [X] Duyệt `DEC-01`: Labor grouping là UI-only.
- [X] Duyệt `DEC-02`: OT banner có giới hạn MVP.
- [X] Duyệt `DEC-03`: Insurance không hard-code số ở UI.
- [X] Duyệt `DEC-04` và `DEC-05`: Tax treatment snapshot thay cho `PROBATION + boolean`.
- [X] Duyệt `DEC-06` và `DEC-07`: bỏ hẳn KPI, không thay thế; giữ legacy compatibility.
- [X] Duyệt `DEC-08`: OT tax là workstream riêng.
- [X] Duyệt `DEC-09`: chỉ demo flow đã pass.
- [X] Cung cấp/xác nhận người duyệt `LEGAL-GATE-01`.
- [X] Cho phép hoặc từ chối rõ việc dùng disposable MongoDB replica set cho test.

**Sau khi các mục trên được duyệt:** đổi trạng thái tài liệu thành `APPROVED FOR IMPLEMENTATION`, khóa expected ledger và bắt đầu Phase 1 theo TDD. Không commit/push/deploy nếu chưa có yêu cầu riêng.