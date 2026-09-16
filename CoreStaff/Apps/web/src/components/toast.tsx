import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from 'cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  description?: string;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  title: string;
  type: ToastType;
  leaving?: boolean;
}

const TOAST_EVENT = 'corestaff:toast';
const MAX_TOASTS = 4;
const EXIT_MS = 220;
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

let nextToastId = 0;

function notify(type: ToastType, title: string, options?: ToastOptions | string) {
  if (typeof window === 'undefined') return;
  const normalized = typeof options === 'string' ? { description: options } : options;
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, {
    detail: { id: ++nextToastId, type, title, ...normalized },
  }));
}

export const toast = {
  success: (title: string, options?: ToastOptions | string) => notify('success', title, options),
  error: (title: string, options?: ToastOptions | string) => notify('error', title, options),
  warning: (title: string, options?: ToastOptions | string) => notify('warning', title, options),
  info: (title: string, options?: ToastOptions | string) => notify('info', title, options),
};

const appearance = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-600', accent: 'border-l-emerald-500' },
  error: { icon: AlertCircle, iconClass: 'text-destructive', accent: 'border-l-destructive' },
  warning: { icon: TriangleAlert, iconClass: 'text-amber-600', accent: 'border-l-amber-500' },
  info: { icon: Info, iconClass: 'text-blue-600', accent: 'border-l-blue-500' },
} satisfies Record<ToastType, { icon: typeof Info; iconClass: string; accent: string }>;

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const exitTimers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems(current => current.map(item => item.id === id ? { ...item, leaving: true } : item));
    const exitTimer = window.setTimeout(() => {
      exitTimers.current.delete(id);
      setItems(current => current.filter(item => item.id !== id));
    }, EXIT_MS);
    exitTimers.current.set(id, exitTimer);
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    const onToast = (event: Event) => {
      const item = (event as CustomEvent<ToastItem>).detail;
      setItems(current => {
        const candidates = [...current.filter(entry => !entry.leaving), item];
        const next = candidates.slice(-MAX_TOASTS);
        candidates.slice(0, -MAX_TOASTS).forEach(dropped => {
          const droppedTimer = activeTimers.get(dropped.id);
          if (droppedTimer) clearTimeout(droppedTimer);
          activeTimers.delete(dropped.id);
        });
        return next;
      });
      const timer = window.setTimeout(() => remove(item.id), item.duration ?? DEFAULT_DURATION[item.type]);
      activeTimers.set(item.id, timer);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
      exitTimers.current.forEach(clearTimeout);
      exitTimers.current.clear();
    };
  }, [remove]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-label="Thông báo"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[3000] flex flex-col items-end gap-2.5 sm:left-auto sm:right-6 sm:top-6 sm:w-[360px]"
    >
      {items.map(item => {
        const style = appearance[item.type];
        const Icon = style.icon;
        return (
          <div
            key={item.id}
            role={item.type === 'error' ? 'alert' : 'status'}
            aria-live={item.type === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto w-full max-w-[calc(100vw-2rem)] rounded-xl border border-l-4 bg-popover p-4 text-popover-foreground shadow-lg',
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-3 motion-safe:duration-200',
              item.leaving && 'motion-safe:animate-out motion-safe:fade-out motion-safe:slide-out-to-right-3 motion-safe:duration-200',
              style.accent,
            )}
          >
            <div className="flex items-start gap-3">
              <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', style.iconClass)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{item.title}</p>
                {item.description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>}
              </div>
              <button type="button" onClick={() => remove(item.id)} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label="Đóng thông báo">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
