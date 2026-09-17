import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/sheet';
import { Skeleton } from '@/components/skeleton';
import { getPositionById, hrErrorMessage, type Position } from '@/services/hrService';

interface PositionDetailSheetProps {
  apiBase: string;
  positionId: string;
  onClose: () => void;
}

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function PositionDetailSheet({ apiBase, positionId, onClose }: PositionDetailSheetProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPosition(null);
    void getPositionById(apiBase, positionId)
      .then(data => { if (!cancelled) setPosition(data); })
      .catch(err => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        setError(status === 404 ? 'Không tìm thấy chức vụ này. Dữ liệu có thể đã được thay đổi.' : hrErrorMessage(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, positionId, revision]);

  return <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="right" className="w-full sm:max-w-lg">
      <SheetHeader className="border-b border-border p-6 pr-16">
        <SheetTitle className="text-xl font-semibold">Chi tiết chức vụ</SheetTitle>
        <SheetDescription>Thông tin và trạng thái hiện tại của chức vụ.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {loading ? <div className="space-y-4" role="status" aria-label="Đang tải chi tiết chức vụ"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-52 w-full" /></div>
          : error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription><Button variant="outline" className="mt-4 min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></Alert>
          : !position ? <div className="py-10 text-center"><p className="font-medium">Không tìm thấy dữ liệu chức vụ.</p></div>
          : <div className="space-y-6">
            <div><h2 className="break-words text-xl font-semibold">{position.name}</h2><Badge variant="secondary" className={`mt-3 ${position.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{position.active ? 'Đang hoạt động' : 'Ngưng hoạt động'}</Badge></div>
            <dl className="space-y-4 rounded-xl border border-border p-4">
              <div><dt className="text-xs text-muted-foreground">Mã chức vụ</dt><dd className="mt-1 break-words font-medium">{position.code}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Tên chức vụ</dt><dd className="mt-1 break-words font-medium">{position.name}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Trạng thái</dt><dd className="mt-1 font-medium">{position.active ? 'Đang hoạt động' : 'Ngưng hoạt động'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Ngày tạo</dt><dd className="mt-1 font-medium">{formatDate(position.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Ngày cập nhật</dt><dd className="mt-1 font-medium">{formatDate(position.updatedAt)}</dd></div>
            </dl>
          </div>}
      </div>
    </SheetContent>
  </Sheet>;
}
