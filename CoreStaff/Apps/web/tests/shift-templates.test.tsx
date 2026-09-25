import { activateShiftTemplate, createShiftTemplate, deactivateShiftTemplate, deleteShiftTemplate, getShiftTemplateById, getShiftTemplates, shiftTemplateErrorMessage, updateShiftTemplate } from '../src/services/shift-template.service';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
const base = 'https://api.test';
test('shows actual hours, policy limit and excess for a daily violation',()=>{
  const message=shiftTemplateErrorMessage({code:'SHIFT_DAILY_LABOR_LIMIT_EXCEEDED',details:{usedMinutes:570,limitMinutes:480}});
  expect(message).toContain('9 tiếng 30 phút');
  expect(message).toContain('vượt quá 1 tiếng 30 phút');
  expect(message).toContain('giới hạn 8 tiếng');
});
const shift = { _id:'s1', organizationId:'org1', scope:'DEPARTMENT', departmentId:'d1', weekdays:[1,2,3,4,5], effectiveFrom:'2026-10-01', code:'OFFICE-01', name:'Ca hành chính', startTime:'08:00', endTime:'17:00', breakMinutes:60, gracePeriodMinutes:5, active:true };
let fetchMock: jest.Mock;

beforeEach(()=>{
  fetchMock=jest.fn(async()=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:shift})}));
  globalThis.fetch=fetchMock;
});

test('list preserves scope, department and active filters',async()=>{
  await getShiftTemplates(base,{scope:'DEPARTMENT',departmentId:'d1',active:true});
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/shift-templates?scope=DEPARTMENT&departmentId=d1&active=true`);
});

test('create sends code, name and configured time values',async()=>{
  const payload={scope:'DEPARTMENT' as const,departmentId:'d1',weekdays:[1,2,3,4,5],effectiveFrom:'2026-10-01',code:'OFFICE-01',name:'Ca hành chính',startTime:'08:00',endTime:'17:00',breakMinutes:60,gracePeriodMinutes:5};
  await createShiftTemplate(base,payload);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/shift-templates`,expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify(payload)}));
});

test('detail encodes id and update remains partial',async()=>{
  await getShiftTemplateById(base,'a/b');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/shift-templates/a%2Fb`);
  await updateShiftTemplate(base,'s1',{name:'Ca văn phòng mới'});
  expect(fetchMock).toHaveBeenLastCalledWith(`${base}/api/hr/shift-templates/s1`,expect.objectContaining({method:'PATCH',body:JSON.stringify({name:'Ca văn phòng mới'})}));
});

test('activate and deactivate call role-protected endpoints without a body',async()=>{
  await activateShiftTemplate(base,'s1');
  await deactivateShiftTemplate(base,'s1');
  expect(fetchMock.mock.calls.at(-2)?.[0]).toBe(`${base}/api/hr/shift-templates/s1/activate`);
  expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${base}/api/hr/shift-templates/s1/deactivate`);
  expect(fetchMock.mock.calls.at(-1)?.[1].body).toBeUndefined();
});

test('delete calls the permanent-delete endpoint',async()=>{
  await deleteShiftTemplate(base,'s1');
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/shift-templates/s1`,expect.objectContaining({method:'DELETE'}));
});

test('maps duplicate code to an actionable Vietnamese message',()=>{
  expect(shiftTemplateErrorMessage(Object.assign(new Error(),{code:'SHIFT_TEMPLATE_CODE_TAKEN'}))).toContain('Mã ca đã tồn tại');
});
