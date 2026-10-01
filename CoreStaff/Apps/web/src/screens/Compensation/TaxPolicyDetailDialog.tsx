import { X } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Separator } from '@/components/separator';
import type { TaxPolicy } from '@/services/hrService';
import { formatVnd } from './format';

function formatDate(iso?: string | null): string {
  if (!iso) return 'Hiện tại';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

export function TaxPolicyDetailDialog({
  policy,
  open,
  onClose,
}: {
  policy: TaxPolicy | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!policy) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Chi tiết chính sách thuế TNCN</DialogTitle>
          <DialogDescription className="mt-1">
            {policy.legalReference} — Phiên bản v{policy.version}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5 max-h-[calc(90vh-150px)]">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Thông tin chính sách</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Ngày hiệu lực</dt>
                <dd className="text-sm font-medium">{formatDate(policy.effectiveFrom)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Ngày hết hạn</dt>
                <dd className="text-sm font-medium">{formatDate(policy.effectiveTo)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Giảm trừ bản thân</dt>
                <dd className="text-sm font-medium">{formatVnd(policy.personalDeduction)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Giảm trừ phụ thuộc</dt>
                <dd className="text-sm font-medium">{formatVnd(policy.dependentDeduction)}</dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Văn bản pháp lý</dt>
                <dd className="text-sm font-medium">{policy.legalReference}</dd>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tax Brackets */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Biểu thuế lũy tiến ({policy.progressiveBrackets?.length ?? 0} bậc)</h3>
            {policy.progressiveBrackets && policy.progressiveBrackets.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Ngưỡng trên (VND)</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Thuế suất (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policy.progressiveBrackets.map((b, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 tabular-nums">{b.upperLimit == null ? 'Không giới hạn' : formatVnd(b.upperLimit)}</td>
                        <td className="px-4 py-2 tabular-nums">{b.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có bậc thuế.</p>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-2 text-xs text-muted-foreground">
            {policy.createdAt && (
              <div>Tạo lúc: {new Date(policy.createdAt).toLocaleString('vi-VN')}</div>
            )}
            {policy.updatedAt && (
              <div>Cập nhật lúc: {new Date(policy.updatedAt).toLocaleString('vi-VN')}</div>
            )}
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
