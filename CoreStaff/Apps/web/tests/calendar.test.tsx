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

import { calendarRangeDays, createCalendarRange, deleteCalendarRange, groupCalendarRuns, updateCalendarRange } from '../src/services/scheduling.service';

test('create range sends one request for all adjacent days',async()=>{
  const payload={startDate:'2027-02-05',endDate:'2027-02-09',type:'PUBLIC_HOLIDAY' as const,name:'Tết Nguyên đán'};
  await createCalendarRange(base,payload);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/calendar-exceptions/range`,expect.objectContaining({method:'POST',body:JSON.stringify(payload)}));
});

test('update range sends the original range with the new one',async()=>{
  const payload={startDate:'2027-02-05',endDate:'2027-02-11',type:'PUBLIC_HOLIDAY' as const,name:'Tết',originalFrom:'2027-02-05',originalTo:'2027-02-09'};
  await updateCalendarRange(base,payload);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/calendar-exceptions/range`,expect.objectContaining({method:'PUT',body:JSON.stringify(payload)}));
});

test('delete range passes from and to',async()=>{
  await deleteCalendarRange(base,'2027-02-05','2027-02-09');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/calendar-exceptions/range?from=2027-02-05&to=2027-02-09`);
  expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({method:'DELETE'}));
});

test('calendarRangeDays lists every day inclusively and rejects reversed ranges',()=>{
  expect(calendarRangeDays('2027-02-27','2027-03-02')).toEqual(['2027-02-27','2027-02-28','2027-03-01','2027-03-02']);
  expect(calendarRangeDays('2027-02-05','2027-02-05')).toEqual(['2027-02-05']);
  expect(calendarRangeDays('2027-02-06','2027-02-05')).toEqual([]);
});

test('groupCalendarRuns folds adjacent days with the same type and name',()=>{
  const row=(id:string,date:string,name='Tết',type:'PUBLIC_HOLIDAY'|'SPECIAL_WORKING_DAY'='PUBLIC_HOLIDAY')=>({_id:id,date,type,name});
  const runs=groupCalendarRuns([
    row('3','2027-02-07'),row('1','2027-02-05'),row('2','2027-02-06'),   // unsorted on purpose
    row('4','2027-02-09'),                                               // gap -> separate run
    row('5','2027-02-10','Làm bù','SPECIAL_WORKING_DAY'),               // adjacent but different type/name
    row('6','2027-03-01','Tết'),
  ]);
  expect(runs.map(r=>[r.date,r.endDate,r.days,r.name])).toEqual([
    ['2027-02-05','2027-02-07',3,'Tết'],
    ['2027-02-09','2027-02-09',1,'Tết'],
    ['2027-02-10','2027-02-10',1,'Làm bù'],
    ['2027-03-01','2027-03-01',1,'Tết'],
  ]);
  expect(runs[0]._id).toBe('1');
});
