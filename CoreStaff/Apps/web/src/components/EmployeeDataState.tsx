import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import type { DataState } from '../lib/employee';
import { RefreshCw } from 'lucide-react';

interface EmployeeDataStateProps {
  status: DataState<unknown>['status'] | 'empty';
  message?: string;
  description?: string;
  onRetry?: () => void;
}

export function EmployeeDataState({ status, message, description, onRetry }: EmployeeDataStateProps) {
  if (status === 'ready') return null;

  const messages = {
    unavailable: 'Dữ liệu nhân sự chưa khả dụng.',
    loading: 'Đang tải dữ liệu nhân sự…',
    error: message || 'Không thể tải dữ liệu nhân sự. Vui lòng thử lại sau.',
    forbidden: 'Bạn không có quyền xem dữ liệu này.',
    empty: description || 'Chưa có dữ liệu.',
  };

  return (
    <Alert role={status === 'error' || status === 'forbidden' ? 'alert' : 'status'}>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{messages[status]}</span>
        {onRetry && status === 'error' && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Thử lại
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
