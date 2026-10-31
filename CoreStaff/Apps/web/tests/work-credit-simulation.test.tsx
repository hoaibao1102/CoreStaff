/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorkCreditSimulationPreview } from '../src/screens/WorkCreditPolicy/WorkCreditSimulationPreview';
let root: Root; let container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(paidLeaveCreditEnabled = true) { await act(async () => root.render(<WorkCreditSimulationPreview halfPercent="50" fullPercent="85" paidLeaveCreditEnabled={paidLeaveCreditEnabled} />)); }
async function input(id: string, value: string) { const el = document.getElementById(id) as HTMLInputElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function select(id: string, value: string) { const el = document.getElementById(id) as HTMLSelectElement; expect(el).not.toBeNull(); await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }); }
it('supports scenario obligations, leave toggling, invalid input and advanced special states', async () => {
  await render(); await select('simulation-obligation', '240');
  await input('simulation-worked', '120'); await input('simulation-leave', '120');
  expect(container.textContent).toContain('FULL_CREDIT');
  await render(false); expect(container.textContent).toContain('HALF_CREDIT');
  await select('simulation-obligation', 'custom'); await input('simulation-custom', '450');
  expect(container.textContent).toContain('S: 450');
  await input('simulation-custom', ''); expect(container.textContent).not.toContain('HALF_CREDIT');
  expect(document.getElementById('simulation-custom')!.getAttribute('aria-invalid')).toBe('true');
  await input('simulation-custom', '450.5'); expect(container.textContent).not.toContain('HALF_CREDIT');
  await select('simulation-obligation', '480');
  await select('simulation-incomplete', 'UNRESOLVED');
  expect(container.textContent).toContain('INCOMPLETE_DAY_BLOCKED'); expect(container.textContent).toContain('Chặn: Có');
  await select('simulation-day-type', 'PUBLIC_HOLIDAY'); expect(container.textContent).toContain('PUBLIC_HOLIDAY');
  await select('simulation-day-type', 'SCHEDULED'); await select('simulation-incomplete', 'COMPLETE');
  await select('simulation-zero', 'true'); expect(container.textContent).toContain('NO_SCHEDULED_OBLIGATION');
  expect(container.textContent).not.toContain('NaN');
});
it('explains blocking in plain language and rejects blank worked minutes without a fabricated result', async () => {
  await render(); await select('simulation-incomplete', 'UNRESOLVED');
  expect(container.textContent).toContain('Ngày chưa hoàn tất; cần xử lý mốc công trước khi xác nhận.');
  await input('simulation-worked', '');
  expect(container.querySelector('[aria-live="polite"]')!.textContent).toContain('Chưa có kết quả');
  expect(document.getElementById('simulation-worked')!.getAttribute('aria-describedby')).toBe('simulation-worked-error');
  expect(container.textContent).not.toContain('INCOMPLETE_DAY_BLOCKED');
});
it('shows no invented integer tier for adjacent decimal thresholds', async () => {
  await act(async () => root.render(<WorkCreditSimulationPreview halfPercent="50" fullPercent="50.1" paidLeaveCreditEnabled />));
  await select('simulation-obligation', 'custom'); await input('simulation-custom', '1');
  expect(container.textContent).toContain('không có khoảng phút nguyên');
});
it('shows read-only simulation with exact ratio, minimum minutes and labelled tiers without network', async () => {
  const fetch = jest.fn(); globalThis.fetch = fetch;
  await render(); await input('simulation-worked', '407');
  expect(container.textContent).toContain('HALF_CREDIT');
  expect(container.textContent).toContain('240–407 phút');
  expect(container.textContent).toContain('408–480 phút');
  expect(container.textContent).toContain(String(407 / 480));
  expect(container.querySelector('[aria-live="polite"]')!.textContent).toContain('0.5');
  expect(container.textContent).toContain('Mô phỏng, không sửa bảng công/lương, không thay thế kết quả kỳ thực tế');
  expect(fetch).not.toHaveBeenCalled();
});
