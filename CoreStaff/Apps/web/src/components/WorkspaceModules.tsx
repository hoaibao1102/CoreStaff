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
import { canViewEmployees, canViewProfile } from '../lib/employee';

type ModuleStatus = 'ready' | 'planned' | 'ui';

interface WorkspaceModule {
  title: string;
  description: string;
  route: string;
  status: ModuleStatus;
  icon: typeof Clock3;
  roles: AuthUser['role'][];
}

const modules: WorkspaceModule[] = [
  {
    title: 'Hồ sơ của tôi',
    description: 'Thông tin tài khoản và phân công công việc của bạn.',
    route: '/app/profile',
    status: 'ui',
    icon: Users,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    title: 'Cham cong hom nay',
    description: 'Check-in/out, bang chung Network/GPS/Selfie va trang thai ngay hien tai.',
    route: '/app/attendance',
    status: 'ready',
    icon: Clock3,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    title: 'Lich su cong',
    description: 'Lich su thang, chi tiet ngay, evidence va audit ca nhan.',
    route: '/app/attendance/history',
    status: 'ready',
    icon: CalendarDays,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    title: 'Nghi phep va OT',
    description: 'Gui LeaveRequest, OT va theo doi trang thai phe duyet.',
    route: '/app/leave',
    status: 'ready',
    icon: FileText,
    roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'HR'],
  },
  {
    title: 'Queue phe duyet',
    description: 'Manager xu ly attendance exception, leave, OT va adjustment dung scope.',
    route: '/manager/approvals',
    status: 'planned',
    icon: ClipboardCheck,
    roles: ['DEPARTMENT_MANAGER'],
  },
  {
    title: 'Danh bạ nhân viên',
    description: 'Tra cứu nhân viên theo tên, mã, phòng ban và trạng thái.',
    route: '/hr/employees',
    status: 'ui',
    icon: Users,
    roles: ['HR'],
  },
  {
    title: 'Chot ky cong',
    description: 'Review blockers, department confirmation, close/reopen va export snapshot.',
    route: '/hr/periods',
    status: 'planned',
    icon: CheckCircle2,
    roles: ['HR'],
  },
  {
    title: 'Payroll va Payslip',
    description: 'Tinh, review, approve, lock PayrollRun va phat hanh payslip.',
    route: '/hr/payroll-runs',
    status: 'planned',
    icon: WalletCards,
    roles: ['HR'],
  },
  {
    title: 'Organizations',
    description: 'Quan ly Organization, HR dau tien, tenant status va audit platform.',
    route: '/platform/organizations',
    status: 'planned',
    icon: Building2,
    roles: ['SYSTEM_ADMIN'],
  },
  {
    title: 'Platform audit',
    description: 'Theo doi audit nen tang va support mode theo phan quyen System Admin.',
    route: '/platform/audit-logs',
    status: 'planned',
    icon: ShieldCheck,
    roles: ['SYSTEM_ADMIN'],
  },
];

const roleHome: Record<AuthUser['role'], string> = {
  EMPLOYEE: '/app/attendance',
  DEPARTMENT_MANAGER: '/manager/approvals',
  HR: '/hr/dashboard',
  SYSTEM_ADMIN: '/platform/organizations',
};

interface WorkspaceModulesProps {
  user: AuthUser;
}

export function WorkspaceModules({ user }: WorkspaceModulesProps) {
  const role = user.role;
  const visibleModules = modules.filter((module) => module.roles.includes(role)
    && (module.route !== '/hr/employees' || canViewEmployees(user))
    && (module.route !== '/app/profile' || canViewProfile(user)));

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
            <Card key={module.route} className="border-[#d9dee8] shadow-sm">
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
                {module.status === 'ui' ? <AppLink className="text-sm font-medium text-[#174ea6]" href={module.route}>{module.route === '/hr/employees' ? 'Mở danh bạ' : 'Mở hồ sơ'}</AppLink> : <Button variant="outline" size="sm" disabled={module.status !== 'ready'}>
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
