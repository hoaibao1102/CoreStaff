import { createDepartment, getDepartmentById, getDepartments, setDepartmentActive, updateDepartment } from '../src/services/hrService';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));
const base = 'https://api.test';
const department = { _id: 'd1', organizationId: 'org1', code: 'HR', name: 'Nhân sự', active: true };
let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: department }) }));
  globalThis.fetch = fetchMock;
});

test.each([undefined, true, false])('department list preserves optional active=%s', async active => {
  await getDepartments(base, active);
  expect(fetchMock).toHaveBeenCalledWith(`${base}/api/hr/departments${active === undefined ? '' : `?active=${active}`}`, expect.objectContaining({ method: 'GET', credentials: 'include' }));
});

test('create and partial update send only their supplied fields with session cookies', async () => {
  expect(await createDepartment(base, { code: 'HR', name: 'Nhân sự' })).toEqual(department);
  expect(fetchMock).toHaveBeenLastCalledWith(`${base}/api/hr/departments`, expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ code: 'HR', name: 'Nhân sự' }) }));
  await updateDepartment(base, 'd1', { name: 'Nhân sự mới' });
  expect(fetchMock).toHaveBeenLastCalledWith(`${base}/api/hr/departments/d1`, expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Nhân sự mới' }) }));
});

test('detail encodes the id; activation and deactivation send no body', async () => {
  await getDepartmentById(base, 'a/b');
  expect(fetchMock.mock.calls[0][0]).toBe(`${base}/api/hr/departments/a%2Fb`);
  for (const active of [true, false]) {
    await setDepartmentActive(base, 'd1', active);
    const [url, options] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(`${base}/api/hr/departments/d1/${active ? 'activate' : 'deactivate'}`);
    expect(options.method).toBe('PATCH');
    expect(options.credentials).toBe('include');
    expect(options.body).toBeUndefined();
  }
});

test.each([[409, 'DEPARTMENT_CODE_TAKEN'], [404, 'DEPARTMENT_NOT_FOUND'], [403, 'FORBIDDEN']])('preserves HTTP %s and error code for UI feedback', async (status, code) => {
  fetchMock.mockResolvedValue({ ok: false, status, text: async () => JSON.stringify({ success: false, error: { code } }) });
  await expect(getDepartmentById(base, 'd1')).rejects.toMatchObject({ status, code });
});
