import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];

interface IconProps { name: AppIconName; size?: number; color: string }

/** Icon set thống nhất (Ionicons). Font được nạp trước khi render ở App.tsx. */
export function AppIcon({ name, size = 22, color }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
