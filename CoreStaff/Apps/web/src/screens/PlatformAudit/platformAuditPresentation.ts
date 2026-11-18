import { formatInstantDateTimeVN } from '@/lib/datetime';
import type { PlatformAuditLogItem } from '@/services/platformService';

/** Vietnamese label and colour for every action the platform audit can hold. */
export const PLATFORM_AUDIT_ACTION_META: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ORGANIZATION_CREATED: { label: 'Tạo tổ chức', tone: 'success' },
  ORGANIZATION_SUSPENDED: { label: 'Khóa tổ chức', tone: 'danger' },
  ORGANIZATION_ACTIVATED: { label: 'Mở lại tổ chức', tone: 'info' },
  INITIAL_HR_CREATED: { label: 'Tạo HR đầu tiên', tone: 'success' },
  ADMIN_LOGIN_SUCCEEDED: { label: 'Admin đăng nhập', tone: 'neutral' },
  ADMIN_LOGIN_FAILED: { label: 'Đăng nhập admin thất bại', tone: 'warning' },
  ADMIN_ACCOUNT_LOCKED: { label: 'Khóa tài khoản admin', tone: 'danger' },
  ADMIN_PASSWORD_CHANGED: { label: 'Admin đổi mật khẩu', tone: 'info' },
  ADMIN_PASSWORD_RESET: { label: 'Admin đặt lại mật khẩu', tone: 'info' },
};

export const PLATFORM_AUDIT_TONE_CLASS: Record<'info' | 'success' | 'warning' | 'danger' | 'neutral', string> = {
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

export function platformAuditActionLabel(action: string): string {
  return PLATFORM_AUDIT_ACTION_META[action]?.label ?? action;
}

/** One readable sentence about what happened, built from the event's details. */
export function describePlatformAudit(item: PlatformAuditLogItem): string {
  const d = (item.details ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  switch (item.action) {
    case 'ORGANIZATION_SUSPENDED':
      parts.push(typeof d.revokedSessions === 'number' ? `Thu hồi ${d.revokedSessions} phiên đăng nhập đang hoạt động` : 'Thu hồi các phiên đăng nhập của tổ chức');
      break;
    case 'ORGANIZATION_ACTIVATED':
      parts.push('Cho phép tổ chức đăng nhập trở lại');
      break;
    case 'ORGANIZATION_CREATED':
      parts.push('Tổ chức mới được tạo trên nền tảng');
      break;
    case 'INITIAL_HR_CREATED':
      parts.push('Mật khẩu tạm được cấp một lần, bắt buộc đổi ở lần đăng nhập đầu');
      break;
    case 'ADMIN_LOGIN_FAILED':
      parts.push(typeof d.failedLoginCount === 'number' ? `Sai mật khẩu (lần ${d.failedLoginCount} liên tiếp)` : 'Sai mật khẩu');
      break;
    case 'ADMIN_ACCOUNT_LOCKED':
      parts.push(typeof d.lockedUntil === 'string' ? `Tạm khóa đến ${formatInstantDateTimeVN(d.lockedUntil)}` : typeof d.lockedMinutes === 'number' ? `Tạm khóa ${d.lockedMinutes} phút` : 'Tài khoản bị tạm khóa do đăng nhập sai nhiều lần');
      break;
    case 'ADMIN_PASSWORD_CHANGED':
      parts.push('Các phiên đăng nhập khác của admin bị thu hồi');
      break;
    case 'ADMIN_PASSWORD_RESET':
      parts.push('Đặt lại qua liên kết email, mọi phiên đăng nhập bị thu hồi');
      break;
    default:
      break;
  }
  if (item.reason) parts.push(`Lý do: ${item.reason}`);
  return parts.join('. ') || '—';
}

/** Human label for who/what the event concerns. */
export function platformAuditTargetLabel(item: PlatformAuditLogItem): string {
  return item.targetSummary || item.targetType || '—';
}
