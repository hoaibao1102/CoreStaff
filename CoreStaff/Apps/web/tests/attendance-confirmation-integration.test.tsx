/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LeaveOvertimeScreen } from '../src/screens/Employee/EmployeeWorkScreens';
jest.mock('../src/config/api',()=>({resolveApiBase:async()=>({base:'base'}),apiUrl:(b:string,p:string)=>b+p}));
jest.mock('../src/services/socket',()=>({getSocket:()=>({on:jest.fn(),off:jest.fn()})}));
jest.mock('../src/components/toast',()=>({toast:{success:jest.fn(),error:jest.fn(),warning:jest.fn()}}));
it('shows server OT preview and blocks filing when attendance is unverified',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 window.history.replaceState(null,'','/app/ot');
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:String(url).includes('/overtime/preview')?{workDate:new Date().toISOString().slice(0,10),calculationContract:'OVERTIME_V2',canFile:false,blockedReasons:['OVERTIME_ATTENDANCE_SOURCE_UNSUPPORTED'],rawEligibleMinutes:127,payableMinutes:120,roundingDroppedMinutes:7,provenance:{checkIn:{source:'CONFIRMED_SCHEDULE'},checkOut:{source:'OBSERVED'}}}:String(url).includes('/schedule')?{scheduled:null}:String(url).includes('confirmation-preview')?{enabled:false}:[]})} as Response));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<LeaveOvertimeScreen/>));
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Tạo yêu cầu'))!.click());
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Chuyển sang OT'))!.click());
  const dialog=document.querySelector('[role=dialog]')!;
  await act(async()=>{await new Promise(r=>setTimeout(r,350));});
  expect(dialog.textContent).toContain('127');
  expect(dialog.textContent).toContain('120');
  expect(dialog.textContent).toContain('7');
  expect(dialog.textContent).toContain('CONFIRMED_SCHEDULE');
  expect(dialog.textContent).toContain('HR');
  expect(dialog.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
 } finally {await act(async()=>root.unmount());host.remove();}
});
it.each(['LEGACY_V1', 'OVERTIME_V2', undefined, 'UNKNOWN'])('only permits explicit supported OT preview contract %s',async(contract)=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 window.history.replaceState(null,'','/app/ot');
 const date=new Date().toISOString().slice(0,10);
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:String(url).includes('/overtime/preview')?{workDate:date,calculationContract:contract,canFile:true,blockedReasons:[],rawEligibleMinutes:120,payableMinutes:120,contextHash:'a'.repeat(64)}:String(url).includes('/schedule')?{workDate:date,scheduled:null}:String(url).includes('confirmation-preview')?{enabled:false}:[]})} as Response));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<LeaveOvertimeScreen/>));
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Tạo yêu cầu'))!.click());
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Chuyển sang OT'))!.click());
  await act(async()=>{await new Promise(r=>setTimeout(r,350));});
  const dialog=document.querySelector('[role=dialog]')!;
  const allowed=contract==='LEGACY_V1'||contract==='OVERTIME_V2';
  expect(dialog.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(!allowed);
  if(allowed){
   const reason=dialog.querySelector('textarea')!;
   await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(reason,'Valid overtime filing reason');reason.dispatchEvent(new Event('input',{bubbles:true}));});
   await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   expect(fetch).toHaveBeenCalledWith('base/api/overtime',expect.objectContaining({body:expect.stringContaining('"previewHash":"'+'a'.repeat(64)+'"')}));
  }
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('selects one suggested VN interval and debounces preview requests',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});window.history.replaceState(null,'','/app/ot');
 const date=new Date().toISOString().slice(0,10);
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:String(url).includes('/schedule')?{workDate:date,scheduled:null,suggestedOvertimeIntervals:[{from:`${date}T10:00:00Z`,to:`${date}T11:35:00Z`,rawEligibleMinutes:95,payableMinutes:90,canFile:true,blockedReasons:[]}]}:String(url).includes('/overtime/preview')?{workDate:date,calculationContract:'OVERTIME_V2',canFile:true,blockedReasons:[],rawEligibleMinutes:95,payableMinutes:90,policy:{id:'policy',version:3,minimumOvertimeMinutes:30,overtimeRoundingMinutes:15}}:String(url).includes('confirmation-preview')?{enabled:false}:[]})} as Response));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<LeaveOvertimeScreen/>));
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Tạo yêu cầu'))!.click());
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Chuyển sang OT'))!.click());
  expect((fetch as jest.Mock).mock.calls.filter(([u])=>String(u).includes('/overtime/preview'))).toHaveLength(0);
  const suggestion=Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('17:00–18:35'))!;
  expect(suggestion.textContent).toContain('95');expect(suggestion.textContent).toContain('90');
  await act(async()=>suggestion.click());
  expect(Array.from(document.querySelectorAll<HTMLInputElement>('input[type=time]')).map(i=>i.value)).toEqual(['17:00','18:35']);
  await act(async()=>{await new Promise(r=>setTimeout(r,350));});
  const calls=(fetch as jest.Mock).mock.calls.filter(([u])=>String(u).includes('/overtime/preview'));
  expect(calls).toHaveLength(1);expect(JSON.parse(calls[0][1].body)).toMatchObject({requestedStart:`${date}T17:00:00+07:00`,requestedEnd:`${date}T18:35:00+07:00`});
  expect(document.querySelector('[role=dialog]')!.textContent).toContain('tối thiểu 30 phút');
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('ignores stale preview responses after editing the OT window',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});window.history.replaceState(null,'','/app/ot');
 const date=new Date().toISOString().slice(0,10);const pending:Array<(value:Response)=>void>=[];
 global.fetch=jest.fn((url)=>String(url).includes('/overtime/preview')?new Promise<Response>(resolve=>pending.push(resolve)):Promise.resolve({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:String(url).includes('/schedule')?{workDate:date,scheduled:null}:String(url).includes('confirmation-preview')?{enabled:false}:[]})} as Response));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const response=(minutes:number)=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{workDate:date,calculationContract:'OVERTIME_V2',canFile:true,blockedReasons:[],rawEligibleMinutes:minutes,payableMinutes:minutes}})} as Response);
 try {
  await act(async()=>root.render(<LeaveOvertimeScreen/>));
  await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Tạo yêu cầu'))!.click());
  await act(async()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.includes('Chuyển sang OT'))!.click());
  await act(async()=>{await new Promise(r=>setTimeout(r,350));});
  const input=document.querySelector<HTMLInputElement>('input[type=time]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'18:30');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
  await act(async()=>{await new Promise(r=>setTimeout(r,350));});
  expect(pending).toHaveLength(2);
  await act(async()=>pending[1](response(90)));
  await act(async()=>pending[0](response(999)));
  expect(document.querySelector('[aria-label="Xem trước OT"]')!.textContent).not.toContain('999');
  expect(document.querySelector('[aria-label="Xem trước OT"]')!.textContent).toContain('90');
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('keeps old deep-link date but replaces manual time fields only after server cutover',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 window.history.replaceState(null,'','/app/ot?type=ATTENDANCE&workDate=2026-09-29&adjustmentType=CHECK_OUT');
 global.fetch=jest.fn(async(url)=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:String(url).includes('preview')?{enabled:true,workDate:'2026-09-29',canSubmit:false,blockedReasons:['PERIOD_REQUIRED']}:[]})} as Response));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<LeaveOvertimeScreen/>));
  const dialog=document.querySelector('[role=dialog]')!;
  expect(dialog.querySelector<HTMLInputElement>('input[type=date]')?.value).toBe('2026-09-29');
  expect(dialog.querySelector('input[type=time]')).toBeNull();
  expect(dialog.textContent).toContain('không xác nhận thời gian OT');
 } finally {await act(async()=>root.unmount());host.remove();}
});
