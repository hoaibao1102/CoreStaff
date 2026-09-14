# CoreStaff — Planning Freeze Governance

> **Decision:** D30 — Milestone và Task Backlog đóng băng.  
> **Scope:** `MILESTONE_9_WEEKS.md`, TASK-001…TASK-118 trong `TASK_BACKLOG_9_WEEKS.md` và mọi bản CSV tương ứng.  
> **Effective immediately.**

## Rule

1. Không sửa `MILESTONE_9_WEEKS.md` sau khi baseline D30 được tạo.
2. Không sửa, xóa, đổi ID, sắp xếp lại hoặc cập nhật bất kỳ field nào của TASK-001…TASK-118.
3. Mọi yêu cầu mới, bug, scope delta, tech-stack delta, QC action hoặc công việc phát sinh phải append thành task mới.
4. Task mới tiếp theo là `TASK-119`; không được tái sử dụng ID cũ.
5. Task mới giữ đúng 19 cột hiện hành. Markdown và CSV phải được append cùng nội dung trong một thao tác.
6. Nếu cần ghi trạng thái triển khai của task cũ, dùng hệ thống issue/PR hoặc nhật ký thực thi riêng; không sửa baseline task trong Docs.
7. Wiki không publish Milestone, Task Backlog, Decision Log, QC hoặc file governance này.

## Append procedure

```text
Đọc task ID cuối
→ xác nhận TASK-118 và baseline hash không đổi
→ tạo TASK-119 (hoặc ID kế tiếp)
→ append cuối bảng Markdown trước marker FROZEN
→ append cùng record vào CSV
→ verify 19 cột + ID liên tục + task cũ byte-identical
```

## Baseline fingerprint

```text
Milestone SHA-256: e7bc8afa394d77907889af6366373b879e5074f706c744960ae0f4c0d4fb8f9d
TASK-001..TASK-118 rows SHA-256: 107f6ec11681fd3f1911c0f0ecece7bc8f8c0744727c136fee23c14e2e81dec0
Frozen task count: 118
Next task ID: TASK-119
```

> Fingerprint chỉ được cập nhật khi người dùng hủy D30 bằng quyết định mới rõ ràng. Append TASK-119+ không làm thay đổi hash của TASK-001…118.
