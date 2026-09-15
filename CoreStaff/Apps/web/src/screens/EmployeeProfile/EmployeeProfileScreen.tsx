import { useHrResource } from '../../lib/useHrResource';
import { hrErrorMessage } from '../../services/hrService';
import { useCallback } from 'react';
import type { AuthUser } from '../../services/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Skeleton } from '../../components/skeleton';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { AppLink } from '../../components/AppLink';
import { ChevronLeft, User, Briefcase, Mail, IdCard, CreditCard } from 'lucide-react';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_BADGE,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
} from '../../lib/types';
import { getMyEmployeeProfile } from '../../services/hrService';

/* ───────── Field Row ───────── */
interface FieldRowProps {
  label: string;
  value: string | null | undefined;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">
        {value?.trim() || (
          <span className="text-muted-foreground italic">Chưa có thông tin</span>
        )}
      </dd>
    </div>
  );
}

/* ───────── Profile Section ───────── */
interface ProfileSectionProps {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  loading?: boolean;
}

function ProfileSection({ title, description, icon: Icon, children, loading }: ProfileSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── Main Screen ───────── */
export function EmployeeProfileScreen({
  user,
  apiBase,
}: {
  user: AuthUser;
  apiBase: string | null;
}) {
  const loader = useCallback(async () => {
    const data = await getMyEmployeeProfile(apiBase!);
    if (!user.organizationId || data.organizationId !== user.organizationId || data.userId !== (user._id ?? user.id)) {
      throw Object.assign(new Error('Profile identity mismatch'), { status: 403 });
    }
    return data;
  }, [apiBase, user.organizationId, user._id, user.id]);
  const resource = useHrResource(apiBase ? loader : null);
  const profile = resource.data;
  const loading = resource.loading;
  const detail = resource.error as { status?: number; code?: string } | undefined;
  const error = detail?.status === 404 && detail.code === 'EMPLOYEE_PROFILE_NOT_FOUND'
    ? 'not_found' : resource.error ? hrErrorMessage(resource.error) : null;
  const loadProfile = resource.retry;

  /* Role label map */
  const roleLabel: Record<string, string> = {
    HR: 'Nhân sự',
    EMPLOYEE: 'Nhân viên',
    DEPARTMENT_MANAGER: 'Quản lý phòng ban',
    SYSTEM_ADMIN: 'System Admin',
  };

  /* Account fields from AuthUser */
  const accountFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Họ tên', value: user.fullName },
    { label: 'Email', value: user.email },
    { label: 'Mã nhân viên', value: profile?.employeeCode },
    { label: 'Vai trò', value: roleLabel[user.role] },
  ];

  /* Employment Information fields from EmployeeProfile API */
  const employmentFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Loại lao động', value: profile ? (EMPLOYMENT_TYPE_LABELS as Record<string, string>)[profile.employmentType] : undefined },
    { label: 'Trạng thái', value: profile ? (EMPLOYMENT_STATUS_LABELS as Record<string, string>)[profile.employmentStatus] : undefined },
    { label: 'Ngày vào làm', value: profile?.joinDate ? new Date(profile.joinDate).toLocaleDateString('vi-VN') : undefined },
    { label: 'Phòng ban', value: profile?.departmentName },
    { label: 'Chức danh', value: profile?.positionName },
    { label: 'Quản lý trực tiếp', value: profile?.managerName },
    { label: 'Nơi làm việc', value: profile?.workplaceName },
    { label: 'Ca làm việc', value: undefined },
  ];

  /* Personal Information fields from EmployeeProfile API */
  const personalFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Ngày sinh', value: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('vi-VN') : undefined },
    { label: 'Giới tính', value: profile?.gender ? (GENDER_LABELS as Record<string, string>)[profile.gender] : undefined },
    { label: 'CCCD/CMND', value: profile?.citizenId },
    { label: 'Địa chỉ', value: profile?.address },
  ];

  /* Contact Information fields from EmployeeProfile API */
  const contactFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Số điện thoại', value: profile?.phone },
    { label: 'Email', value: profile?.email },
  ];

  /* Payroll / Legal Information fields from EmployeeProfile API */
  const payrollFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Mã số thuế', value: profile?.taxCode },
    { label: 'Số BHXH', value: profile?.socialInsuranceCode },
    { label: 'Tài khoản ngân hàng', value: profile?.bankAccount },
  ];

  return (
    <div className="space-y-6">
      {!apiBase && <EmployeeDataState status="unavailable" />}
      {loading && <EmployeeDataState status="loading" />}
      {error === 'not_found' ? <EmployeeDataState status="empty" description="Tài khoản của bạn chưa có hồ sơ nhân sự. Vui lòng liên hệ HR." />
        : error && <EmployeeDataState status="error" message={error} onRetry={loadProfile} />}

      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
            Quản lý tài khoản
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Hồ sơ của tôi
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Thông tin tài khoản và hồ sơ nhân sự của bạn.
          </p>
        </div>
        <AppLink href="/" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline sm:mt-0">
          <ChevronLeft className="h-4 w-4" />
          Tổng quan
        </AppLink>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <User className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">{user.fullName}</h2>
            <p className="text-sm text-muted-foreground">{profile?.employeeCode || 'Chưa có mã nhân viên'}</p>
          </div>
          {profile && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${(EMPLOYMENT_STATUS_BADGE as Record<string, string>)[profile.employmentStatus]}`}>
                {(EMPLOYMENT_STATUS_LABELS as Record<string, string>)[profile.employmentStatus]}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Info */}
      <ProfileSection
        title="Thông tin tài khoản"
        description="Thông tin tài khoản đăng nhập của bạn"
        icon={User}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          {accountFields.map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </dl>
      </ProfileSection>

      {/* Personal Information */}
      <ProfileSection
        title="Thông tin cá nhân"
        description="Thông tin cá nhân từ hồ sơ nhân sự"
        icon={IdCard}
        loading={loading}
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personalFields.map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </dl>
      </ProfileSection>

      {/* Contact Information */}
      <ProfileSection
        title="Thông tin liên hệ"
        description="Thông tin liên hệ từ hồ sơ nhân sự"
        icon={Mail}
        loading={loading}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          {contactFields.map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </dl>
      </ProfileSection>

      {/* Employment Information */}
      <ProfileSection
        title="Thông tin tuyển dụng"
        description="Thông tin công việc và tổ chức"
        icon={Briefcase}
        loading={loading}
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employmentFields.map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </dl>
      </ProfileSection>

      {/* Payroll / Legal Information */}
      <ProfileSection
        title="Thông tin lương & pháp lý"
        description="Thông tin tài chính và giấy tờ pháp lý"
        icon={CreditCard}
        loading={loading}
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payrollFields.map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </dl>
      </ProfileSection>
    </div>
  );
}
