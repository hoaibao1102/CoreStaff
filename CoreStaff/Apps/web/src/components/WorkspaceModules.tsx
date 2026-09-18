import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { AuthUser } from '@/services/auth';
import { AppLink } from './AppLink';

type ModuleStatus = 'ready' | 'planned' | 'ui';

interface WorkspaceModule {
  id: string;
  title: string;
  description: string;
  route: string;
  status: ModuleStatus;
  icon: typeof Clock3;
  roles: AuthUser['role'][];
}

const modules: WorkspaceModule[] = [
  {
    id: 'dashboard',
    title: 'Tổng quan',
    description: 'Trang chủ với thông tin phiên làm việc và các module truy cập nhanh.',
    route: '/overview',
    status: 'ui',
    icon: CheckCircle2,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    id: 'profile',
    title: 'Hồ sơ của tôi',
    description: 'Thông tin tài khoản, hồ sơ cá nhân và phân công công việc.',
    route: '/app/profile',
    status: 'ready',
    icon: Users,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR', 'SYSTEM_ADMIN'],
  },
  {
    id: 'attendance-today',
    title: 'Chấm công hôm nay',
    description: 'Check-in/out, xác thực Network/GPS/Selfie và trạng thái ngay hiện tại.',
    route: '/app/attendance',
    status: 'ui',
    icon: Clock3,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    id: 'attendance-history',
    title: 'Lịch sử công',
    description: 'Lịch sử tháng, chi tiết ngày, evidence và audit ca nhân.',
    route: '/app/attendance/history',
    status: 'planned',
    icon: CalendarDays,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    id: 'leave-ot',
    title: 'Nghỉ phép & OT',
    description: 'Gửi LeaveRequest, OT và theo dõi trạng thái phê duyệt.',
    route: '/app/leave',
    status: 'planned',
    icon: FileText,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    id: 'approvals',
    title: 'Queue phê duyệt',
    description: 'Manager xử lý attendance exception, leave, OT và adjustment đúng scope.',
    route: '/manager/approvals',
    status: 'planned',
    icon: ClipboardCheck,
    roles: ['DEPARTMENT_MANAGER'],
  },
  {
    id: 'directory',
    title: 'Danh bạ nhân viên',
    description: 'Tra cứu nhân viên theo tên, mã, phòng ban và trạng thái.',
    route: '/hr/employees',
    status: 'ready',
    icon: Users,
    roles: ['HR'],
  },
  {
    id: 'contracts',
    title: 'Hợp đồng lao động',
    description: 'Tạo, theo dõi hiệu lực và quản lý hết hạn hợp đồng.',
    route: '/hr/contracts',
    status: 'ready',
    icon: FileText,
    roles: ['HR'],
  },
  {
    id: 'periods',
    title: 'Chốt kỳ công',
    description: 'Review blockers, department confirmation, close/reopen và export snapshot.',
    route: '/hr/periods',
    status: 'planned',
    icon: CheckCircle2,
    roles: ['HR'],
  },
  {
    id: 'payroll',
    title: 'Payroll & Payslip',
    description: 'Tính, review, approve, lock PayrollRun và phát hành payslip.',
    route: '/hr/payroll-runs',
    status: 'planned',
    icon: WalletCards,
    roles: ['HR'],
  },
  {
    id: 'organizations',
    title: 'Organizations',
    description: 'Quản lý Organization, HR đầu tiên, tenant status và audit platform.',
    route: '/platform/organizations',
    status: 'ready',
    icon: Building2,
    roles: ['SYSTEM_ADMIN'],
  },
  {
    id: 'audit-logs',
    title: 'Platform audit',
    description: 'Theo dõi audit nền tảng và support mode theo phần quyền System Admin.',
    route: '/platform/audit-logs',
    status: 'planned',
    icon: ShieldCheck,
    roles: ['SYSTEM_ADMIN'],
  },
];

const roleHome: Record<AuthUser['role'], string> = {
  EMPLOYEE: '/app/attendance',
  DEPARTMENT_MANAGER: '/app/attendance',
  HR: '/hr/employees',
  SYSTEM_ADMIN: '/',
};

interface WorkspaceModulesProps {
  user: AuthUser;
}

export function WorkspaceModules({ user }: WorkspaceModulesProps) {
  const role = user.role;
  const visibleModules = modules.filter((module) => module.roles.includes(role) && (module.route !== '/hr/employees' || !!user.organizationId));

  return (
    <section id="workspace" className="mt-6 space-y-4">
      <Alert className="border-[#cfe0ff] bg-[#f5f9ff]">
        <AlertTriangle className="h-4 w-4 text-[#174ea6]" />
        <AlertTitle className="text-[#111827]">Workspace theo SRS v4.0</AlertTitle>
        <AlertDescription className="text-[#5c6170]">
          Route mac dinh cua role nay la <strong>{roleHome[role]}</strong>. Cac module ben duoi duoc rut tu
          danh sach man hinh MVP trong Docs/SRS_CORESTAFF.md.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {visibleModules.map((module) => {
          const Icon = module.icon;

          return (
            <Card key={module.id} className="border-[#d9dee8] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#111827]">
                  <span className="grid size-9 place-items-center rounded-lg bg-[#eef4ff] text-[#174ea6]">
                    <Icon className="size-4" />
                  </span>
                  {module.title}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
                <CardAction>
                  <Badge variant={module.status === 'ready' ? 'default' : 'secondary'}>
                    {module.status === 'ui' ? 'Giao diện' : module.status === 'ready' ? 'MVP' : 'Next'}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <code className="rounded-md bg-[#f3f6fb] px-2 py-1 text-xs text-[#5c6170]">{module.route}</code>
                {(module.status === 'ui' || module.status === 'ready') ? <AppLink className="text-sm font-medium text-[#174ea6]" href={module.route}>{module.status === 'ready' ? 'Mở' : module.route === '/app/profile' ? 'Mở hồ sơ' : module.route === '/hr/employees' ? 'Mở danh bạ' : 'Mở'}</AppLink> : <Button variant="outline" size="sm" disabled>
                  Mo
                </Button>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-[#d9dee8] shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827]">UI states can chuan bi</CardTitle>
          <CardDescription>
            Cac state bat buoc trong docs de dung chung cho Attendance, approval, timesheet va export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khu vuc</TableHead>
                <TableHead>States</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Today</TableCell>
                <TableCell>loading, ready, submitting, completed, day off, locked, error</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Approval</TableCell>
                <TableCell>loading, data, empty, filtered-empty, forbidden, stale/conflict</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Timesheet</TableCell>
                <TableCell>blockers, partially-confirmed, ready-to-close, closed, rollback/error</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Export</TableCell>
                <TableCell>preparing, ready, downloading, stale snapshot, error</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
