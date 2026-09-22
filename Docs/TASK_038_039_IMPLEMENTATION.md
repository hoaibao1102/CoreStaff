# TASK-038 / TASK-039 — Nhật ký triển khai

Ngày: 2026-09-22. Xem `Docs/DOCS_DECISION_LOG.md` D32 cho quyết định phạm vi.

## Phạm vi

TASK-038 (InsuranceProfile) và TASK-039 (InsurancePolicy rate/base/caps) cần
`insuranceSalary` (SalaryProfile, §30D.1) và trạng thái hợp đồng (EmploymentContract,
§30A.2) để tính đúng nghiệp vụ — hai module này chưa có code trong repo. Đã bổ sung
bản nền tối thiểu-đủ:

- **TASK-028** EmploymentContract: field theo §30A.2 (`contractType`, `startDate`,
  `endDate`, `documentRef`). Không làm TASK-029 (upload file), TASK-030 (UI cảnh báo
  hết hạn), TASK-031 (validate lương thử việc) — ngoài phạm vi công thức bảo hiểm.
- **TASK-032** SalaryProfile: field theo §30D.1, dùng nguyên văn.
- **TASK-038** InsuranceProfile: **field list là đề xuất kỹ thuật** — SRS trước đó
  chỉ nêu tên, chưa có field-level spec (xác nhận qua audit tài liệu toàn bộ `Docs/`
  ngày 2026-09-22, không sót ở file nào khác).
- **TASK-039** InsurancePolicy: field list đã có sẵn trong SRS §30D.3 (dùng nguyên
  văn); riêng **shape của `salaryBaseRules`/`capRules`** (đối tượng `{type,
  floorAmount|capAmount}`) là đề xuất kỹ thuật — SRS chỉ nêu tên hai field này,
  không có shape hay giá trị capMultiplier/lương tối thiểu vùng nào.

Không đụng TASK-033..037 (Allowance/AttendanceBonusPolicy/KPI/LaborCompliancePolicy/
OvertimePayPolicy) — các module đó không ảnh hưởng công thức BHXH/BHYT/BHTN.
Không sửa `TASK_BACKLOG_9_WEEKS.md`/`MILESTONE_9_WEEKS.md` (D30 freeze).

## Nguyên tắc "không tự chế" đã áp dụng

- Mọi rate/floor/cap seed mặc định `null`/không set — không hard-code số liệu pháp
  lý nào (kể cả trong ví dụ Swagger: `employerContributionRates` ví dụ dùng 0.1 cho
  cả ba khoản, ghi rõ "Illustrative only", không dùng số thật 17.5%/3%/1%).
  `socialInsuranceEmployeeRate`/`healthInsuranceEmployeeRate`/
  `unemploymentInsuranceEmployeeRate` ví dụ 8%/1.5%/1% lấy nguyên văn từ SRS §30D.3
  ("Seed phía người lao động"), không phải số tự thêm.
- `InsuranceProfile.exemptionReason` được cân nhắc rồi bỏ (thay bằng `note` tự do) vì
  một enum lý do miễn trừ (ví dụ "FOREIGN_BILATERAL_AGREEMENT") sẽ là tự tạo taxonomy
  pháp lý không có trong Docs/.
- `EmploymentContract.contractType` dùng đúng 3 giá trị `PROBATION | FIXED_TERM |
  INDEFINITE_TERM` từ §30A.2 — bản nháp đầu tiên có tự thêm `SEASONAL_UNDER_ONE_MONTH`
  và một quy tắc "hợp đồng ≥1 tháng mới bắt buộc BHXH" tự suy ra; bản này đã bỏ vì
  §30A.3 nói rõ ngược lại: contractType/employmentStatus không tự quyết định nghĩa vụ
  bảo hiểm — HR cấu hình qua `InsuranceProfile.participates*`.

## Acceptance criterion → Implementation → Test

| Tiêu chí | Triển khai | Test | Trạng thái |
|---|---|---|---|
| AC-CONTRACT-01 tenant scope | `ContractService` mọi query có `organizationId` | `contract.service.spec.ts` "does not leak a contract across tenants" | Đạt |
| §30A.2 loại hợp đồng đúng 3 giá trị, endDate bắt buộc trừ INDEFINITE_TERM | `ContractType` enum, `CreateContractDto` `ValidateIf` | DTO validation (không có test riêng — logic đơn giản, phủ qua service test) | Đạt |
| §30A.2 không hard-delete, lịch sử qua nhiều document | `ContractService` không có update/delete endpoint; mỗi giai đoạn là 1 document | `contract.service.spec.ts` "allows a renewal contract..." | Đạt |
| Không chồng giai đoạn hợp đồng | `rangesOverlap` trong `create()` | `contract.service.spec.ts` "rejects an overlapping contract period" | Đạt |
| §30D.1 SalaryProfile field đúng, insuranceSalary tách biệt baseSalary | `SalaryProfileService`/schema | `salary-profile.service.spec.ts` | Đạt |
| SalaryProfile versioned, không sửa tại chỗ | `create()` luôn insert mới, tăng version | `salary-profile.service.spec.ts` "increments version..." | Đạt |
| AC-INS-02 chỉ tính khoản participates=true | `InsuranceProfileService` + `calculateInsuranceContributions` | `insurance-profile.service.spec.ts`, `insurance-calculation.spec.ts` "only participating..." | Đạt |
| §30A.3 participation không tự suy từ Contract/employmentStatus | Không có logic derive tự động trong `InsuranceProfileService`; `participates*` luôn do HR truyền vào DTO | `insurance-profile.service.spec.ts` "allows a false participation flag..." | Đạt |
| AC-INS-01 dùng insuranceSalary, không phải grossSalary×10.5% | `calculateInsuranceContributions` nhận `insuranceSalary` làm tham số riêng | `insurance-calculation.spec.ts` "never uses grossSalary × 10.5%..." | Đạt |
| AC-INS-03 floor/cap riêng từng khoản | `clampToBase()` trong `insurance-calculation.ts` | `insurance-calculation.spec.ts` "AC-INS-03: base is floored and capped..." | Đạt |
| AC-INS-05/AC-PAYROLL-02 employer cost tách biệt, không trừ Net Salary | `employerInsuranceCost` field riêng, không cộng trừ vào `mandatoryEmployeeInsurance` | `insurance-calculation.spec.ts` "AC-PAYROLL-02..." | Đạt (đơn vị — chưa nối vào PayrollRun vì module đó chưa tồn tại) |
| InsurancePolicy phải cấu hình đủ cả 3 khoản | `assertCoversAllTypes()` trong `InsurancePolicyService` | `insurance-policy.service.spec.ts` "rejects a policy missing..." / "rejects a duplicated..." | Đạt |
| AC-INS-04 version mới không sửa version cũ, không chồng hiệu lực | `rangesOverlap` + version tăng dần trong cả 3 service versioned | `*.service.spec.ts` các test overlap/version | Đạt |
| AC-INS-06 chỉ HR, tenant scope, 404 ngoài tenant | `@Roles('HR')` + `requireOrganizationId` trên cả 4 controller | Theo pattern có sẵn (Position/Employee); chưa có controller-level test riêng (repo hiện không có test tầng controller cho các module khác) | Đạt ở service layer |
| Index tenant/employee/effectiveFrom | Index trên cả 4 schema | `database/indexes.spec.ts` (4 test mới) | Đạt |

## Rà soát lại 2026-09-22 (sau khi bàn giao lần đầu)

Theo yêu cầu rà soát lại toàn bộ để chắc không có lỗi logic:

- Sửa ví dụ Swagger `EmployerContributionRateDto.rate` từ `0.175` (trùng đúng rate
  BHXH doanh nghiệp thật ngoài đời) sang `0.1` kèm ghi chú "Illustrative only" —
  tránh để lọt một số liệu pháp lý trông như đã được xác nhận.
- **Phát hiện lỗi logic thật:** `InsurancePolicyService.create()` trước đó không
  kiểm tra `floorAmount ≤ capAmount` của cùng một khoản. Nếu HR nhập nhầm floor lớn
  hơn cap, `clampToBase()` trong `insurance-calculation.ts` sẽ âm thầm kẹp base về
  cap (thấp hơn floor), cho ra kết quả sai mà không có cảnh báo. Đã thêm
  `assertFloorBelowCap()` chặn ở bước tạo policy (400
  `INSURANCE_POLICY_FLOOR_ABOVE_CAP`) + 2 test mới (chặn floor>cap, cho phép
  floor=cap). Đã cập nhật `SRS_CORESTAFF.md` §30H.
- Xác nhận lại: không có race condition nghiêm trọng bị bỏ sót ở mức nghiêm trọng
  cho MVP — check-chồng-giai-đoạn (`rangesOverlap`) là kiểm tra ở tầng application,
  không có DB constraint atomic backstop (Mongo không biểu diễn được unique theo
  khoảng ngày). Rủi ro: 2 request tạo đồng thời cho cùng nhân viên/tổ chức có thể
  cả hai đều pass check trước khi ghi, tạo ra 2 giai đoạn chồng nhau. Giống hệt
  mức rủi ro của các module CRUD khác trong repo (vd Position dựa vào unique index
  làm backstop cho trường đơn giản; range overlap không có backstop tương đương).
  Chấp nhận được cho MVP 1 HR/tổ chức, ghi nhận ở đây để không bị coi là đã bỏ sót.
- Chạy lại: build + lint PASS; 7 suite mới/sửa PASS 51/51 test (tăng từ 49 sau khi
  thêm 2 test floor/cap).

## Giới hạn

- Chưa có PayrollInputSnapshot/PayrollRun (module đó thuộc sprint sau) nên
  `calculateInsuranceContributions` chưa được gọi từ một luồng payroll thật —
  chỉ là engine đã unit-test đầy đủ theo AC-INS-01..05, sẵn sàng để luồng payroll
  tương lai gọi vào.
- Route `/hr/insurance-profiles` là đề xuất (không có trong route table gốc); nếu
  frontend/BA có tên khác, đổi tại `insurance-profile.controller.ts` — không ảnh
  hưởng data model.
- Không có UI web cho 4 module này trong lần này (TASK-028 gốc có nhắc "UI" nhưng
  scope lần này giới hạn ở phần InsuranceProfile/InsurancePolicy cần, không mở
  rộng sang màn hình quản lý hợp đồng đầy đủ).

## Kiểm chứng

- `npm run build --workspace @corestaff/api`: PASS.
- `npm run lint --workspace @corestaff/api` (tsc --noEmit): PASS.
- `npx jest hr/contract hr/salary-profile hr/insurance-profile hr/insurance-policy database/indexes.spec.ts common/effective-dating.spec.ts --runInBand`: PASS, 7 suites / 49 tests.
- Full `npm run test --workspace @corestaff/api`: 4 suites thất bại (`auth/auth.service.spec.ts`, `hr/workplace/workplace.service.spec.ts`) — xác nhận **có sẵn từ trước, không liên quan** đến thay đổi này: không file nào trong hai suite đó (hay code chúng test) bị chạm tới, và chạy lại riêng hai suite này (không kèm code mới) vẫn thất bại y hệt (timeout bcrypt + lỗi mock `setActive` không liên quan Contract/Salary/Insurance). Cần một phiên riêng để điều tra, ngoài phạm vi TASK-038/039.
