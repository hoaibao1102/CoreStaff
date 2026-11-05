/**
 * Design tokens — khớp nguyên bảng màu app Flutter (lib/core/theme/app_colors.dart):
 * xanh dương (blue-600), nền #f6f8fc, thẻ ca làm tối #172554.
 * Tên token giữ nguyên để mọi màn dùng chung.
 */
export const colors = {
  background: '#f6f8fc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  ink: '#0f172a',
  inkSoft: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#cbd5e1',
  borderDanger: '#fecaca',
  divider: '#f1f5f9',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',
  primarySoft: '#dbeafe',
  // Nút "accent" nằm trên thẻ tối (nút trắng, chữ tối) và glow của nút giữa tab bar.
  accent: '#ffffff',
  accentDark: '#2563eb',
  navy: '#172554',
  navySoft: '#93c5fd',
  success: '#4ade80',
  successDot: '#4ade80',
  successText: '#166534',
  successSoft: '#f0fdf4',
  successBorder: '#bbf7d0',
  warning: '#d97706',
  warningText: '#b45309',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#dc2626',
  dangerText: '#b91c1c',
  dangerSoft: '#fef2f2',
  info: '#1e40af',
  infoSoft: '#eff6ff',
  infoBorder: '#bfdbfe',
} as const;

export const spacing = {
  micro: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 20,
  xxl: 24,
  huge: 40,
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

/** Chiều cao thanh tab (chưa gồm safe-area dưới) — màn cuộn cần chừa chỗ. */
export const TAB_BAR_HEIGHT = 64;
