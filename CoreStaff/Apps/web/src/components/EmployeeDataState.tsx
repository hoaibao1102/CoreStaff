import { Alert, AlertDescription } from './alert';
import type { DataState } from '../lib/employee';
export function EmployeeDataState({ status }: { status: DataState<unknown>['status'] }) {
  if (status === 'ready') return null;
  const messages = {
    unavailable: 'Dữ liệu nhân sự chưa khả dụng.',
    loading: 'Đang tải dữ liệu nhân sự…',
    error: 'Không thể tải dữ liệu nhân sự. Vui lòng thử lại sau.',
    forbidden: 'Bạn không có quyền xem dữ liệu này.',
  };
  return <Alert role={status === 'error' || status === 'forbidden' ? 'alert' : 'status'}>
    <AlertDescription>{messages[status]}</AlertDescription>
  </Alert>;
}
