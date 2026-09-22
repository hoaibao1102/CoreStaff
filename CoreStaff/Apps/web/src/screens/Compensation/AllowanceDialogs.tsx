import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import {
  createOrganizationAllowance,
  getAllowanceCatalog,
  updateOrganizationAllowance,
  type AllowanceCatalogItem,
  type CreateAllowancePayload,
  type OrganizationAllowance,
  type UpdateAllowancePayload,
} from '@/services/compensation.service';
import { hrErrorMessage } from '@/services/hrService';

// ───────── Create Allowance Dialog ─────────

export function AllowanceCreateDialog({
  apiBase,
  open,
  onClose,
  onCreated,
}: {
  apiBase: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [catalogItems, setCatalogItems] = useState<AllowanceCatalogItem[]>([]);
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');

  const [catalogId, setCatalogId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taxable, setTaxable] = useState(false);
  const [insuranceBased, setInsuranceBased] = useState(false);
  const [prorated, setProrated] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    getAllowanceCatalog(apiBase)
      .then(setCatalogItems)
      .catch(err => setError(hrErrorMessage(err)));
  }, [apiBase, open]);

  // When catalog item is selected, auto-fill defaults
  const handleCatalogSelect = (id: string | null) => {
    const val = id ?? '';
    setCatalogId(val);
    const selected = catalogItems.find(x => x._id === val);
    if (selected) {
      setCode(selected.code);
      setName(selected.defaultName);
      setDescription(selected.description || '');
      setTaxable(selected.defaultTaxable);
      setInsuranceBased(selected.defaultInsuranceBased);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'custom' && (!code.trim() || !name.trim())) {
      return setError('Vui lòng nhập mã và tên phụ cấp tùy chỉnh.');
    }
    if (!effectiveFrom) return setError('Vui lòng chọn ngày hiệu lực.');

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateAllowancePayload = {
        catalogId: mode === 'catalog' ? catalogId || undefined : undefined,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        amount: 0,
        taxable,
        insuranceBased,
        prorated,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      };
      await createOrganizationAllowance(apiBase, payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>Tạo phụ cấp tổ chức mới</DialogTitle>
          <DialogDescription className="mt-1">Bổ sung khoản phụ cấp vào danh mục chính sách của tổ chức (TASK-033).</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex rounded-lg border border-border p-1 bg-muted/30 text-xs font-medium">
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'catalog' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setMode('catalog')}
              >
                Sử dụng danh mục chuẩn
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setMode('custom')}
              >
                Tạo phụ cấp tùy chỉnh
              </button>
            </div>

            {mode === 'catalog' ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Chọn phụ cấp từ danh mục chuẩn <span className="text-red-500">*</span></label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={catalogId}
                  onChange={e => handleCatalogSelect(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Chọn phụ cấp mẫu…</option>
                  {catalogItems.map(item => (
                    <option key={item._id} value={item._id}>
                      [{item.code}] {item.defaultName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Mã phụ cấp <span className="text-red-500">*</span></label>
                  <Input placeholder="VD: PARKING" value={code} onChange={e => setCode(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tên phụ cấp <span className="text-red-500">*</span></label>
                  <Input placeholder="Phụ cấp gửi xe" value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mô tả mục phụ cấp (tùy chọn)</label>
              <Input
                placeholder="VD: Hỗ trợ chi phí đi lại xăng xe theo vị trí công tác..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <span className="inline-block size-1.5 rounded-full bg-primary" />
                Mức tiền phụ cấp sẽ được HR gán cụ thể cho từng nhân viên theo chức danh hoặc thỏa thuận trong Hồ sơ lương.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày bắt đầu hiệu lực <span className="text-red-500">*</span></label>
                <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày kết thúc (tùy chọn)</label>
                <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quy tắc tính toán</span>
              <div className="space-y-2 pt-1">
                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${taxable ? 'bg-purple-50/60 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={taxable} onChange={e => setTaxable(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính vào thu nhập chịu thuế PIT</div>
                    <div className="text-[11px] text-muted-foreground">Khoản phụ cấp này sẽ được cộng vào tổng thu nhập trước thuế khi tính thuế TNCN</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${insuranceBased ? 'bg-blue-50/60 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={insuranceBased} onChange={e => setInsuranceBased(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính vào căn cứ đóng BHXH</div>
                    <div className="text-[11px] text-muted-foreground">Khoản phụ cấp này được tính vào mức lương đóng BHXH bắt buộc</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${prorated ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={prorated} onChange={e => setProrated(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính theo ngày công thực tế (Prorated)</div>
                    <div className="text-[11px] text-muted-foreground">Được tính tỉ lệ theo số ngày đi làm thực tế trong tháng thay vì trả cố định toàn bộ</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Tạo phụ cấp'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Edit Allowance Dialog ─────────

export function AllowanceEditDialog({
  apiBase,
  allowance,
  open,
  onClose,
  onUpdated,
}: {
  apiBase: string;
  allowance: OrganizationAllowance;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [code, setCode] = useState(allowance.code);
  const [name, setName] = useState(allowance.name);
  const [description, setDescription] = useState(allowance.description || '');
  const [taxable, setTaxable] = useState(allowance.taxable);
  const [insuranceBased, setInsuranceBased] = useState(allowance.insuranceBased);
  const [prorated, setProrated] = useState(allowance.prorated);
  const [effectiveFrom, setEffectiveFrom] = useState(allowance.effectiveFrom ? allowance.effectiveFrom.split('T')[0] : '');
  const [effectiveTo, setEffectiveTo] = useState(allowance.effectiveTo ? allowance.effectiveTo.split('T')[0] : '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const payload: UpdateAllowancePayload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        taxable,
        insuranceBased,
        prorated,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || null,
      };
      await updateOrganizationAllowance(apiBase, allowance._id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <div className="flex items-center gap-2">
            <DialogTitle>Chỉnh sửa phụ cấp</DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">{allowance.code}</Badge>
            <Badge variant="secondary" className="text-[11px]">v{allowance.version}</Badge>
          </div>
          <DialogDescription className="mt-1">Cập nhật thông tin và các quy tắc khấu trừ/tính thuế của phụ cấp.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 max-h-[calc(85vh-130px)]">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mã phụ cấp</label>
                <Input value={code} disabled className="bg-muted font-mono font-semibold text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tên phụ cấp <span className="text-red-500">*</span></label>
                <Input value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mô tả mục phụ cấp (tùy chọn)</label>
              <Input
                placeholder="VD: Hỗ trợ cước viễn thông liên lạc phục vụ công việc..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <span className="inline-block size-1.5 rounded-full bg-primary" />
                Mức tiền phụ cấp sẽ được HR điều chỉnh riêng theo từng nhân sự trong Hồ sơ lương.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày bắt đầu hiệu lực <span className="text-red-500">*</span></label>
                <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ngày kết thúc</label>
                <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} disabled={submitting} placeholder="Để trống nếu vô hạn" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quy tắc tính toán</span>
              <div className="space-y-2 pt-1">
                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${taxable ? 'bg-purple-50/60 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={taxable} onChange={e => setTaxable(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính vào thu nhập chịu thuế PIT</div>
                    <div className="text-[11px] text-muted-foreground">Khoản phụ cấp này sẽ được cộng vào tổng thu nhập trước thuế khi tính thuế TNCN</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${insuranceBased ? 'bg-blue-50/60 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={insuranceBased} onChange={e => setInsuranceBased(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính vào căn cứ đóng BHXH</div>
                    <div className="text-[11px] text-muted-foreground">Khoản phụ cấp này được tính vào mức lương đóng BHXH bắt buộc</div>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${prorated ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' : 'bg-card border-border hover:bg-muted/40'}`}>
                  <input type="checkbox" checked={prorated} onChange={e => setProrated(e.target.checked)} className="rounded border-input text-primary focus:ring-primary h-4 w-4 mt-0.5" disabled={submitting} />
                  <div>
                    <div className="text-xs font-semibold text-foreground">Tính theo ngày công thực tế (Prorated)</div>
                    <div className="text-[11px] text-muted-foreground">Được tính tỉ lệ theo số ngày đi làm thực tế trong tháng thay vì trả cố định toàn bộ</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Hủy</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Đang lưu…' : 'Cập nhật phụ cấp'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
