import { renderToStaticMarkup } from 'react-dom/server';
import { ManagerSnapshotPreview } from '../src/screens/timesheet/TimesheetReviewScreen';

test('renders each manager snapshot employee as a compact table row', () => {
  const html = renderToStaticMarkup(
    <ManagerSnapshotPreview
      departmentId="department-1"
      summaries={[
        {
          employeeProfileId: 'employee-1',
          departmentId: 'department-1',
          departmentName: 'Engineering',
          employeeCode: 'TVS-0112',
          fullName: 'Hoài Bảo',
          standardWorkingDays: 20,
          actualWorkingDays: 20,
          absentDays: 0,
          incompleteDays: 0,
          paidLeaveDays: 2,
          unpaidLeaveDays: 0,
          totalWorkingMinutes: 10_560,
          totalLateMinutes: 15,
          totalEarlyMinutes: 5,
          otWorkingDayMinutes: 60,
          otWeeklyOffMinutes: 0,
          otPublicHolidayMinutes: 0,
          totalOvertimeMinutes: 60,
        },
        {
          employeeProfileId: 'employee-2',
          departmentId: 'department-1',
          departmentName: 'Engineering',
          employeeCode: 'TVS-0113',
          fullName: 'Nguyễn Văn An',
          standardWorkingDays: 20,
          actualWorkingDays: 19,
          absentDays: 1,
          incompleteDays: 0,
          paidLeaveDays: 0,
          unpaidLeaveDays: 0,
          totalWorkingMinutes: 9_120,
          totalLateMinutes: 0,
          totalEarlyMinutes: 30,
          otWorkingDayMinutes: 0,
          otWeeklyOffMinutes: 120,
          otPublicHolidayMinutes: 0,
          totalOvertimeMinutes: 120,
        },
      ]}
    />,
  );

  expect(html).toContain('<table');
  expect(html.match(/<tbody/g)).toHaveLength(1);
  expect(html.match(/<tr/g)).toHaveLength(5); // two grouped header rows, two employees, one total row
  expect(html).toContain('Ngày công chuẩn');
  expect(html).toContain('Công thực tế');
  expect(html).toContain('Tổng giờ làm');
  expect(html).toContain('Đi trễ');
  expect(html).toContain('Về sớm');
  expect(html).toContain('OT ngày lễ');
  expect(html).toContain('176 giờ');
  expect(html).toContain('1 giờ');
  expect(html).toContain('Hoài Bảo');
  expect(html).toContain('Nguyễn Văn An');
  expect(html).toContain('2 nhân viên');
});
