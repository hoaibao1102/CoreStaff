# QC Review — CoreStaff Documentation (Full QC, trừ Milestone & Task)

> **Ngày:** 12/09/2026 (re-QC sau fix NC-1 = A)  
> **Phạm vi lần này:** `SRS_CORESTAFF.md`, `CORESTAFF_PROJECT_PROPOSAL.md`, `CoreStaff_Context_Diagram.md`, `Use case diagram.md` (+ SVG liên kết), `DOCS_DECISION_LOG.md`, `index.html` (wiki)  
> **Loại trừ:** `MILESTONE_9_WEEKS.md`, `TASK_BACKLOG_9_WEEKS.md`, `TASK_BACKLOG_9_WEEKS.csv`  
> **Baseline:** SRS v4.0 — HRM & Payroll  
> **Source of truth:** SRS; Decision Log là changelog scope.

---

## 1. QC Summary

| Mức độ | Số lượng |
|---|---:|
| **Critical** | **0** |
| **High** | **0** |
| **Medium** | **0** |
| **Low** | **0** mở |
| **Need Clarification** | **0** |

**Verdict:** **PASS.** Đã chốt **NC-1 = A** (MVP không ghi `EmployeeDayOverride` ngoài LeaveRequest apply) và đồng bộ public docs + wiki.

---

## 2. Ma trận đồng bộ Decision → Public docs

| Decision | Log | SRS | Proposal | Context | Use Case | Ghi chú |
|---|:---:|:---:|:---:|:---:|:---:|---|
| D01 OTPay @ Payroll | ✅ | ✅ | ✅ | ✅ | ✅ | Tham chiếu `30D.2` |
| D02 Payroll nội bộ | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| D03 Must Have 4A/4B | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| D04 Leave Emp→Mgr→HR | ✅ | ✅ | ✅ | ✅ | ✅ | NC-1 A: cấm CRUD override thẳng |
| D06–D21 | ✅ | ✅ | ✅/— | ✅/— | ✅/— | Không mở lại |

---

## 3. Đã sửa trong vòng này (QC7 → Done)

| ID cũ | Việc đã làm |
|---|---|
| **QC7-001 / NC-1** | `FR-HRCFG-05` chỉ calendar; `FR-LEAVE-03` + `BR-LEAVE-03` + `AC-LEAVE-04`; API bỏ CRUD overrides; model thêm `leaveRequestId`; D04 cập nhật |
| **QC7-002** | Routes `/app/leave*`, `/manager/leave*`, `/hr/leave-requests*` + GET queue APIs |
| **QC7-003** | Thêm **UC-13** LeaveRequest Emp→Mgr→HR apply |
| **QC7-004** | §1.4 thêm bullet demo Leave |
| **QC7-005 / QC7-011** | §1.3 + Proposal ngoài-MVP: Leave nâng cao (quota…); flow request thuộc MVP |
| **QC7-006** | §3.1 Employee: thêm gửi LeaveRequest |
| **QC7-007** | Context Policy Sources + Bonus/Allowance |
| **QC7-008** | Decision Log D01: `29D.2` → `30D.2` |
| **QC7-009** | Note `protoype/src` (tên thư mục hiện tại) |
| **QC7-010** | Phase 2: Calendar + LeaveRequest workflow |
| Wiki | Đồng bộ các đoạn tương ứng trong `index.html` |

---

## 4. Need Clarification

Không còn NC mở liên quan Leave override.

---

## 5. Những điểm đã ổn (không mở lại)

- OT phút vs tiền OT (Payroll); multi-tenant / RBAC / self-approval / ApprovalDelegation  
- REJECTED blocker; Payslip LOCKED/PAID; overallApprovalStatus; VND rounding  
- AttendanceBonus template; Allowance hybrid; Leave state machine  
- NestJS + MongoDB replica set + ReactJS Web MVP; React Native Employee app = SHOULD  

---

## 6. Checklist

- [x] NC-1 = A → `FR-HRCFG-05` + API overrides  
- [x] Routes Leave §14  
- [x] UC-13 Leave  
- [x] §1.3 / §1.4 / §3.1  
- [x] Context Policy Sources  
- [x] Decision Log `30D.2` + D04 NC-1  
- [x] Proposal ngoài-MVP leave  
- [x] Wiki `index.html` đồng bộ  

---

## 7. Kết luận

| Câu hỏi | Trả lời |
|---|---|
| Docs public sẵn sàng Sprint Leave? | **Có.** |
| Còn Critical/High? | **Không.** |
| Milestone/Task có bị review? | **Không** (theo yêu cầu). |

---

## 8. Re-QC delta D36 — Department Manager Workspace

> **Ngày:** 22/09/2026  
> **Phạm vi:** SRS, Proposal, Context, Use Case, Design Master, Decision Log, backlog append-only, SVG liên quan và wiki public.  
> **Governance:** Không sửa Milestone hoặc TASK-001…TASK-119; chỉ append TASK-120…TASK-126.

| Gate | Kết quả |
|---|---|
| Manager là Employee + quyền quản lý | ✅ Đồng bộ |
| Navigation desktop: Cá nhân / Quản lý → Phòng ban | ✅ Đồng bộ |
| Phòng ban: Phê duyệt + Đánh giá nhân sự | ✅ Đồng bộ |
| Đánh giá nhân sự giới hạn KPI kỳ lương | ✅ Đồng bộ |
| ManagerAssignment hỗ trợ nhiều phòng | ✅ Đồng bộ |
| Employee/approval/OT/KPI bị scope server-side | ✅ Đồng bộ |
| Network/GPS hợp lệ không cần duyệt từng ngày | ✅ Đồng bộ |
| Responsive web desktop + mobile-web nghiệm thu trước Expo | ✅ Đồng bộ |
| Expo dùng chung API, chỉ triển khai sau Mốc Web | ✅ Đồng bộ |
| Frozen task fingerprint TASK-001…118 | ✅ Không đổi |
| Backlog TASK-001…126 | ✅ ID liên tục, 19 cột |
| Markdown fences | ✅ Cân bằng |
| SVG XML | ✅ Hợp lệ |
| Wiki ID/fragment | ✅ Không trùng, không link chết |

**Verdict D36:** **PASS — tài liệu sẵn sàng để người dùng duyệt trước khi triển khai source code.**

---

*Full QC after NC-1 = A fix + D36 delta review — `QC_REVIEW_CORESTAFF_DOCS.md`*
