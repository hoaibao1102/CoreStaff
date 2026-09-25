import { createCalendarException, deleteCalendarException, listCalendarExceptions, updateCalendarException } from '../src/services/scheduling.service';

jest.mock('../src/config/api',()=>({apiUrl:(base:string,path:string)=>base+path}));
const base='https://api.test';
let fetchMock:jest.Mock;
beforeEach(()=>{fetchMock=jest.fn(async()=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:[]})}));globalThis.fetch=fetchMock});

test('list sends the selected year range',async()=>{
  await listCalendarExceptions(base,'2026-01-01','2026-12-31');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/calendar-exceptions?from=2026-01-01&to=2026-12-31`);
});

test('create sends holiday fields',async()=>{
  const payload={date:'2026-09-02',type:'PUBLIC_HOLIDAY' as const,name:'Quốc khánh'};
  await createCalendarException(base,payload);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/calendar-exceptions`,expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify(payload)}));
});

test('edit supports changing a holiday into a special working day',async()=>{
  const payload={type:'SPECIAL_WORKING_DAY' as const,name:'Làm bù'};
  await updateCalendarException(base,'c1',payload);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/calendar-exceptions/c1`,expect.objectContaining({method:'PATCH',body:JSON.stringify(payload)}));
});

test('delete uses encoded id and no request body',async()=>{
  await deleteCalendarException(base,'a/b');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/calendar-exceptions/a%2Fb`);
  expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({method:'DELETE',credentials:'include'}));
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
});
