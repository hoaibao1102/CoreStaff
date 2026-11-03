/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { managerRequestKind, managerRequestLabel } from '../src/services/manager.service';
import { ClarificationResponseModal } from '../src/screens/Employee/components/ClarificationResponseModal';
import * as managerService from '../src/services/manager.service';

jest.mock('../src/services/manager.service', () => {
  const actual = jest.requireActual('../src/services/manager.service');
  return {
    ...actual,
    respondRequestClarification: jest.fn(),
  };
});

describe('Clarification Flow & Labels', () => {
  it('correctly maps HR_MISSING_PUNCH_EXPLANATION to CLARIFICATION kind and Vietnamese label', () => {
    const request: any = {
      _id: 'req-1',
      type: 'ATTENDANCE',
      source: 'HR_MISSING_PUNCH_EXPLANATION',
      reason: 'HR yêu cầu nhân viên giải trình',
      status: 'CLARIFICATION_REQUESTED',
    };

    expect(managerRequestKind(request)).toBe('CLARIFICATION');
    expect(managerRequestLabel(request)).toBe('Xác nhận công (Giải trình)');
  });

  describe('ClarificationResponseModal component', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      host = document.createElement('div');
      document.body.append(host);
      root = createRoot(host);
      jest.clearAllMocks();
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      host.remove();
    });

    it('renders HR message and submits clarification with custom check-out time', async () => {
      const mockRespond = managerService.respondRequestClarification as jest.Mock;
      mockRespond.mockResolvedValue({ success: true });

      const request: any = {
        _id: 'req-123',
        type: 'ATTENDANCE',
        source: 'HR_MISSING_PUNCH_EXPLANATION',
        workDate: '2026-10-21T00:00:00Z',
        reason: 'HR yêu cầu giải trình quên bấm ra',
        reviewComment: 'Trình bày rõ lý do và giờ rời văn phòng thực tế',
        version: 1,
        status: 'CLARIFICATION_REQUESTED',
      };

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      await act(async () => {
        root.render(
          <ClarificationResponseModal
            apiBase="http://localhost:3000"
            request={request}
            open={true}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      });

      const dialog = document.querySelector('[role="dialog"]') || document.body;
      expect(dialog.textContent).toContain('Phản hồi giải trình chấm công');
      expect(dialog.textContent).toContain('Trình bày rõ lý do và giờ rời văn phòng thực tế');
      expect(dialog.textContent).toContain('21/10/2026');

      const textarea = dialog.querySelector('textarea')!;
      expect(textarea).not.toBeNull();

      const timeInput = dialog.querySelector<HTMLInputElement>('input[type="time"]')!;
      expect(timeInput).not.toBeNull();
      expect(timeInput.value).toBe('17:00');

      // Change time to 19:30 using prototype setter
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(timeInput, '19:30');
        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Type valid reason >= 10 chars using prototype setter
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Quên bấm ra do ở lại văn phòng OT cùng team');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Submit form
      const submitBtn = dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(submitBtn.disabled).toBe(false);

      await act(async () => {
        dialog.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(mockRespond).toHaveBeenCalledWith(
        'http://localhost:3000',
        'req-123',
        expect.objectContaining({
          reason: 'Quên bấm ra do ở lại văn phòng OT cùng team',
          customCheckOutTime: '2026-10-21T19:30:00+07:00',
          expectedVersion: 1,
        })
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
