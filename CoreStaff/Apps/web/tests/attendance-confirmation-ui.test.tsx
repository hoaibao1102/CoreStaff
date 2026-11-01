/** @jest-environment jsdom */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as ui from '../src/screens/Employee/AttendanceConfirmationForm';
jest.mock('../src/services/hrService', () => ({ hrRequest: jest.fn() }));
import { hrRequest } from '../src/services/hrService';
const api = ui as any;
describe('confirmation preview UI', () => {
 let host: HTMLDivElement; let root: Root;
 beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host=document.createElement('div'); document.body.append(host); root=createRoot(host); jest.resetAllMocks(); Object.defineProperty(crypto, 'randomUUID', { configurable:true, value: () => 'test-key' }); });
 afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
 it('shows safe preview, no editable times, and blocks submission until a valid reason', async () => {
  (hrRequest as jest.Mock).mockResolvedValue({ enabled:true, workDate:'2026-10-29', canSubmit:true, actionType:'CHECK_OUT', previewHash:'h', blockedReasons:[], existingPunches:{checkInAt:'2026-10-29T01:00:00Z'}, proposedChanges:{checkOutAt:'2026-10-29T10:00:00Z'}, quota:{monthKey:'2026-10',usedSlots:1,limit:3,remaining:2}, period:{status:'OPEN',canMutate:true} });
  await act(async () => root.render(<api.AttendanceConfirmationForm apiBase="base" workDate="2026-10-29" onDateChange={()=>{}} onCreated={()=>{}} legacy={<p>Legacy</p>} />));
  expect(host.textContent).toContain('không xác nhận thời gian OT');
  expect(host.textContent).toContain('2026-10');
  expect(host.textContent).toContain('17:00');
  expect(host.querySelector('input[type=time]')).toBeNull();
  expect(host.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
 });
 it('drops old-date responses and never allows unknown/loading/error previews to submit', async () => {
  let resolveOld!: (p:any)=>void;
  (hrRequest as jest.Mock).mockImplementationOnce(()=>new Promise(r=>{resolveOld=r;})).mockResolvedValue({enabled:true,workDate:'2026-10-28',canSubmit:false,blockedReasons:['PERIOD_REQUIRED']});
  const render=(date:string)=>root.render(<api.AttendanceConfirmationForm apiBase="base" workDate={date} onDateChange={()=>{}} onCreated={()=>{}} legacy={<p>Legacy</p>} />);
  await act(async()=>render('2026-10-29'));
  expect(host.textContent).not.toContain('Legacy');
  await act(async()=>render('2026-10-28'));
  await act(async()=>resolveOld({enabled:true,workDate:'2026-10-29',canSubmit:true,blockedReasons:[]}));
  expect(host.textContent).toContain('HR');
  expect(host.textContent).not.toContain('Legacy');
  expect(host.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
 });
 it('submits trimmed reason with server hash and retains identity on retry, invalidates stale preview', async () => {
  const preview={enabled:true,workDate:'2026-10-29',canSubmit:true,actionType:'CHECK_OUT',previewHash:'h',blockedReasons:[]};
  (hrRequest as jest.Mock).mockResolvedValueOnce(preview).mockRejectedValueOnce(Object.assign(new Error('network'),{code:'NETWORK'})).mockRejectedValueOnce(Object.assign(new Error('stale'),{code:'ATTENDANCE_CONFIRMATION_STALE'}));
  await act(async()=>root.render(<api.AttendanceConfirmationForm apiBase="base" workDate="2026-10-29" onDateChange={()=>{}} onCreated={()=>{}} legacy={null}/>));
  const textarea=host.querySelector('textarea')!;
  expect(textarea).not.toBeNull();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'  Quên chấm công hôm qua  '); textarea.dispatchEvent(new Event('input',{bubbles:true}));});
  const form=host.querySelector('form')!;
  await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  const calls=(hrRequest as jest.Mock).mock.calls.filter(c=>c[2].method==='POST');
  expect(calls).toHaveLength(2);
  expect(calls[0][2].headers['Idempotency-Key']).toBe(calls[1][2].headers['Idempotency-Key']);
  expect(JSON.parse(calls[0][2].body).reason).toBe('Quên chấm công hôm qua');
  expect(host.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
  expect(host.textContent).toContain('Dữ liệu đã thay đổi');
 });
 it('does not silently fall back to editable legacy times when enablement is absent', async () => {
  expect(typeof api.AttendanceConfirmationForm).toBe('function');
  (hrRequest as jest.Mock).mockResolvedValue({ workDate:'2026-10-29', canSubmit:true, blockedReasons:[] });
  await act(async () => root.render(<api.AttendanceConfirmationForm apiBase="base" workDate="2026-10-29" onDateChange={()=>{}} onCreated={()=>{}} legacy={<p>Legacy form</p>} />));
  expect(host.textContent).not.toContain('Legacy form');
  expect(host.querySelector('[role=alert]')).not.toBeNull();
 });
 it('renders HH:mm obligations and rejects malformed dates without Invalid Date', async () => {
  expect(api.confirmationTime('08:00')).toBe('08:00');
  expect(api.confirmationTime('not-a-date')).toBe('Không xác định');
  expect(api.confirmationTime('25:00')).toBe('Không xác định');
  await act(async()=>root.render(<api.ConfirmationSummary preview={{workDate:'2026-10-29',blockedReasons:[],existingPunches:{checkInProvenance:{source:'SELFIE'}},obligation:{requiredWorkingIntervals:[{from:'08:00',to:'12:00'}]}}}/>));
  expect(host.textContent).toContain('08:00 → 12:00');
  expect(host.textContent).toContain('SELFIE');
  expect(host.textContent).not.toContain('Invalid Date');
 });
 it.each([404,409,500])('never selects legacy merely because preview returned HTTP %s', async status => {
  (hrRequest as jest.Mock).mockRejectedValue(Object.assign(new Error('preview unavailable'),{status}));
  await act(async()=>root.render(<api.AttendanceConfirmationForm apiBase="base" workDate="2026-10-29" onDateChange={()=>{}} onCreated={()=>{}} legacy={<p>Legacy form</p>}/>));
  expect(host.textContent).not.toContain('Legacy form');
  expect(host.querySelector('[role=alert]')).not.toBeNull();
 });
 it('preserves legacy only when server explicitly disables the feature', async () => {
  (hrRequest as jest.Mock).mockResolvedValue({enabled:false});
  await act(async()=>root.render(<api.AttendanceConfirmationForm apiBase="base" workDate="2026-10-29" onDateChange={()=>{}} onCreated={()=>{}} legacy={<p>Legacy form</p>}/>));
  expect(host.textContent).toContain('Legacy form');
 });
});
