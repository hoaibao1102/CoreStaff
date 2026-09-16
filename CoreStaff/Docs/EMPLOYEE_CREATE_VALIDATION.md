# Đối chiếu form tạo hồ sơ nhân sự

Luồng: `EmployeeCreateDialog` → `useFormEmployee` → `EmployeeCreatePayload` → `createEmployee` / `POST /api/hr/employees` → `CreateEmployeeProfileDto` → `EmployeeService.create` → `EmployeeProfileSchema`.

Lưu ý xác thực: bảng API mô tả Bearer token, nhưng implementation hiện tại của repository dùng cookie HttpOnly `sid` từ endpoint đăng nhập. Web client gửi `credentials: include`; backend `AuthGuard` chỉ đọc cookie này. Việc chuyển sang Bearer cần một thay đổi contract xác thực riêng, không thuộc flow tạo hồ sơ.

## Trường và nguồn dữ liệu

| Trường | Bắt buộc khi tạo? | Nguồn | Validation hiện tại | Payload |
|---|---|---|---|---|
| Tài khoản nhân viên | Có | Danh sách tài khoản đang hoạt động, chưa có hồ sơ trong tổ chức | Chọn tài khoản; backend kiểm tra ID, tổ chức và hồ sơ trùng | `userId` |
| Họ tên | Không nhập riêng | Tài khoản liên kết | Hiển thị tên tài khoản; không gửi bản sao họ tên | — |
| Mã nhân viên | Có | HR nhập | UI giữ rule có sẵn 3–32 ký tự; DTO yêu cầu không rỗng, tối đa 32; schema chuẩn hóa và unique theo tổ chức | `employeeCode` |
| Ngày vào làm | Có | HR nhập, có giá trị gợi ý | Ngày hợp lệ; UI giữ rule có sẵn không ở tương lai; DTO kiểm tra ISO date | `joinDate` |
| Loại lao động | Không | Chọn; mặc định toàn thời gian | Enum; bỏ chọn thì không gửi, backend dùng `FULL_TIME` | `employmentType` |
| Ngày sinh | Không | HR nhập | Ngày hợp lệ; UI không nhận ngày tương lai; DTO kiểm tra ISO date | `dateOfBirth` |
| Giới tính | Không | Chọn | Enum | `gender` |
| Số điện thoại | Không | Gợi ý từ tài khoản, HR có thể sửa | Nếu có: đúng 10 chữ số; input lọc ký tự và giới hạn 10 | `phone` |
| Email nhân sự | Không | Gợi ý từ tài khoản, HR có thể sửa | Nếu có: email hợp lệ, tối đa 256; trim trước khi gửi | `email` |
| Địa chỉ | Không | HR nhập | Tối đa 256 ký tự | `address` |
| CCCD/CMND | Không | HR nhập | 9–12 chữ số, tương thích ví dụ 10 chữ số trong API | `citizenId` |
| Mã số thuế | Không | HR nhập | 10–12 chữ số, giữ rule hiện có | `taxCode` |
| Số BHXH | Không | HR nhập | 1–12 chữ số nếu có, giữ rule hiện có | `socialInsuranceCode` |
| Tài khoản ngân hàng | Không | HR nhập | 6–17 chữ số nếu có, giữ rule hiện có | `bankAccount` |
| Phòng ban | Không | Danh mục phòng ban | Chọn; backend kiểm tra tham chiếu cùng tổ chức | `departmentId` |
| Chức danh | Không | Danh mục chức danh | Chọn; backend kiểm tra tham chiếu cùng tổ chức | `positionId` |
| Quản lý trực tiếp | Không | Danh sách nhân sự, độc lập bộ lọc trang | Hiển thị tên/mã nhân viên; backend kiểm tra tài khoản cùng tổ chức | `directManagerId` |
| Nơi làm việc | Không; ẩn trong form | Chưa có API danh mục trong phạm vi repo | DTO nhận ID nếu được gửi; schema ghi rõ danh mục chưa triển khai; không yêu cầu HR nhập ID | `workplaceId` không gửi từ form |
| Tổ chức | Backend cấp | Phiên đăng nhập | Tenant context | Không gửi từ form |
| Trạng thái | Backend cấp | Service | Luôn bắt đầu `PROBATION` | Không gửi từ form |
| ID hồ sơ, thời điểm tạo/cập nhật | Tự sinh | Database | Schema timestamps | Không gửi từ form |

Các trường optional trống được bỏ khỏi payload. Các giới hạn ngày/mã nhân viên phía UI có từ trước và chặt hơn DTO; không tự thay đổi business rule trong lần tiếp tục này. Quy tắc độ dài BHXH/thuế/ngân hàng là quy tắc của code hiện tại, không phải kết luận về quy định pháp luật.

## Phần có sẵn khi tiếp tục

- FormLabel/FormError dùng chung, chia section và hiển thị lỗi tại field.
- Toast dùng chung, vị trí góc phải trên desktop, phía trên mobile; thời gian 3/4/5 giây theo mức thông báo.
- Select tài khoản/quản lý, API eligible-users; loại bỏ ô nhập ObjectId và ẩn workplace chưa có danh mục.
- Required đã sửa về ba trường thực sự bắt buộc. Trước đó phone/email bị frontend bắt buộc nhưng thiếu dấu sao; backend xác nhận chúng optional nên bỏ yêu cầu bắt buộc. Loại lao động/phòng ban/chức danh trước đó có dấu sao dù API cho phép bỏ trống.

## Phần hoàn thiện trong lần tiếp tục

- Đồng bộ `required` HTML, viền lỗi select và `aria-describedby`; giữ lỗi khi sửa vẫn chưa hợp lệ.
- Gom validation blur/change/submit dùng chung; trim email, bỏ loại lao động trống khỏi payload.
- Giữ `error.details` từ API; dịch lỗi về các field, không hiển thị thông báo kỹ thuật.
- Phân biệt unique-key conflict do tài khoản đã có hồ sơ với mã nhân viên trùng, kể cả tạo đồng thời.
- Hiển thị lỗi tải tài khoản và nút thử lại; danh sách quản lý không bị bộ lọc danh sách nhân viên thu hẹp.
- Gợi ý liên hệ cập nhật khi đổi tài khoản nhưng giữ dữ liệu HR đã sửa; reset khi đóng modal.
- Giữ toast trong cây trợ năng khi dialog mở bằng live region tồn tại trước khi có thông báo.

Email/phone của EmployeeProfile hiện không có unique index. Có kiểm tra ánh xạ mã duplicate contact để phòng API trả về, nhưng không thêm quy tắc unique vào backend.

## Kiểm tra

- Unit/integration component: required/optional, định dạng, payload, API details, duplicate mapping, server error, khóa double submit, thử lại tải tài khoản, toast tự đóng và đóng thủ công.
- DTO: ba trường bắt buộc, bỏ trống optional, phone/email/CMND/CCCD/BHXH/ngân hàng.
- Playwright trên Edge: viewport 390 và 1366, không báo lỗi lúc mở, submit rỗng, không gọi API khi sai, focus/scroll, toast top-right/tự ẩn, không tràn ngang, reset và tạo thành công. API được mock; không ghi dữ liệu nhân sự thật.
- Chạy lint/typecheck và production build API/web. Build có cảnh báo bundle lớn và trộn static/dynamic import của hrService, không chặn build.
