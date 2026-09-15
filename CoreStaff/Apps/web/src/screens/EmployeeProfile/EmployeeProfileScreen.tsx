import type { AuthUser } from '../../services/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { canViewProfile, isOwnProfile, type DataState, type EmployeeView } from '../../lib/employee';

export function EmployeeProfileScreen({ user, state = { status: 'unavailable' } }: {
  user: AuthUser; state?: DataState<EmployeeView | null>;
}) {
  if (!canViewProfile(user)) return <EmployeeDataState status="forbidden" />;
  if (state.status === 'forbidden' || (state.status === 'ready' && state.data && !isOwnProfile(user, state.data))) {
    return <EmployeeDataState status="forbidden" />;
  }
  const profile = state.status === 'ready' ? state.data : null;
  const fields = [
    ['Họ tên', user.fullName], ['Email', user.email], ['Mã nhân viên', user.employeeCode],
    ['Vai trò', { HR: 'Nhân sự', EMPLOYEE: 'Nhân viên', DEPARTMENT_MANAGER: 'Quản lý phòng ban', SYSTEM_ADMIN: 'System Admin' }[user.role]],
  ];
  const assignment = [['Nơi làm việc', profile?.workplace], ['Ca làm việc', profile?.shift],
    ['Quản lý phòng ban', profile?.manager], ['Phòng ban', profile?.department], ['Chức danh', profile?.position]];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Hồ sơ của tôi</h1><p className="mt-2 text-sm text-muted-foreground">Thông tin tài khoản và phân công công việc của bạn.</p></div>
    <Card><CardHeader><CardTitle>Thông tin tài khoản</CardTitle></CardHeader><CardContent><Fields fields={fields} /></CardContent></Card>
    <Card><CardHeader><CardTitle>Phân công công việc</CardTitle></CardHeader><CardContent className="space-y-4">
      <EmployeeDataState status={state.status} />
      {state.status === 'ready' && !profile && <p role="status">Bạn chưa có hồ sơ nhân viên.</p>}
      <Fields fields={assignment} />
    </CardContent></Card>
  </div>;
}
function Fields({ fields }: { fields: (string | null | undefined)[][] }) {
  return <dl className="grid gap-6 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label}>
    <dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value?.trim() || 'Chưa có thông tin'}</dd>
  </div>)}</dl>;
}
