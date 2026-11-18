/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AdjustmentRequestForm, type AdjustmentRow } from '../src/screens/Employee/components/AdjustmentRequestForm';
import { createMyRequest } from '../src/services/manager.service';

jest.mock('../src/services/manager.service', () => {
  const actual = jest.requireActual('../src/services/manager.service');
  return { ...actual, createMyRequest: jest.fn() };
});
jest.mock('../src/components/toast', () => ({
  toast: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const createRequest = createMyRequest as jest.Mock;

/** A date that is always in the past, so the form's past-only check passes. */
const PAST = '2026-01-15';
const PAST_2 = '2026-01-16';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  createRequest.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

async function render(rows: AdjustmentRow[], reason = 'Ngày này tôi có làm nhưng quên chấm công ra') {
  const onDone = jest.fn();
  await act(async () => {
    root.render(
      <AdjustmentRequestForm
        apiBase="https://api.test"
        rows={rows}
        onRowsChange={() => {}}
        reason={reason}
        onReasonChange={() => {}}
        selectable
        onDone={onDone}
        onCancel={() => {}}
      />,
    );
  });
  return { onDone };
}

function submit() {
  const button = container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
  return act(async () => button.click());
}

describe('AdjustmentRequestForm bulk submit (QC 2.2)', () => {
  test('files one adjustment request per selected day', async () => {
    createRequest.mockResolvedValue({});
    const { onDone } = await render([
      { workDate: PAST, adjustmentType: 'CHECK_IN', time: '08:15', enabled: true },
      { workDate: PAST_2, adjustmentType: 'CHECK_OUT', time: '19:30', enabled: true },
      { workDate: '2026-01-17', adjustmentType: 'CHECK_OUT', time: '17:00', enabled: false },
    ]);

    await submit();

    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(createRequest).toHaveBeenNthCalledWith(1, 'https://api.test', expect.objectContaining({
      type: 'ATTENDANCE', workDate: PAST, adjustmentType: 'CHECK_IN', requestedStart: `${PAST}T08:15:00+07:00`,
    }));
    expect(createRequest).toHaveBeenNthCalledWith(2, 'https://api.test', expect.objectContaining({
      workDate: PAST_2, adjustmentType: 'CHECK_OUT', requestedStart: `${PAST_2}T19:30:00+07:00`,
    }));
    expect(onDone).toHaveBeenCalled();
  });

  test('keeps the other days when one day fails', async () => {
    createRequest
      .mockRejectedValueOnce({ code: 'CHECK_IN_ALREADY_EXISTS' })
      .mockResolvedValueOnce({});
    const { onDone } = await render([
      { workDate: PAST, adjustmentType: 'CHECK_IN', time: '08:15', enabled: true },
      { workDate: PAST_2, adjustmentType: 'CHECK_OUT', time: '19:30', enabled: true },
    ]);

    await submit();

    expect(createRequest).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain('đã có mốc chấm công vào');
    expect(onDone).toHaveBeenCalled();
  });

  test('does not submit when the shared reason is too short', async () => {
    await render([{ workDate: PAST, adjustmentType: 'CHECK_IN', time: '08:15', enabled: true }], 'ngan');
    const button = container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    await submit();
    expect(createRequest).not.toHaveBeenCalled();
  });

  test('does not submit when no day is selected', async () => {
    await render([{ workDate: PAST, adjustmentType: 'CHECK_IN', time: '08:15', enabled: false }]);
    const button = container.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    await submit();
    expect(createRequest).not.toHaveBeenCalled();
  });
});
