import { renderToStaticMarkup } from 'react-dom/server';
import { DepartmentAcknowledgementPanel } from '../src/screens/timesheet/TimesheetReviewScreen';

const progress = {
  eligibleEmployees: 3,
  acknowledgedEmployees: 1,
  disputedEmployees: 1,
  pendingEmployees: 1,
  employees: [
    { userId: 'u1', employeeProfileId: 'p1', state: 'ACKNOWLEDGED', projectionHash: 'a'.repeat(64), fullName: 'Hoài Bảo', employeeCode: 'TVS-0112' },
    { userId: 'u2', employeeProfileId: 'p2', state: 'DISPUTED', projectionHash: 'b'.repeat(64), fullName: 'Nguyễn Văn An', employeeCode: 'TVS-0113', disputeReason: 'Ngày 15/10 thiếu check-in' },
    { userId: 'u3', employeeProfileId: 'p3', state: 'PENDING', projectionHash: '', fullName: 'Trần Thị Bích', employeeCode: 'TVS-0114' },
  ],
};

test('names every employee who has not confirmed the timesheet', () => {
  const html = renderToStaticMarkup(
    <DepartmentAcknowledgementPanel progress={progress} loading={false} onRefresh={() => {}} />,
  );

  expect(html).toContain('1/3');
  expect(html).toContain('1 báo sai lệch');
  expect(html).toContain('Nguyễn Văn An');
  expect(html).toContain('TVS-0113');
  expect(html).toContain('Ngày 15/10 thiếu check-in');
  expect(html).toContain('Trần Thị Bích');
  expect(html).toContain('Chưa xác nhận');
  // Người đã xác nhận không chiếm chỗ trong danh sách mặc định.
  expect(html).not.toContain('Hoài Bảo');
  expect(html).toContain('Xem tất cả (3)');
});

test('reports full coverage when every employee confirmed', () => {
  const html = renderToStaticMarkup(
    <DepartmentAcknowledgementPanel
      progress={{ ...progress, acknowledgedEmployees: 3, disputedEmployees: 0, pendingEmployees: 0, employees: progress.employees.map((e) => ({ ...e, state: 'ACKNOWLEDGED' })) }}
      loading={false}
      onRefresh={() => {}}
    />,
  );

  expect(html).toContain('3/3');
  expect(html).toContain('Tất cả nhân viên trong phòng ban đã xác nhận bảng công.');
});
