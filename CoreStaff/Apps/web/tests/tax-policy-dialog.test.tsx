/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TaxPolicyDialog } from '../src/screens/Compensation/TaxPolicyDialog';
import type { TaxPolicy } from '../src/services/hrService';

let root: Root;
let container: HTMLDivElement;
let fetchMock: jest.Mock;

const policy: TaxPolicy = {
  _id: 'policy-1',
  organizationId: 'org-1',
  effectiveFrom: '2026-01-01',
  personalDeduction: 15_500_000,
  standardDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  progressiveBrackets: [
    { upperLimit: 10_000_000, rate: 5 },
    { upperLimit: null, rate: 35 },
  ],
  roundingRule: 'ROUND_HALF_UP_TO_VND',
  legalReference: 'Luật Thuế TNCN',
  version: 1,
  active: true,
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data: policy }),
  }));
  globalThis.fetch = fetchMock;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderDialog(editItem: TaxPolicy | null) {
  await act(async () => {
    root.render(
      <TaxPolicyDialog
        apiBase="http://api.test"
        open
        onOpenChange={() => undefined}
        editItem={editItem}
        onSuccess={() => undefined}
      />,
    );
  });
}

async function submit(label: string) {
  const button = [...document.body.querySelectorAll('button')].find(item => item.textContent?.includes(label));
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

test.each([
  { editItem: null, method: 'POST', label: 'Tạo chính sách' },
  { editItem: policy, method: 'PATCH', label: 'Lưu thay đổi' },
])('sends standardDeduction for $method tax policy requests', async ({ editItem, method, label }) => {
  await renderDialog(editItem);
  await submit(label);

  const request = fetchMock.mock.calls.find(([, init]) => init?.method === method);
  expect(request).toBeDefined();
  const body = JSON.parse(String(request![1].body));
  expect(body.standardDeduction).toBe(15_500_000);
  expect(body.personalDeduction).toBe(15_500_000);
  expect(body.progressiveBrackets.at(-1).upperLimit).toBeNull();
});
