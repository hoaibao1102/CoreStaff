import { addDependent, updateDependent } from '../src/services/hrService';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));

const base = 'https://api.test';
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data: { _id: 'dep1', fullName: 'Nguyễn Văn A' } }),
  }));
  globalThis.fetch = fetchMock;
});

test('creates a dependent with the current API contract for a probation employee', async () => {
  await addDependent(base, 'profile-probation', {
    fullName: 'Nguyễn Văn A',
    dateOfBirth: '2015-05-10',
    relationship: 'CHILD',
    isDisabled: false,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/hr/employees/profile-probation/dependents`,
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Nguyễn Văn A',
        dateOfBirth: '2015-05-10',
        relationship: 'CHILD',
        isDisabled: false,
      }),
    }),
  );
});

test('updates a dependent by dependent id with the current API contract', async () => {
  await updateDependent(base, 'dep1', {
    fullName: 'Nguyễn Văn A Updated',
    dateOfBirth: '2015-05-10',
    relationship: 'CHILD',
    isDisabled: false,
    status: 'ACTIVE',
  });

  expect(fetchMock).toHaveBeenCalledWith(
    `${base}/api/hr/dependents/dep1`,
    expect.objectContaining({ method: 'PUT' }),
  );
});
