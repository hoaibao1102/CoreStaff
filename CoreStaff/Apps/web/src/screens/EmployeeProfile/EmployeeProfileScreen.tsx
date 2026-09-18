import { useCallback, useState, useEffect } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ContactRound,
  CreditCard,
  Download,
  FileText,
  Hash,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { AppLink } from '../../components/AppLink';
import { Avatar, AvatarFallback } from '../../components/avatar';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Skeleton } from '../../components/skeleton';
import { useHrResource } from '../../lib/useHrResource';
import { toast } from '../../components/toast';
import {
  EMPLOYMENT_STATUS_BADGE,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
} from '../../lib/types';
import { roleLabel } from '../../lib/labels';
import type { AuthUser } from '../../services/auth';
import {
  getMyEmployeeProfile,
  getMyDocuments,
  downloadDocument,
  hrErrorMessage,
  type EmployeeProfile,
  type EmployeeDocument,
} from '../../services/hrService';
import { SelfProvisionDialog } from '../EmployeeDirectory/components/SelfProvisionDialog';

/* ───────── Helpers ───────── */

function display(value: string | null | undefined): string {
  const text = value?.trim();
  return text || '—';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? '—' : time.toLocaleDateString('vi-VN');
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CS';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] ?? '';
  return `${first}${last}`.toLocaleUpperCase('vi');
}

function accountStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Đang hoạt động',
    LOCKED: 'Đang khóa',
    DISABLED: 'Đã vô hiệu hóa',
  };
  return status ? labels[status] ?? status : '—';
}

/* ───────── State Banners ───────── */

function StateBanner({
  kind,
  message,
  onRetry,
}: {
  kind: 'unavailable' | 'empty' | 'error';
  message: string;
  onRetry?: () => void;
}) {
  /* Use semantic destructive color for errors, muted for others. */
  const alertClass = kind === 'error'
    ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : kind === 'empty'
      ? 'border-amber-300/50 bg-amber-50/50 text-amber-800'
      : 'border-muted-foreground/20 bg-muted/30 text-muted-foreground';

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${alertClass}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span>{message}</span>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className={`w-full sm:w-auto ${kind !== 'error' ? 'bg-background' : ''}`}
        >
          Thử lại
        </Button>
      )}
    </div>
  );
}

/* ───────── Skeletons ───────── */

function ProfileSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Đang tải hồ sơ">
      {/* Header skeleton */}
      <Card className="rounded-xl border-border shadow-none">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-56 max-w-full" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Sections skeleton */}
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ───────── Profile Header ───────── */

function ProfileHeader({ user, profile }: { user: AuthUser; profile?: EmployeeProfile }) {
  const name = display(profile?.fullName ?? user.fullName);
  const title = display(profile?.positionName);
  const department = display(profile?.departmentName);
  const contactEmail = display(profile?.email ?? user.email);
  const phone = display(profile?.phone);
  const employeeCode = display(profile?.employeeCode ?? user.employeeCode);

  const statusLabel = profile
    ? EMPLOYMENT_STATUS_LABELS[profile.employmentStatus]
    : 'Chưa có hồ sơ nhân sự';

  /* Map employment status to a readable tone class. */
  const statusTone = profile
    ? (() => {
      const s = profile.employmentStatus;
      if (s === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      if (s === 'PROBATION') return 'border-amber-200 bg-amber-50 text-amber-700';
      if (s === 'ON_LEAVE') return 'border-blue-200 bg-blue-50 text-blue-700';
      if (s === 'RESIGNED') return 'border-slate-200 bg-slate-50 text-slate-600';
      if (s === 'TERMINATED') return 'border-red-200 bg-red-50 text-red-700';
      return 'border-slate-200 bg-slate-50 text-slate-600';
    })()
    : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <Card className="rounded-xl border-border shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Avatar + Name + Meta */}
          <div className="flex min-w-0 flex-col gap-4 text-center sm:flex-row sm:text-left">
            <Avatar size="lg" className="h-20 w-20 shrink-0 text-lg" aria-label={`Avatar của ${name}`}>
              <AvatarFallback className="bg-primary/10 font-bold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="secondary">{roleLabel(user.role)}</Badge>
                <span className={`inline-flex h-5 items-center rounded-full border border-transparent px-2 text-xs font-medium ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {name}
              </h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {title}{department !== '—' ? ` · ${department}` : ''}
              </p>
            </div>
          </div>

          {/* Right: Quick info chips */}
          <div className="grid gap-2 text-sm text-foreground sm:grid-cols-2 lg:min-w-80 lg:grid-cols-1">
            <span className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:justify-start">
              <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{employeeCode}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:justify-start">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{contactEmail}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:justify-start">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{phone}</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── Summary Stat Cards ───────── */

function SummaryStats({ profile, user }: { profile?: EmployeeProfile; user: AuthUser }) {
  const stats = [
    {
      label: 'Vai trò',
      value: roleLabel(user.role),
    },
    {
      label: 'Tài khoản',
      value: accountStatusLabel(user.status),
      tone: user.status === 'ACTIVE'
        ? 'text-emerald-700'
        : user.status === 'LOCKED'
          ? 'text-amber-700'
          : user.status === 'DISABLED'
            ? 'text-red-700'
            : 'text-foreground',
    },
    {
      label: 'Trạng thái nhân sự',
      value: profile ? EMPLOYMENT_STATUS_LABELS[profile.employmentStatus] : '—',
      tone: profile?.employmentStatus === 'ACTIVE'
        ? 'text-emerald-700'
        : profile?.employmentStatus === 'PROBATION'
          ? 'text-amber-700'
          : profile?.employmentStatus === 'ON_LEAVE'
            ? 'text-blue-700'
            : profile?.employmentStatus === 'RESIGNED'
              ? 'text-slate-600'
              : profile?.employmentStatus === 'TERMINATED'
                ? 'text-red-700'
                : 'text-muted-foreground',
    },
    {
      label: 'Ngày vào làm',
      value: formatDate(profile?.joinDate),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, tone }) => (
        <div
          key={label}
          className="rounded-lg border border-border bg-card px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <p className={`mt-1 text-sm font-semibold leading-6 ${tone ?? 'text-foreground'}`}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ───────── Info Section ───────── */

type ProfileField = {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  wide?: boolean;
};

function InfoSection({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: ProfileField[];
}) {
  return (
    <Card className="rounded-xl border-border shadow-none">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(field => (
            <div
              key={field.label}
              className={`min-w-0 rounded-lg border border-border/60 bg-card px-4 py-3 ${field.wide ? 'sm:col-span-2' : ''}`}
            >
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                {field.icon && (
                  <field.icon className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                )}
                {field.label}
              </dt>
              <dd className="mt-1.5 min-h-5 break-words text-sm font-semibold leading-6 text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/* ───────── Self Documents (TASK-029) ───────── */
/** Own-documents list for the caller (`/app/documents`, no @Roles — mirrors the
 * `GET /hr/employees/me` self-service precedent). Download is tenant+owner-scoped
 * server-side; a document from someone else's profile 404s. */
function MyDocumentsSection({ apiBase }: { apiBase: string }) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setFailed(false);
      setDocs(await getMyDocuments(apiBase));
    } catch {
      setDocs([]);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold text-foreground">Tài liệu của tôi</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-16 rounded-lg" /></CardContent>
      </Card>
    );
  }
  if (failed) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold text-foreground">Tài liệu của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Không tải được danh sách tài liệu.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Thử lại</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-xl border-border shadow-none">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span className="rounded-lg bg-muted p-2 text-muted-foreground"><FileText className="h-4 w-4" aria-hidden="true" /></span>
          Tài liệu của tôi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tài liệu nào.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {docs.map((doc) => (
              <li key={doc._id} className="flex items-center gap-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline"
                  title={`Tải ${doc.originalName}`}
                  onClick={() => void downloadDocument(apiBase, doc._id).catch((err) => toast.error('Không thể tải xuống', hrErrorMessage(err)))}
                >
                  {doc.originalName}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </li>
            ))}
          </ul>
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
  const [selfProvisionOpen, setSelfProvisionOpen] = useState(false);
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
  const missingProfile = detail?.status === 404 && detail.code === 'EMPLOYEE_PROFILE_NOT_FOUND';
  const error = missingProfile ? null : resource.error ? hrErrorMessage(resource.error) : null;
  // FR-SYS-02 gap: HR and Department Manager have no producing flow — they create
  // their own profile. A plain employee has no rights and is told to contact HR.
  const canSelfProvision = missingProfile && (user.role === 'HR' || user.role === 'DEPARTMENT_MANAGER');

  /* ── Field definitions ── */

  const personalFields: ProfileField[] = [
    { label: 'Họ tên', value: display(profile?.fullName ?? user.fullName), icon: UserRound },
    { label: 'Ngày sinh', value: formatDate(profile?.dateOfBirth), icon: CalendarDays },
    { label: 'Giới tính', value: profile?.gender ? GENDER_LABELS[profile.gender] : '—', icon: ContactRound },
    { label: 'CCCD/CMND', value: display(profile?.citizenId), icon: IdCard },
    { label: 'Địa chỉ', value: display(profile?.address), icon: MapPin, wide: true },
  ];

  const contactFields: ProfileField[] = [
    { label: 'Email nhân sự', value: display(profile?.email), icon: Mail },
    { label: 'Email đăng nhập', value: display(user.email), icon: Mail },
    { label: 'Số điện thoại', value: display(profile?.phone), icon: Phone },
  ];

  const employmentFields: ProfileField[] = [
    { label: 'Mã nhân viên', value: display(profile?.employeeCode ?? user.employeeCode), icon: Hash },
    { label: 'Phòng ban', value: display(profile?.departmentName), icon: UsersRound },
    { label: 'Chức danh', value: display(profile?.positionName), icon: BriefcaseBusiness },
    { label: 'Quản lý trực tiếp', value: display(profile?.managerName), icon: UserRound },
    { label: 'Loại lao động', value: profile ? EMPLOYMENT_TYPE_LABELS[profile.employmentType] : '—', icon: BriefcaseBusiness },
    { label: 'Ngày vào làm', value: formatDate(profile?.joinDate), icon: CalendarDays },
    { label: 'Nơi làm việc', value: display(profile?.workplaceName), icon: MapPin },
    { label: 'Ca làm việc', value: '—', icon: CalendarDays },
  ];

  const accountFields: ProfileField[] = [
    { label: 'Họ tên đăng nhập', value: display(user.fullName), icon: UserRound },
    { label: 'Email đăng nhập', value: display(user.email), icon: Mail },
    { label: 'Vai trò hệ thống', value: roleLabel(user.role), icon: ShieldCheck },
    { label: 'Trạng thái tài khoản', value: accountStatusLabel(user.status), icon: ShieldCheck },
    { label: 'Mã tài khoản', value: display(user._id ?? user.id), icon: Hash, wide: true },
  ];

  const legalFields: ProfileField[] = [
    { label: 'Mã số thuế', value: display(profile?.taxCode), icon: CreditCard },
    { label: 'Số BHXH', value: display(profile?.socialInsuranceCode), icon: CreditCard },
    { label: 'Tài khoản ngân hàng', value: display(profile?.bankAccount), icon: CreditCard, wide: true },
  ];

  /* ── Render ── */

  return (
    <div className="space-y-6">
      {/* Page Header — follows Design Master D */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Hồ sơ của tôi
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Xem thông tin tài khoản, hồ sơ cá nhân và phân công công việc của bạn.
          </p>
        </div>
        <AppLink href="/overview">
          <Button type="button" variant="outline" className="w-full bg-background sm:w-auto">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tổng quan
          </Button>
        </AppLink>
      </div>

      {/* Data state banners */}
      {!apiBase && (
        <StateBanner kind="unavailable" message="API nhân sự chưa khả dụng. Thông tin tài khoản vẫn được hiển thị từ phiên đăng nhập." />
      )}
      {error && <StateBanner kind="error" message={error} onRetry={resource.retry} />}
      {missingProfile && !canSelfProvision && (
        <StateBanner kind="empty" message="Tài khoản của bạn chưa có hồ sơ nhân sự. Vui lòng liên hệ HR để bổ sung hồ sơ." />
      )}
      {canSelfProvision && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Tài khoản của bạn chưa có hồ sơ nhân sự. Hãy tự tạo hồ sơ nghiệp vụ của bạn ngay — chỉ cần nhập các thông tin
            như mã nhân viên, ngày vào làm và phòng ban.
          </span>
          <Button type="button" variant="default" className="w-full sm:w-auto" onClick={() => setSelfProvisionOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Tạo hồ sơ của tôi
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <ProfileSkeleton />
      ) : (
        <>
          <ProfileHeader user={user} profile={profile} />
          <SummaryStats profile={profile} user={user} />

          {apiBase && profile && <MyDocumentsSection apiBase={apiBase} />}

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <InfoSection
                title="Thông tin cá nhân"
                description="Thông tin định danh từ hồ sơ nhân sự."
                fields={personalFields}
              />
              <InfoSection
                title="Liên hệ"
                description="Các kênh liên hệ dùng trong vận hành nội bộ."
                fields={contactFields}
              />
            </div>
            <div className="space-y-5">
              <InfoSection
                title="Công việc"
                description="Thông tin tổ chức, vị trí và thời điểm làm việc."
                fields={employmentFields}
              />
              <InfoSection
                title="Tài khoản & bảo mật"
                description="Quyền truy cập và trạng thái tài khoản hiện tại."
                fields={accountFields}
              />
              <InfoSection
                title="Pháp lý & thanh toán"
                description="Thông tin pháp lý có trong hồ sơ nhân sự."
                fields={legalFields}
              />
            </div>
          </div>
        </>
      )}

      {/* Phase C — HR / Department Manager self-provisioning CTA */}
      {apiBase && canSelfProvision && (
        <SelfProvisionDialog
          apiBase={apiBase}
          open={selfProvisionOpen}
          user={user}
          onOpenChange={setSelfProvisionOpen}
          onCreated={() => {
            setSelfProvisionOpen(false);
            resource.retry();
          }}
        />
      )}
    </div>
  );
}
