/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

describe('overtime preview UX', () => {
  it('discards an old date response and disables selection while loading', async () => {
    const { OvertimeSuggestions } = require('../src/components/overtime/OvertimeSuggestions');
    const container = document.createElement('div'); const root = createRoot(container);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const select = jest.fn();
    await act(async () => root.render(<OvertimeSuggestions workDate="2026-09-23" loading={false} onSelect={select} schedule={{ workDate: '2026-09-22', suggestedOvertimeIntervals: [{ from: 'a', to: 'b', canFile: true, payableMinutes: 60 }] }} />));
    expect(container.querySelector('button')).toBeNull();
    await act(async () => root.render(<OvertimeSuggestions workDate="2026-09-22" loading={true} onSelect={select} schedule={{ workDate: '2026-09-22', suggestedOvertimeIntervals: [{ from: '2026-09-22T10:00:00Z', to: '2026-09-22T11:00:00Z', canFile: true, payableMinutes: 60 }] }} />));
    expect(container.querySelector('button')?.disabled).toBe(true);
    await act(async () => root.unmount());
  });
  it('shows interval blocking reasons and disables selection during submit', async () => {
    const { OvertimeSuggestions } = require('../src/components/overtime/OvertimeSuggestions');
    const container = document.createElement('div'); const root = createRoot(container);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const select = jest.fn();
    await act(async () => root.render(<OvertimeSuggestions workDate="2026-09-22" loading={false} submitting onSelect={select} schedule={{ workDate: '2026-09-22', suggestedOvertimeIntervals: [{ from: '2026-09-22T10:00:00Z', to: '2026-09-22T11:00:00Z', canFile: false, rawEligibleMinutes: 20, payableMinutes: 0, blockedReasons: ['OVERTIME_BELOW_MINIMUM'] }] }} />));
    expect(container.textContent).toContain('ngưỡng tối thiểu');
    expect(container.querySelector('button')?.disabled).toBe(true);
    await act(async () => container.querySelector('button')!.click());
    expect(select).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
  it('shows raw/payable and blocks unsupported evidence', async () => {
    const { OvertimePreviewSummary } = require('../src/components/overtime/OvertimePreviewSummary');
    const container = document.createElement('div'); document.body.appendChild(container);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const root = createRoot(container);
    await act(async () => root.render(<OvertimePreviewSummary loading={false} preview={{ workDate: '2026-09-22', canFile: false, blockedReasons: ['OVERTIME_ATTENDANCE_INCOMPLETE'], rawEligibleMinutes: 95, payableMinutes: 90, roundingDroppedMinutes: 5 }} />));
    expect(container.textContent).toContain('95');
    expect(container.textContent).toContain('90');
    expect(container.textContent).toContain('không xác nhận thời gian OT');
    await act(async () => root.unmount()); container.remove();
  });
  it('calls the preview API without trusting client minutes', async () => {
    const { previewOvertime } = require('../src/services/overtime.service');
    global.fetch = jest.fn(async () => ({ ok: true, text: async () => JSON.stringify({ success: true, data: { rawEligibleMinutes: 95, payableMinutes: 90 } }) })) as any;
    await previewOvertime('https://example.test', { workDate: '2026-09-22', requestedStart: '2026-09-22T10:00:00Z', requestedEnd: '2026-09-22T12:00:00Z' });
    expect(fetch).toHaveBeenCalledWith('https://example.test/api/overtime/preview', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });
});
