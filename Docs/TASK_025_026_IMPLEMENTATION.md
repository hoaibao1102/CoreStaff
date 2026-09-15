# TASK-025 / TASK-026 — Nhật ký triển khai UI

Ngày: 2026-09-15. Phạm vi được người dùng điều chỉnh: **chưa tích hợp API; chờ cập nhật docs API**.
Hoàn thành phần trình bày UI và điều hướng trong phạm vi này; chưa nghiệm thu dữ liệu nghiệp vụ end-to-end.
Không cập nhật TASK-001…118 hoặc milestone đóng băng (D30).

## Tài liệu và mã nguồn đối chiếu

- CoreStaff/README.md, CORESTAFF_REPO_STRUCTURE.md: React/Vite, NestJS, cấu trúc và kiểm tra.
- SRS_CORESTAFF.md: §5 RBAC, FR-EMP-11, §14 routes, §15.2A EmployeeProfile, §30A.2 và AC-HRM-01; §3 pagination.
- TASK_BACKLOG_9_WEEKS.md TASK-020…027; MILESTONE_9_WEEKS.md Sprint 2/3.
- CORESTAFF_PROJECT_PROPOSAL.md, Use case diagram.md, CoreStaff_Context_Diagram.md: actor/phạm vi hồ sơ.
- QC_REVIEW_CORESTAFF_DOCS.md, DOCS_DECISION_LOG.md, PLANNING_FREEZE_RULE.md: SRS v4.0 có ưu tiên và D30.
- App.tsx, auth service, AppHeader, WorkspaceModules, components, CSS và cấu hình web.
- EmployeeController/EmployeeService, EmployeeProfile schema và cấu hình Jest hiện có trong API.

## Yêu cầu và quyết định

TASK-025: danh bạ chỉ cho HR thuộc organization; mã, tên, email, phòng ban, chức danh, trạng thái. Lọc phòng ban/trạng thái theo backend hiện có; tra cứu tên/mã và phân trang 10 dòng, không giới hạn tổng nhân viên. Không mở rộng sang CRUD hợp đồng/lương hay xóa nhân viên.

TASK-026: thông tin tài khoản từ AuthUser hiện tại; workplace, shift, department manager và phân công được trình bày chỉ đọc. Sửa avatar/phone là tùy chọn theo FR-EMP-11 và không triển khai trong đợt này. Hồ sơ đầu vào khác user/tenant bị từ chối.

Không có dữ liệu nhân viên giả trong runtime. EmployeeView là mô hình trình bày, **không phải contract API**. Screen nhận DataState qua props; mặc định unavailable. UI danh bạ vô hiệu hóa bộ lọc khi chưa có dữ liệu; hồ sơ vẫn hiển thị thông tin tài khoản thật từ phiên đăng nhập.

## Files

Tạo mới dưới CoreStaff/Apps/web:

- src/screens/EmployeeDirectory/EmployeeDirectoryScreen.tsx
- src/screens/EmployeeProfile/EmployeeProfileScreen.tsx
- src/components/EmployeeDataState.tsx
- src/components/AppLink.tsx (điều hướng nội bộ, giữ phiên đăng nhập)
- src/lib/employee.ts
- tests/employee.test.tsx
- tests/employee-navigation.test.tsx (DOM + luồng auth thực, mock tại biên network)
- jest.config.cjs (dùng Jest/ts-jest sẵn có trong monorepo)
- vercel.json (rewrite hai đường dẫn để tải trực tiếp trên hosting)

Sửa: src/App.tsx, src/components/AppHeader.tsx, src/components/WorkspaceModules.tsx, package.json, CoreStaff/package-lock.json (thêm jest-environment-jsdom 29.7 cho test DOM); CoreStaff/package.json nối web tests vào lệnh kiểm tra chung. Thêm nhật ký này. Giữ các thay đổi có sẵn trong working tree.

## Routes và xác thực

- /hr/employees: chỉ HR có organizationId.
- /app/profile: Employee, Department Manager, HR có organizationId.
- Dùng cùng luồng khởi tạo phiên, login và bắt buộc đổi mật khẩu trong App trước khi hiển thị màn hình.
- Liên kết header hoạt động cả trên kích thước nhỏ; có đường quay về tổng quan. Điều hướng dùng AppLink và History API, nghe popstate để Back/Forward hoạt động; không tải lại app hoặc gọi lại auth khi chuyển giữa hai màn hình. Ctrl/Cmd-click và mở tab mới giữ hành vi liên kết HTML. Workspace có mục Hồ sơ của tôi và Danh bạ nhân viên, dùng cùng điều kiện role/tenant với screen guard.
- Kiểm tra phía UI không thay thế tenant/RBAC phía backend.

## Acceptance criterion → Implementation → Test

Tên dưới đây là tiêu chí triển khai suy ra từ SRS; backlog không cung cấp bộ AC riêng cho hai task.

| Tiêu chí | Triển khai | Kiểm thử trong employee.test.tsx | Trạng thái |
|---|---|---|---|
| HR được xem, các role khác bị chặn | canViewEmployees + screen guard | denies role; requires tenant | Đạt UI |
| Danh sách đúng trường, null an toàn | Bảng danh bạ | displays HR rows with nullable fields | Đạt UI |
| Tra cứu, lọc kết hợp, phân trang, không lẫn tenant | directoryPage | search, combined filters, tenant isolation, pagination and shrinking results | Đạt logic UI |
| Phân biệt chưa kết nối, chưa có dữ liệu, loading/error/forbidden | EmployeeDataState và empty state | empty and unavailable; both screens render state | Đạt UI |
| Hồ sơ dùng đúng tài khoản hiện tại | AuthUser và isOwnProfile | uses authenticated role; rejects foreign profile | Đạt UI |
| Không cho tự sửa role/code/workplace/shift | Chỉ đọc | uses authenticated role (không có input) | Đạt UI |
| Thiếu hồ sơ/assignment không gây lỗi | Placeholder | handles absent profile, missing identity and null assignments | Đạt UI |
| FR-EMP-11 workplace/shift/manager thật | Vùng phân công sẵn sàng nhận props | Own assignment render bằng fixture test | Chờ API |
| AC-HRM-01 hồ sơ/hợp đồng/lịch sử riêng User | Giữ mô hình User và EmployeeView riêng | Không nghiệm thu toàn bộ HRM bằng UI danh bạ | Hợp đồng/lịch sử ngoài hai màn hình này |

## API và phụ thuộc còn lại

Không thêm endpoint/service hoặc lời gọi mạng mới; giữ nguyên auth hiện có.
SRS ghi GET/PATCH /api/profile, backend hiện có GET /api/hr/employees/me. Backend danh sách trả profile chưa có tên User hoặc tên department/position/assignment được resolve và chưa phân trang server. Chờ docs API để quyết định mapping, nguồn assignment và pagination. Không tự chọn endpoint hoặc dùng ID làm tên hiển thị.

Test dùng fixture trong tests riêng; không kết nối DB hoặc API thật. Jest SSR kiểm tra nội dung và quyền; jsdom kiểm tra thao tác input/select/phân trang, App + auth service + login form, khôi phục phiên, URL trực tiếp, Back, logout và bắt buộc đổi mật khẩu. Chỉ mock network và cấu hình địa chỉ API. Chưa chạy browser E2E hoặc đánh giá responsive trực quan. Lỗi API nhân sự vẫn là presentation state, chưa ánh xạ HTTP 401/403.

## Kiểm chứng

- npm run lint (CoreStaff): PASS; script dự án dùng TypeScript noEmit cho API + web, không có ESLint riêng.
- npm run build (CoreStaff): PASS NestJS + TypeScript + Vite.
- npm run test --workspace @corestaff/web (CoreStaff): PASS, 2 suites / 25 tests.
- npm run lint --workspace @corestaff/web và npm run build --workspace @corestaff/web: PASS sau khi hoàn thiện điều hướng theo role.
- npm test (CoreStaff, trước khi nối thêm web test): PASS, 9 suites / 79 API tests. Web test chạy riêng PASS như trên; script chung hiện chạy cả hai.


## Kiểm tra bổ sung theo yêu cầu “login đã có phân role”

Đã xác nhận AuthUser.role đến từ POST /api/auth/login và GET /api/auth/me; UI dùng trực tiếp role đó. Không thêm chọn role hoặc session riêng.

| Tiêu chí bổ sung | Triển khai | Test trong employee-navigation.test.tsx |
|---|---|---|
| HR login mở danh bạ và hồ sơ từ workspace | AppLink + WorkspaceModules + App | HR login opens directory and own profile without reloading authentication |
| Employee/Manager chỉ vào hồ sơ, URL HR bị chặn | canViewEmployees/canViewProfile dùng chung | role login has profile but cannot open HR directory |
| Guest phải login; mustChangePassword không bị bỏ qua | Thứ tự guards App giữ nguyên | guest and mandatory password change guard |
| System Admin không vào hai màn hình nhân sự | Role/tenant guard | restored System Admin session is forbidden |
| Refresh URL hồ sơ và logout hoạt động | me + App state | restores own profile on direct URL and removes it on logout |
| Input/select/nút phân trang thực sự cập nhật bảng | Screen state + directoryPage | directory controls filter rendered rows, reset pagination and clear filters |

Danh bạ hiển thị cấu trúc cột ngay cả khi chưa có nguồn dữ liệu, không hiển thị số lượng bằng 0 như thể đã tải thành công. Tìm kiếm/lọc chỉ bật khi dữ liệu sẵn sàng. Phạm vi API vẫn chờ docs của người dùng.
## Ghi chú bổ sung 2026-09-15: login 401 trên remote

Đã kiểm tra trực tiếp `https://18-141-68-40.sslip.io/api/healthz`: API sống và MongoDB configured. POST `/api/auth/login` với credential seed demo `hr-a@tvs.local / TvsAdmin1!` trả 401 trên remote, nên đây là trạng thái xác thực thật của dữ liệu remote, không phải lỗi route TASK-025/026.

Đã sửa web auth để:

- trim `identifier` trước khi gửi login;
- parse an toàn khi API trả lỗi rỗng hoặc không phải JSON;
- map mọi 401 login về thông báo rõ nghĩa `Tài khoản hoặc mật khẩu không đúng.` thay vì `HTTP 401`;
- bỏ placeholder credential seed khỏi màn hình đăng nhập;
- sửa chữ Việt bị lỗi encoding trong `auth.ts` và `LoginScreen.tsx`;
- thêm `tests/auth.test.tsx` để khóa hành vi login trim và 401 rỗng body.

Kiểm chứng sau sửa:

- `npm run test --workspace @corestaff/web`: PASS, 3 suites / 27 tests.
- `npm run lint --workspace @corestaff/web`: PASS.
- `npm run build --workspace @corestaff/web`: PASS.

## Ghi chú bổ sung 2026-09-15: đồng bộ header auth

Đã chuyển `ChangePasswordScreen` sang dùng chung `AuthLayout` với `LoginScreen`, `ForgotPasswordScreen` và `ResetPasswordScreen`. Header riêng của màn đổi mật khẩu đã bị loại bỏ; nút `Đăng xuất` được giữ trong form để user vẫn có lối thoát khi đang bị bắt buộc đổi mật khẩu.

Khi POST `/api/auth/change-password` trả 401, app hiện đưa user về màn login và báo phiên đăng nhập đã hết hạn, thay vì giữ user ở màn đổi mật khẩu với session không còn hợp lệ.

Kiểm chứng sau sửa:

- `npm run test --workspace @corestaff/web`: PASS, 3 suites / 28 tests.
- `npm run lint --workspace @corestaff/web`: PASS.
- `npm run build --workspace @corestaff/web`: PASS.

## Ghi chú bổ sung 2026-09-15: sửa session cookie cross-site

Lỗi `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` sau login/đổi mật khẩu đến từ cookie `sid` không được browser gửi lại cho API khi web và API chạy khác domain. Backend trước đó set cookie `SameSite=Lax`, phù hợp localhost nhưng bị chặn với `fetch` cross-site.

Đã sửa `AuthController` để production set session cookie là `SameSite=None; Secure; HttpOnly; Path=/`, còn development giữ `SameSite=Lax; Secure=false`. Logout cũng dùng cùng cookie options để clear đúng cookie đã set.

Kiểm chứng sau sửa:

- `npm run test --workspace @corestaff/api`: PASS, 10 suites / 81 tests.
- `npm run test --workspace @corestaff/web`: PASS, 3 suites / 28 tests.
- `npm run lint --workspace @corestaff/api`: PASS.
- `npm run lint --workspace @corestaff/web`: PASS.
- `npm run build --workspace @corestaff/api`: PASS.
- `npm run build --workspace @corestaff/web`: PASS.

## Ghi chú bổ sung 2026-09-15: bỏ 401 `/auth/me` khi guest mở app

Trước đó web luôn gọi GET `/api/auth/me` khi boot để thử khôi phục phiên. Với guest chưa đăng nhập, API trả 401 là đúng về bảo mật nhưng tạo log lỗi đỏ trong DevTools.

Đã thêm marker `corestaff:has-session` trong `localStorage`: app chỉ gọi `/auth/me` khi từng login thành công hoặc có marker khôi phục phiên. Logout, session hết hạn khi đổi mật khẩu, hoặc `/auth/me` fail sẽ xóa marker. Nhờ vậy lần mở app khi chưa đăng nhập không còn bắn request 401 không cần thiết, còn refresh sau login vẫn restore session.

Kiểm chứng sau sửa:

- `npm run test --workspace @corestaff/web`: PASS, 3 suites / 29 tests.
- `npm run lint --workspace @corestaff/web`: PASS.
- `npm run build --workspace @corestaff/web`: PASS.

## Fix 2026-09-15: same-origin session proxy for local web

Local web previously fetched VITE_API_URL directly, bypassing Vite's proxy. Browser cookie restrictions could therefore reject the session even with credentials: include. Changing the local API source does not update the deployed API's cookie settings.

Development now uses the web origin for all auth calls. Vite forwards /api to VITE_API_URL and /local-api/api to VITE_API_FALLBACK_URL. The HTTP development proxy retains HttpOnly, removes the upstream cookie domain and Secure flag, sets SameSite=Lax, and scopes cookies separately for remote/local routes. Login and logout receive matching cookie paths. API authentication remains required.

Restart npm run dev:web and log in again after this change; cookies previously stored against the remote API cannot migrate to the web origin. Production builds continue using VITE_API_URL directly and require a deployed cookie/proxy configuration suitable for the production web origin. This change does not deploy the API.

Validation: web build passed; 29 existing tests and one real Vite proxy integration test passed. The proxy test uses a simulated upstream and checks cookie attributes, forwarding through me/change-password, missing-cookie rejection, and logout for both routes. A real account login against the deployed API has not been verified.
