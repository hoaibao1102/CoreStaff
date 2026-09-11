# TimeLock System - Context Diagram

![TimeLock Context Diagram](TimeLock_Context_Diagram.svg)

> **Ghi chú:** Sơ đồ ngữ cảnh hệ thống (DFD Level 0) mô tả luồng tương tác hai chiều giữa TimeLock System và các actor bên ngoài. Có thể mở trực tiếp file vector sắc nét tại [TimeLock_Context_Diagram.svg](TimeLock_Context_Diagram.svg).

---

## Sơ đồ Mermaid (Source Code)

```mermaid
%%{init: {
  "theme": "base",
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 70,
    "rankSpacing": 110,
    "htmlLabels": true
  },
  "themeVariables": {
    "fontFamily": "Segoe UI, Arial",
    "fontSize": "13px",
    "lineColor": "#262626",
    "textColor": "#111827"
  }
}}%%

flowchart LR
    subgraph LEFT[" "]
        direction TB
        ADMIN["<b>System Admin</b>"]
        EMPLOYEE["<b>Employee</b>"]
    end

    subgraph CENTER[" "]
        direction TB
        TIMELOCK((("<b>TimeLock System</b>")))
    end

    subgraph RIGHT[" "]
        direction TB
        HR["<b>Nhân sự - HR</b>"]
        MANAGER["<b>Department Manager</b>"]
    end

    ADMIN -->|"Thông tin tổ chức<br/>Thông tin tài khoản HR ban đầu<br/>Trạng thái tổ chức"| TIMELOCK
    TIMELOCK -->|"Thông tin tổ chức<br/>Thông tin tài khoản HR<br/>Nhật ký hoạt động hệ thống<br/>Trạng thái dịch vụ"| ADMIN

    EMPLOYEE -->|"Thông tin chấm công vào/ra<br/>Bằng chứng chấm công<br/>Thông tin vị trí làm việc<br/>Giải trình chấm công<br/>Yêu cầu điều chỉnh chấm công<br/>Yêu cầu ca làm việc<br/>Yêu cầu làm thêm giờ"| TIMELOCK
    TIMELOCK -->|"Lịch và ca làm việc<br/>Trạng thái chấm công<br/>Lịch sử chấm công<br/>Thông tin giờ làm việc<br/>Trạng thái yêu cầu<br/>Kết quả phê duyệt<br/>Bảng công cá nhân"| EMPLOYEE

    HR -->|"Thông tin phòng ban<br/>Thông tin nhân viên<br/>Thông tin địa điểm làm việc<br/>Cấu hình ca làm việc<br/>Lịch làm việc<br/>Dữ liệu điều chỉnh chấm công<br/>Thông tin kỳ bảng công"| TIMELOCK
    TIMELOCK -->|"Danh sách phòng ban và nhân viên<br/>Dữ liệu chấm công toàn tổ chức<br/>Yêu cầu điều chỉnh chấm công<br/>Thông tin phê duyệt<br/>Bảng công nhân viên<br/>Tổng hợp thời gian làm việc<br/>Dữ liệu báo cáo<br/>Nhật ký hoạt động"| HR

    MANAGER -->|"Dữ liệu chấm công cá nhân<br/>Quyết định phê duyệt<br/>Quyết định điều chỉnh chấm công<br/>Xác nhận bảng công phòng ban<br/>Yêu cầu ca làm việc"| TIMELOCK
    TIMELOCK -->|"Lịch làm việc cá nhân<br/>Dữ liệu chấm công cá nhân<br/>Dữ liệu chấm công phòng ban<br/>Danh sách nhân viên phòng ban<br/>Yêu cầu cần phê duyệt<br/>Yêu cầu điều chỉnh chấm công<br/>Bảng công phòng ban<br/>Trạng thái yêu cầu"| MANAGER

    ADMIN ~~~ EMPLOYEE
    HR ~~~ MANAGER

    classDef actorNode fill:#eeebfc,stroke:#a39beb,stroke-width:1.5px,color:#111827;
    classDef systemNode fill:#eeebfc,stroke:#a39beb,stroke-width:1.5px,color:#111827;

    class ADMIN,HR,MANAGER,EMPLOYEE actorNode;
    class TIMELOCK systemNode;

    style LEFT fill:transparent,stroke:transparent
    style CENTER fill:transparent,stroke:transparent
    style RIGHT fill:transparent,stroke:transparent
```
