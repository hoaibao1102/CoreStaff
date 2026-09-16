import { forwardRef, type ComponentProps } from 'react';

export const navigationEvent = 'corestaff:navigate';

/** Keep the existing authenticated session when opening a workspace screen. */
export const AppLink = forwardRef<HTMLAnchorElement, ComponentProps<'a'> & { href: string }>(function AppLink({ href, onClick, ...props }, ref) {
  return <a {...props} ref={ref} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey || props.target || props.download != null) return;
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.hash) return;
    event.preventDefault();
    window.history.pushState(null, '', destination);
    window.dispatchEvent(new Event(navigationEvent));
  }} />;
});
