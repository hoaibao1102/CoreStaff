/** @jest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Input } from '../src/components/input';
import { formatDateOnlyVN, formatInstantDateTimeVN, formatInstantDateVN, formatVN, formatWeekdayDateVN, parseDateVN } from '../src/lib/datetime';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

function Harness({ initial = '', onValue }: { initial?: string; onValue: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return <label>Ngày<Input type="date" id="d" value={value} onChange={e => { setValue(e.target.value); onValue(e.target.value); }} /></label>;
}

const textInput = () => host.querySelector<HTMLInputElement>('input#d')!;
async function type(text: string) {
  const input = textInput();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('date input shows and accepts dd/mm/yyyy', () => {
  it('displays an ISO value as dd/mm/yyyy', async () => {
    await act(async () => root.render(<Harness initial="2027-02-05" onValue={() => {}} />));
    expect(textInput().value).toBe('05/02/2027');
    expect(textInput().placeholder).toBe('dd/mm/yyyy');
  });

  it('masks typed digits and emits YYYY-MM-DD once the date is complete and real', async () => {
    const seen: string[] = [];
    await act(async () => root.render(<Harness onValue={v => seen.push(v)} />));
    await type('0502');
    expect(textInput().value).toBe('05/02');
    expect(seen).toEqual([]);
    await type('05022027');
    expect(seen).toEqual(['2027-02-05']);
    expect(textInput().value).toBe('05/02/2027');
  });

  it('does not emit an impossible date such as 31/02/2027', async () => {
    const seen: string[] = [];
    await act(async () => root.render(<Harness onValue={v => seen.push(v)} />));
    await type('31022027');
    expect(seen).toEqual([]);
    expect(textInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('clearing the text clears the value', async () => {
    const seen: string[] = [];
    await act(async () => root.render(<Harness initial="2027-02-05" onValue={v => seen.push(v)} />));
    await type('');
    expect(seen).toEqual(['']);
    expect(textInput().value).toBe('');
  });

  it('still accepts an ISO value typed or pasted programmatically', async () => {
    const seen: string[] = [];
    await act(async () => root.render(<Harness onValue={v => seen.push(v)} />));
    await type('2027-03-09');
    expect(seen).toEqual(['2027-03-09']);
    expect(textInput().value).toBe('09/03/2027');
  });

  it('passes min/max to the native picker', async () => {
    await act(async () => root.render(<Input type="date" id="d" value="" min="2027-01-01" max="2027-12-31" onChange={() => {}} />));
    const native = host.querySelector<HTMLInputElement>('input[type=date]')!;
    expect(native.min).toBe('2027-01-01');
    expect(native.max).toBe('2027-12-31');
  });
});

describe('datetime helpers always produce dd/mm/yyyy', () => {
  it('pads day and month', () => {
    expect(formatDateOnlyVN('2027-03-05')).toBe('05/03/2027');
    expect(formatVN('2027-03-05T00:00:00.000Z')).toBe('05/03/2027');
    expect(formatInstantDateVN(new Date('2027-03-04T20:00:00Z'))).toBe('05/03/2027');
  });

  it('puts the time first for date-times, in Vietnam time', () => {
    expect(formatInstantDateTimeVN('2027-03-04T20:05:00Z')).toBe('03:05 05/03/2027');
    expect(formatInstantDateTimeVN('2027-03-04T17:00:00Z')).toBe('00:00 05/03/2027');
  });

  it('adds the weekday without changing the date format', () => {
    expect(formatWeekdayDateVN('2027-02-05')).toBe('Thứ sáu, 05/02/2027');
    expect(formatWeekdayDateVN('2027-02-07')).toBe('Chủ nhật, 07/02/2027');
  });

  it('parses only real dd/mm/yyyy dates', () => {
    expect(parseDateVN('5/2/2027')).toBe('2027-02-05');
    expect(parseDateVN('29/02/2028')).toBe('2028-02-29');
    expect(parseDateVN('29/02/2027')).toBeNull();
    expect(parseDateVN('2027-02-05')).toBeNull();
  });
});
