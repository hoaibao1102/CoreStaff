# 📊 Hướng Dẫn Tạo Dữ Liệu Test Payroll Pipeline

## 🎯 Mục Tiêu
Chạy thử toàn bộ pipeline: **Chấm công → Đóng kỳ → Tính lương → Tạo payslip**

---

## 🚀 Bước 1: Chạy Seed Script

```bash
# Từ thư mục Apps/api
cd Apps/api

# Chạy seed payroll data
npm run seed:payroll
```

**Script sẽ tự động tạo:**
- ✅ TimesheetPeriod cho tháng 09/2026
- ✅ Attendance records (~22 ngày làm việc × số nhân viên)
- ✅ TimesheetSummaries (tổng hợp chấm công)
- ✅ TaxPolicy (biểu thuế TNCN 7 bậc)
- ✅ InsurancePolicy (BHXH 8%, BHYT 1.5%, BHTN 1%)
- ✅ PayrollInputSnapshots (snapshot đầu vào tính lương)
- ✅ PayrollRun (trạng thái DRAFT)

**Kết quả mong đợi:**
```
🌱 Starting Payroll Seed...
✅ Connected to MongoDB
📋 Step 1: Getting TVS Corporation...
   Organization ID: <org_id>
   Found 6 employees
📅 Step 2: Creating Timesheet Period 2026-09...
   ✅ Created period 2026-09
⏰ Step 3: Creating attendance records...
   ✅ Created 132 attendance records
📊 Step 4: Creating timesheet summaries...
   ✅ Created 6 timesheet summaries
🔒 Step 5: Closing period 2026-09...
   ✅ Period 2026-09 is now CLOSED
💰 Step 6: Creating tax policy...
   ✅ Tax policy created with 5 brackets
🛡️  Step 7: Creating insurance policy...
   ✅ Insurance policy created
📦 Step 8: Creating payroll input snapshots...
   ✅ Created 6 payroll input snapshots
💼 Step 9: Creating payroll run...
   ✅ Created DRAFT payroll run (expected 6 employees)
🎉 Payroll Seed Complete!
```

---

## 🔧 Bước 2: Tính Lương (Calculate)

Sau khi có DRAFT payroll run, gọi API để CALCULATE:

### curl
```bash
# Lấy danh sách payroll runs để tìm ID
curl http://localhost:3000/api/payroll-runs

# Giả sử payrollRunId là "abc123..."
curl -X PUT http://localhost:3000/api/payroll-runs/abc123/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Hoặc từ FE Screen
1. Mở trang HR → Payroll Runs
2. Click **"Tạo Bảng Lương"** (nếu chưa có)
3. Click **"Tính Lương"** (Calculate) trên bản ghi DRAFT

**API sẽ:**
- Đọc PayrollInputSnapshots
- Tính prorated base salary theo ngày công
- Tính BHXH/BHYT/BHTN
- Tính thuế TNCN progressive
- Tạo Payslips cho tất cả nhân viên

---

## 🔒 Bước 3: Khóa Payroll Run (Lock)

```bash
curl -X PUT http://localhost:3000/api/payroll-runs/<payrollRunId>/lock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>"
```

Hoặc click **"Khóa"** trên FE screen.

---

## 📤 Bước 4: Phát Hành Payslips (Release)

```bash
curl -X POST http://localhost:3000/api/payslips/release/<payrollRunId> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>"
```

Hoặc click **"Phát Hành"** trên FE screen.

---

## 👁️ Bước 5: Xem Kết Quả

### HR View — Xem tất cả payslips
```bash
curl http://localhost:3000/api/payslips/run/<payrollRunId> \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Employee View — Xem payslip của riêng mình
```bash
curl http://localhost:3000/api/payslips/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Export CSV
```bash
curl http://localhost:3000/api/payroll-runs/<payrollRunId>/export/csv \
  -H "Authorization: Bearer <your-jwt-token>" \
  --output payslips.csv
```

---

## 📊 Dữ Mẫu Được Tạo

### Nhân viên TVS Corporation

| Mã NV | Lương Cơ Bản | Ngày Công | Phụ Cấp | OT (phút) | Người Phụ Thuộc |
|-------|-------------|-----------|---------|-----------|----------------|
| TVS-0001 | 30,000,000 | 22 | 700,000 | 0 | Có (1 con) |
| TVS-0002 | 25,000,000 | 22 | 650,000 | 120 | Không |
| TVS-0003 | 20,000,000 | 22 | 500,000 | 60 | Không |
| TVS-0004 | 22,000,000 | 22 | 500,000 | 0 | Không |
| TVS-0005 | 28,000,000 | 20 | 500,000 | 0 | Không |
| TVS-0006 | 18,000,000 | 15 | 500,000 | 0 | Không |

### Công Thức Tính

```
Gross = ProratedBaseSalary + Allowances + OTPay

ProratedBaseSalary = (BaseSalary / StandardDays) × AttendanceDays

Insurance = BaseSalary × 10.5% (capped at 52,200,000)
  - BHXH: 8%
  - BHYT: 1.5%
  - BHTN: 1%

TaxableEarnings = Gross - Insurance

PIT = Progressive Tax (theo biểu thuế 7 bậc)
  - Thang 1: 0-5M → 5%
  - Thang 2: 5-10M → 10%
  - Thang 3: 10-18M → 15%
  - Thang 4: 18-32M → 20%
  - Thang 5: 32-62M → 25%
  - Thang 6: 62-120M → 30%
  - Thang 7: >120M → 35%

NetSalary = Gross - Insurance - PIT
```

---

## 🧪 Kiểm Tra Kết Quả

### Trong MongoDB
```javascript
// Xem payroll runs
db.payroll_runs.find({ organizationId: ObjectId("<org_id>") })

// Xem payslips
db.payslips.find({ payrollRunId: ObjectId("<payroll_run_id>") })

// Xem snapshot
db.payroll_input_snapshots.find({ periodLabel: "2026-09" })
```

### Từ API
```bash
# Summary của payroll run
curl http://localhost:3000/api/payslips/run/<payrollRunId>/summary \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## ⚠️ Lưu Ý

1. **Chạy seed.ts trước**: `npm run seed` (tạo Organization + Users + Employees)
2. **Kiểm tra .env**: Đảm bảo `MONGODB_URI` được cấu hình đúng
3. **Token JWT**: Cần login trước để lấy token cho các API calls
4. **Lặp lại**: Script idempotent — chạy lại sẽ bỏ qua dữ liệu đã tồn tại

---

## 🐛 Troubleshooting

### Lỗi: "Organization not found"
→ Chạy `npm run seed` trước để tạo Organization và Employees

### Lỗi: "No MONGODB_URI"
→ Kiểm tra `.env` file trong `Apps/api/.env`

### Lỗi: "PayrollRun not found"
→ Kiểm tra xem period có status CLOSED chưa
→ Hoặc call API `POST /api/payroll-runs` để tạo manual

### Không thấy payslips sau khi calculate
→ Kiểm tra logs xem có lỗi tính toán không
→ Verify rằng PayrollInputSnapshots đã được tạo đủ
