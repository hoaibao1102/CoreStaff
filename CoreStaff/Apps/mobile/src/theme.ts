export const colors = {
  background: '#f6f8fc',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  ink: '#0f172a',
  inkSoft: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  divider: '#f1f5f9',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primarySoft: '#dbeafe',
  navy: '#172554',
  navySoft: '#93c5fd',
  success: '#16a34a',
  successText: '#166534',
  successSoft: '#f0fdf4',
  warning: '#d97706',
  warningText: '#92400e',
  warningSoft: '#fffbeb',
  danger: '#dc2626',
  dangerText: '#b91c1c',
  dangerSoft: '#fef2f2',
} as const;

export const spacing = {
  micro: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 22,
  xxl: 28,
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
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
