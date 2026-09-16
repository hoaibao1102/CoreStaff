/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { toast, ToastViewport } from '../src/components/toast';

test('toast dismisses automatically by severity and supports manual dismissal', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.useFakeTimers();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
        await act(async () => root.render(<ToastViewport />));
        await act(async () => { toast.success('Saved'); toast.error('Retry'); });
        expect(document.querySelector('[aria-label="Thông báo"]')?.className).toContain('sm:right-6');
        expect(document.querySelector('[role="status"]')?.textContent).toContain('Saved');
        await act(async () => jest.advanceTimersByTime(3000));
        await act(async () => jest.advanceTimersByTime(220));
        expect(document.querySelector('[role="status"]')).toBeNull();
        expect(document.querySelector('[role="alert"]')?.textContent).toContain('Retry');
        await act(async () => jest.advanceTimersByTime(2000));
        await act(async () => jest.advanceTimersByTime(220));
        expect(document.querySelector('[role="alert"]')).toBeNull();
        await act(async () => toast.info('Dismiss me'));
        await act(async () => (document.querySelector('[aria-label="Đóng thông báo"]') as HTMLButtonElement).click());
        await act(async () => jest.advanceTimersByTime(220));
        expect(document.querySelector('[role="status"]')).toBeNull();
    } finally {
        await act(async () => root.unmount());
        container.remove();
        jest.useRealTimers();
    }
});
