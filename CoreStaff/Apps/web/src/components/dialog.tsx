import { createContext, useContext, type ComponentProps } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { X } from 'lucide-react';
import { Button } from './button';

const Dialog = DialogPrimitive.Root;
const DialogDepth = createContext(0);
const MODAL_LAYER = { base: 1000, step: 100, popupOffset: 10 };

function DialogContent({
  className,
  backdropClassName,
  children,
  showCloseButton = true,
  layerOffset = 0,
  style,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean; backdropClassName?: string; layerOffset?: number }) {
  const depth = useContext(DialogDepth) + layerOffset;
  const layer = MODAL_LAYER.base + depth * MODAL_LAYER.step;
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop forceRender data-slot="dialog-backdrop" style={{ zIndex: layer }} className={cn('fixed inset-0 bg-black/45 backdrop-blur-[3px]', backdropClassName)} />
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-popover text-sm text-popover-foreground shadow-xl outline-none', className)}
      {...props}
      style={{ ...style, zIndex: layer + MODAL_LAYER.popupOffset }}
    >
      <DialogDepth.Provider value={depth + 1}>{children}</DialogDepth.Provider>
      {showCloseButton && <DialogPrimitive.Close render={<Button variant="ghost" className="absolute right-3 top-3 min-h-11 min-w-11" />} aria-label="Đóng hộp thoại"><X aria-hidden="true" /></DialogPrimitive.Close>}
    </DialogPrimitive.Popup>
  </DialogPrimitive.Portal>;
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex shrink-0 flex-col gap-1 p-6', className)} {...props} />;
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn('text-xl font-semibold text-foreground', className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
