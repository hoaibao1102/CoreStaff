import type { ComponentProps } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { X } from 'lucide-react';
import { Button } from './button';

const Dialog = DialogPrimitive.Root;

function DialogContent({ className, children, showCloseButton = true, ...props }: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40" />
    <DialogPrimitive.Popup
      data-slot="dialog-content"
      className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-popover text-sm text-popover-foreground shadow-xl outline-none', className)}
      {...props}
    >
      {children}
      {showCloseButton && <DialogPrimitive.Close render={<Button variant="ghost" className="absolute right-3 top-3 min-h-11 min-w-11" />} aria-label="Đóng hộp thoại"><X aria-hidden="true" /></DialogPrimitive.Close>}
    </DialogPrimitive.Popup>
  </DialogPrimitive.Portal>;
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-6', className)} {...props} />;
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn('text-xl font-semibold text-foreground', className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
