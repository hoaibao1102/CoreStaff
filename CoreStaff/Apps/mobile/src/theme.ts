/**
 * Design tokens — đồng bộ với web responsive (emerald / slate).
 * Web: nút giữa #3ae39f, tab active #0f766e, nền slate.
 * Tên token giữ nguyên để các màn cũ không vỡ; giá trị đã chuyển sang emerald.
 */
export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  ink: '#0f172a',
  inkSoft: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  divider: '#f1f5f9',
  primary: '#0f766e',
  primaryDark: '#115e59',
  primarySoft: '#ecfdf5',
  accent: '#3ae39f',
  accentDark: '#10b981',
  navy: '#0f172a',
  navySoft: '#5eead4',
  success: '#16a34a',
  successText: '#166534',
  successSoft: '#f0fdf4',
  warning: '#d97706',
  warningText: '#92400e',
  warningSoft: '#fffbeb',
  danger: '#dc2626',
  dangerText: '#b91c1c',
  dangerSoft: '#fef2f2',
  info: '#0369a1',
  infoSoft: '#f0f9ff',
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
