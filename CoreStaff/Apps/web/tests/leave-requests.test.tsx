import {
  applyLeaveRequest,
  approveLeaveRequest,
  createLeaveRequest,
  getMyLeaveRequest,
  listEmployeeDayOverrides,
  listHrLeaveRequests,
  listManagerLeaveRequests,
  listMyLeaveRequests,
  rebuildDayClassifications,
  rejectLeaveRequest,
} from '../src/services/leave.service';

jest.mock('../src/config/api',()=>({apiUrl:(base:string,path:string)=>base+path}));

const base='https://api.test';
let fetchMock:jest.Mock;

beforeEach(()=>{
  fetchMock=jest.fn(async()=>({ok:true,status:200,text:async()=>JSON.stringify({success:true,data:[]})}));
  globalThis.fetch=fetchMock;
});

test('employee creates and lists their own leave requests',async()=>{
  const payload={
    startDate:'2026-10-01',
    endDate:'2026-10-02',
    leaveType:'PAID_LEAVE' as const,
    reason:'Nghỉ việc gia đình',
  };

  await createLeaveRequest(base,payload);
  expect(fetchMock).toHaveBeenLastCalledWith(
    `${base}/api/leave-requests`,
    expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify(payload)}),
  );

  await listMyLeaveRequests(base);
  expect(fetchMock.mock.calls[1][0]).toBe(`${base}/api/leave-requests/mine`);
});

test('employee detail encodes the leave request id',async()=>{
  await getMyLeaveRequest(base,'leave/a b');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/leave-requests/mine/leave%2Fa%20b`);
});

test('manager queue preserves status and department scope',async()=>{
  await listManagerLeaveRequests(base,'PENDING_MANAGER','department/a');
  expect(fetchMock.mock.calls[0][0]).toBe(
    `${base}/api/manager/leave-requests?status=PENDING_MANAGER&departmentId=department%2Fa`,
  );
});

test('manager approves a request without a request body',async()=>{
  await approveLeaveRequest(base,'leave/a');
  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/manager/leave-requests/leave%2Fa/approve`,
    expect.objectContaining({method:'POST',credentials:'include'}),
  );
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
});

test('manager rejection sends the review reason',async()=>{
  await rejectLeaveRequest(base,'leave/a','Không đủ nhân sự thay thế');
  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/manager/leave-requests/leave%2Fa/reject`,
    expect.objectContaining({
      method:'POST',
      credentials:'include',
      body:JSON.stringify({reason:'Không đủ nhân sự thay thế'}),
    }),
  );
});

test('HR queue and override verification preserve filters',async()=>{
  await listHrLeaveRequests(base,'APPROVED');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/leave-requests?status=APPROVED`);

  await listEmployeeDayOverrides(base,{employeeId:'employee/a',from:'2026-10-01',to:'2026-10-03'});
  expect(fetchMock.mock.calls[1][0]).toBe(
    `${base}/api/hr/employee-day-overrides?employeeId=employee%2Fa&from=2026-10-01&to=2026-10-03`,
  );
});

test('HR apply uses the encoded request id without a request body',async()=>{
  await applyLeaveRequest(base,'leave/a');
  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/hr/leave-requests/leave%2Fa/apply`,
    expect.objectContaining({method:'POST',credentials:'include'}),
  );
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
});

test('HR rebuild sends a bounded day-classification request',async()=>{
  const payload={from:'2026-10-01',to:'2026-10-31',employeeId:'employee-1'};
  await rebuildDayClassifications(base,payload);
  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/hr/day-classifications/rebuild`,
    expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify(payload)}),
  );
});
