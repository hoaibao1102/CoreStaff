import { PayslipDetailPage } from '@/screens/hr/PayslipPreviewDialog';

/**
 * Phiếu lương của chính nhân viên. Toàn bộ bố cục nằm ở `PayslipDetailPage`
 * để trang HR dùng lại đúng một bản — sửa một chỗ, hai nơi cùng đổi.
 */
export function PayslipDetailScreen({ apiBase, payslipId }: { apiBase?: string; payslipId: string }) {
  return <PayslipDetailPage apiBase={apiBase} payslipId={payslipId} mode="employee" />;
}
