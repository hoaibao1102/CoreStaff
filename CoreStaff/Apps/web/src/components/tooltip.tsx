import type { ReactElement, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

/** Portal positioning keeps hints clear of scrollable navigation and panels. */
export function Tooltip({ children, content, disabled = false }: {
  children: ReactElement;
  content: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger render={children} delay={200} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="right" sideOffset={12} className="z-50">
          <TooltipPrimitive.Popup role="tooltip" className="max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
