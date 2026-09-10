# TimeLock - Use Case Diagrams

Tài liệu mô tả các Use Case chính của hệ thống **TimeLock** theo từng vai trò người dùng.

---

# 1. System Admin

```mermaid
flowchart LR

    ADMIN["👤 System Admin"]

    subgraph TIMELOCK["TIMELOCK SYSTEM"]
        direction TB

        subgraph ACCOUNT["Tài khoản"]
            LOGIN(["Đăng nhập"])
        end

        subgraph ORGANIZATION["Quản lý tổ chức"]
            MANAGE_ORG(["Quản lý tổ chức"])
            CREATE_ORG(["Tạo tổ chức"])
            VIEW_ORG(["Xem thông tin tổ chức"])
            UPDATE_ORG(["Cập nhật thông tin tổ chức"])
            CHANGE_STATUS(["Khóa / mở tổ chức"])
        end

        subgraph HR_ACCOUNT["Khởi tạo tài khoản"]
            CREATE_HR(["Tạo tài khoản HR ban đầu"])
        end

        subgraph PLATFORM["Quản trị nền tảng"]
            VIEW_AUDIT(["Xem nhật ký hệ thống"])
            VIEW_STATUS(["Theo dõi trạng thái hệ thống"])
        end
    end

    ADMIN --- LOGIN
    ADMIN --- MANAGE_ORG
    ADMIN --- CREATE_HR
    ADMIN --- VIEW_AUDIT
    ADMIN --- VIEW_STATUS

    MANAGE_ORG -.->|"«include»"| CREATE_ORG
    MANAGE_ORG -.->|"«include»"| VIEW_ORG
    MANAGE_ORG -.->|"«include»"| UPDATE_ORG

    CHANGE_STATUS -.->|"«extend»"| MANAGE_ORG

    classDef actor fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#1f2937;
    classDef usecase fill:#ffffff,stroke:#8b5cf6,stroke-width:1.5px,color:#1f2937;

    class ADMIN actor;
    class LOGIN,MANAGE_ORG,CREATE_ORG,VIEW_ORG,UPDATE_ORG,CHANGE_STATUS,CREATE_HR,VIEW_AUDIT,VIEW_STATUS usecase;
```

---

# 2. Nhân sự (HR)

```mermaid
flowchart LR

    HR["👤 NHÂN SỰ (HR)"]

    subgraph TIMELOCK["TIMELOCK SYSTEM"]
        direction TB

        subgraph ACCOUNT["Tài khoản & hồ sơ"]
            LOGIN(["Đăng nhập"])
            PROFILE(["Xem / cập nhật hồ sơ"])
            PASSWORD(["Đổi mật khẩu"])
        end

        subgraph ORGANIZATION["Nhân sự & cơ cấu tổ chức"]
            DEPARTMENT(["Quản lý phòng ban"])
            EMPLOYEE(["Quản lý nhân viên"])
            MANAGER(["Quản lý quản lý phòng ban"])
            WORKPLACE(["Quản lý địa điểm làm việc"])
            NETWORK(["Cấu hình Network / CIDR"])
        end

        subgraph WORK["Ca & lịch làm việc"]
            SHIFT(["Quản lý ca làm việc"])
            CALENDAR(["Quản lý lịch làm việc / ngày lễ"])
            SCHEDULE(["Quản lý lịch làm việc nhân viên"])
            LEAVE(["Ghi nhận nghỉ phép / nghỉ không lương"])
        end

        subgraph ATTENDANCE["Quản lý chấm công"]
            VIEW_ATT(["Xem dữ liệu chấm công"])
            ADJUST(["Xử lý điều chỉnh chấm công"])
            OT(["Rà soát làm thêm giờ"])
        end

        subgraph TIMESHEET["Bảng công & báo cáo"]
            PERIOD(["Quản lý kỳ công"])
            CLOSE(["Chốt kỳ công"])
            REOPEN(["Mở lại kỳ công"])
            EXPORT(["Xuất bảng công"])
            AUDIT(["Xem nhật ký hoạt động"])
        end
    end

    HR --- LOGIN
    HR --- PROFILE
    HR --- PASSWORD

    HR --- DEPARTMENT
    HR --- EMPLOYEE
    HR --- MANAGER
    HR --- WORKPLACE
    HR --- NETWORK

    HR --- SHIFT
    HR --- CALENDAR
    HR --- SCHEDULE
    HR --- LEAVE

    HR --- VIEW_ATT
    HR --- ADJUST
    HR --- OT

    HR --- PERIOD
    HR --- AUDIT

    PERIOD -.->|"«include»"| CLOSE
    REOPEN -.->|"«extend»"| PERIOD
    CLOSE -.->|"«include»"| EXPORT

    classDef actor fill:#dcfce7,stroke:#059669,stroke-width:2px,color:#064e3b;
    classDef usecase fill:#ffffff,stroke:#10b981,stroke-width:1.5px,color:#064e3b;

    class HR actor;
    class LOGIN,PROFILE,PASSWORD,DEPARTMENT,EMPLOYEE,MANAGER,WORKPLACE,NETWORK,SHIFT,CALENDAR,SCHEDULE,LEAVE,VIEW_ATT,ADJUST,OT,PERIOD,CLOSE,REOPEN,EXPORT,AUDIT usecase;
```

---

# 3. Department Manager

```mermaid
flowchart LR

    MANAGER["👤 DEPARTMENT MANAGER"]

    subgraph TIMELOCK["TIMELOCK SYSTEM"]
        direction TB

        subgraph ACCOUNT["Tài khoản & hồ sơ"]
            LOGIN(["Đăng nhập"])
            PROFILE(["Xem / cập nhật hồ sơ"])
            PASSWORD(["Đổi mật khẩu"])
        end

        subgraph PERSONAL["Chức năng cá nhân"]
            ATTENDANCE(["Chấm công"])
            CHECKIN(["Check-in"])
            CHECKOUT(["Check-out"])

            HISTORY(["Xem lịch sử chấm công"])
            TIMESHEET(["Xem bảng công cá nhân"])
            ADJUST_REQUEST(["Yêu cầu điều chỉnh công"])

            VIEW_SCHEDULE(["Xem lịch / ca làm việc"])
            REGISTER_SHIFT(["Đăng ký ca Part-time"])
            SWAP(["Yêu cầu đổi ca"])
            ACCEPT_SWAP(["Đồng ý / từ chối đổi ca"])
            OT_REQUEST(["Gửi yêu cầu làm thêm giờ"])
        end

        subgraph DEPARTMENT["Quản lý phòng ban"]
            DEPT_EMPLOYEE(["Xem danh sách nhân viên phòng ban"])
            DEPT_ATTENDANCE(["Xem chấm công phòng ban"])
            DEPT_TIMESHEET(["Rà soát bảng công phòng ban"])
            CONFIRM(["Xác nhận bảng công phòng ban"])
        end

        subgraph APPROVAL["Phê duyệt yêu cầu"]
            MANAGE_APPROVAL(["Quản lý yêu cầu phê duyệt"])

            SELFIE_APPROVE(["Duyệt chấm công Selfie"])
            ADJUST_APPROVE(["Duyệt yêu cầu điều chỉnh"])
            SHIFT_APPROVE(["Duyệt đăng ký ca"])
            SWAP_APPROVE(["Duyệt đổi ca"])
            OT_APPROVE(["Duyệt yêu cầu OT"])
        end
    end

    MANAGER --- LOGIN
    MANAGER --- PROFILE
    MANAGER --- PASSWORD

    MANAGER --- ATTENDANCE
    MANAGER --- HISTORY
    MANAGER --- TIMESHEET
    MANAGER --- ADJUST_REQUEST

    MANAGER --- VIEW_SCHEDULE
    MANAGER --- REGISTER_SHIFT
    MANAGER --- SWAP
    MANAGER --- ACCEPT_SWAP
    MANAGER --- OT_REQUEST

    MANAGER --- DEPT_EMPLOYEE
    MANAGER --- DEPT_ATTENDANCE
    MANAGER --- DEPT_TIMESHEET
    MANAGER --- CONFIRM

    MANAGER --- MANAGE_APPROVAL

    ATTENDANCE -.->|"«include»"| CHECKIN
    ATTENDANCE -.->|"«include»"| CHECKOUT

    MANAGE_APPROVAL -.->|"«include»"| SELFIE_APPROVE
    MANAGE_APPROVAL -.->|"«include»"| ADJUST_APPROVE
    MANAGE_APPROVAL -.->|"«include»"| SHIFT_APPROVE
    MANAGE_APPROVAL -.->|"«include»"| SWAP_APPROVE
    MANAGE_APPROVAL -.->|"«include»"| OT_APPROVE

    DEPT_TIMESHEET -.->|"«include»"| DEPT_ATTENDANCE
    CONFIRM -.->|"«include»"| DEPT_TIMESHEET

    classDef actor fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef usecase fill:#ffffff,stroke:#f59e0b,stroke-width:1.5px,color:#78350f;

    class MANAGER actor;
    class LOGIN,PROFILE,PASSWORD,ATTENDANCE,CHECKIN,CHECKOUT,HISTORY,TIMESHEET,ADJUST_REQUEST,VIEW_SCHEDULE,REGISTER_SHIFT,SWAP,ACCEPT_SWAP,OT_REQUEST,DEPT_EMPLOYEE,DEPT_ATTENDANCE,DEPT_TIMESHEET,CONFIRM,MANAGE_APPROVAL,SELFIE_APPROVE,ADJUST_APPROVE,SHIFT_APPROVE,SWAP_APPROVE,OT_APPROVE usecase;
```

---

# 4. Employee

```mermaid
flowchart LR

    EMPLOYEE["👤 EMPLOYEE"]

    subgraph TIMELOCK["TIMELOCK SYSTEM"]
        direction TB

        subgraph ACCOUNT["Tài khoản & hồ sơ"]
            LOGIN(["Đăng nhập"])
            PROFILE(["Xem / cập nhật hồ sơ"])
            PASSWORD(["Đổi mật khẩu"])
        end

        subgraph ATTENDANCE["Chấm công"]
            ATTEND(["Chấm công"])

            CHECKIN(["Check-in"])
            CHECKOUT(["Check-out"])

            OFFICE(["Chấm công tại văn phòng"])
            REMOTE(["Chấm công ngoài văn phòng"])

            NETWORK(["Xác minh Network"])
            GPS(["Xác minh GPS"])
            SELFIE(["Gửi Selfie + GPS"])
        end

        subgraph RECORD["Thông tin chấm công"]
            HISTORY(["Xem lịch sử chấm công"])
            DETAIL(["Xem chi tiết ngày công"])
            TIMESHEET(["Xem bảng công cá nhân"])

            ADJUST(["Yêu cầu điều chỉnh công"])
            EXPLANATION(["Gửi giải trình"])
        end

        subgraph WORK["Ca làm việc & làm thêm giờ"]
            SCHEDULE(["Xem lịch / ca làm việc"])

            REGISTER_SHIFT(["Đăng ký ca Part-time"])

            SWAP(["Yêu cầu đổi ca"])
            ACCEPT_SWAP(["Đồng ý / từ chối đổi ca"])

            OT_REQUEST(["Gửi yêu cầu làm thêm giờ"])
            OT_RESULT(["Xem kết quả OT"])
        end
    end

    EMPLOYEE --- LOGIN
    EMPLOYEE --- PROFILE
    EMPLOYEE --- PASSWORD

    EMPLOYEE --- ATTEND

    EMPLOYEE --- HISTORY
    EMPLOYEE --- DETAIL
    EMPLOYEE --- TIMESHEET
    EMPLOYEE --- ADJUST
    EMPLOYEE --- EXPLANATION

    EMPLOYEE --- SCHEDULE
    EMPLOYEE --- REGISTER_SHIFT
    EMPLOYEE --- SWAP
    EMPLOYEE --- ACCEPT_SWAP
    EMPLOYEE --- OT_REQUEST
    EMPLOYEE --- OT_RESULT

    ATTEND -.->|"«include»"| CHECKIN
    ATTEND -.->|"«include»"| CHECKOUT

    OFFICE -.->|"«extend»"| CHECKIN
    REMOTE -.->|"«extend»"| CHECKIN

    OFFICE -.->|"«include»"| NETWORK
    OFFICE -.->|"«include»"| GPS

    REMOTE -.->|"«include»"| SELFIE
    SELFIE -.->|"«include»"| GPS

    classDef actor fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#172554;
    classDef usecase fill:#ffffff,stroke:#3b82f6,stroke-width:1.5px,color:#172554;

    class EMPLOYEE actor;
    class LOGIN,PROFILE,PASSWORD,ATTEND,CHECKIN,CHECKOUT,OFFICE,REMOTE,NETWORK,GPS,SELFIE,HISTORY,DETAIL,TIMESHEET,ADJUST,EXPLANATION,SCHEDULE,REGISTER_SHIFT,SWAP,ACCEPT_SWAP,OT_REQUEST,OT_RESULT usecase;
```

---

## Quan hệ sử dụng

- `---` : Actor thực hiện Use Case.
- `«include»` : Use Case luôn cần sử dụng Use Case khác.
- `«extend»` : Use Case mở rộng/xảy ra trong điều kiện nhất định.
