/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CheckOutConfirmModal } from '../src/screens/Attendance/components/CheckOutConfirmModal';
import type { DayAttendance } from '../src/screens/Attendance/types';

describe('CheckOutConfirmModal', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const baseDay: DayAttendance = {
    id: 'day-1',
    workDate: '2026-10-30',
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 - 17:00',
    workplace: 'Trụ sở chính',
    workplaceAddress: 'Số 1 Đại Cồ Việt, Hà Nội',
    status: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    attendanceMethod: 'GPS',
    checkIn: {
      eventId: 'evt-1',
      recordedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4h ago
      method: 'GPS',
    },
  };

  it('does not render when isOpen is false', async () => {
    await act(async () => {
      root.render(
        <CheckOutConfirmModal
          isOpen={false}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          today={baseDay}
        />
      );
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders shift and check-in summary when open', async () => {
    await act(async () => {
      root.render(
        <CheckOutConfirmModal
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          today={baseDay}
        />
      );
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Xác nhận Tan ca (Check-out)');
    expect(dialog?.textContent).toContain('Ca hành chính');
    expect(dialog?.textContent).toContain('08:00 - 17:00');
    expect(dialog?.textContent).toContain('Trụ sở chính');
  });

  it('triggers onConfirm when user clicks the confirm button', async () => {
    const handleConfirm = jest.fn();
    const handleClose = jest.fn();

    await act(async () => {
      root.render(
        <CheckOutConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          today={baseDay}
        />
      );
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmButton = buttons.find((b) => b.textContent?.includes('Xác nhận Tan ca'));
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
    });

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('triggers onClose when user clicks cancel button', async () => {
    const handleConfirm = jest.fn();
    const handleClose = jest.fn();

    await act(async () => {
      root.render(
        <CheckOutConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          today={baseDay}
        />
      );
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const cancelButton = buttons.find((b) => b.textContent?.includes('Tiếp tục làm việc'));
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton?.click();
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });
});

