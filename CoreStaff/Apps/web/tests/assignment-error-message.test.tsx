import { assignmentErrorMessage, isWorkingEmployee, todayIso } from '../src/services/assignment.service';

jest.mock('../src/config/api', () => ({ apiUrl: (base: string, path: string) => base + path }));

const apiError = (message: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { status: 400, code: 'VALIDATION_ERROR', ...extra });

describe('assignmentErrorMessage', () => {
  it('shows the specific Vietnamese detail the API sends, not a generic text', () => {
    const message = 'userId: EMPLOYEE_NOT_WORKING: Nhân viên Trần B (NV002) đang ở trạng thái "Đã nghỉ việc" nên không thể phân công.';
    expect(assignmentErrorMessage(apiError(message))).toBe('Nhân viên Trần B (NV002) đang ở trạng thái "Đã nghỉ việc" nên không thể phân công.');
  });

  it('keeps every problem when the API reports several at once', () => {
    const message = 'effectiveFrom: EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST: Ngày bắt đầu (2020-01-01) đã qua.; userId: EMPLOYEE_NOT_WORKING: Nhân viên A đã nghỉ việc.';
    const text = assignmentErrorMessage(apiError(message));
    expect(text).toContain('Ngày bắt đầu (01/01/2020) đã qua.');
    expect(text).toContain('Nhân viên A đã nghỉ việc.');
  });

  it('reads class-validator details', () => {
    const error = apiError('Bad Request', { details: ['Ngày bắt đầu (effectiveFrom) phải đúng định dạng YYYY-MM-DD.'] });
    expect(assignmentErrorMessage(error)).toBe('Ngày bắt đầu (effectiveFrom) phải đúng định dạng YYYY-MM-DD.');
  });

  it('maps a bare code to a specific sentence', () => {
    expect(assignmentErrorMessage(apiError('EFFECTIVE_FROM_CANNOT_BE_IN_THE_PAST'))).toContain('từ hôm nay trở đi');
  });

  it('gives a distinct message for server errors and lost connectivity', () => {
    expect(assignmentErrorMessage(Object.assign(new Error('x'), { status: 500, code: 'INTERNAL_ERROR' }))).toContain('INTERNAL_ERROR');
    expect(assignmentErrorMessage(new Error('Failed to fetch'))).toContain('Không kết nối được máy chủ');
  });
});

describe('assignment helpers', () => {
  it('only PROBATION, ACTIVE and ON_LEAVE are working', () => {
    expect(['PROBATION', 'ACTIVE', 'ON_LEAVE'].every(isWorkingEmployee)).toBe(true);
    expect(isWorkingEmployee('RESIGNED')).toBe(false);
    expect(isWorkingEmployee('TERMINATED')).toBe(false);
    expect(isWorkingEmployee(undefined)).toBe(false);
  });

  it('todayIso is a YYYY-MM-DD date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
