import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Input } from '@/components/input';
import { Label } from '@/components/label';
import { Separator } from '@/components/separator';
import {
  createTaxPolicy,
  updateTaxPolicy,
  type TaxPolicy,
} from '@/services/hrService';
import { hrErrorMessage } from '@/services/hrService';
import { formatVnd } from './format';

const BRACKET_DEFAULTS = [
  { upperLimit: 10000000, rate: 5 },
  { upperLimit: 30000000, rate: 10 },
  { upperLimit: 60000000, rate: 20 },
  { upperLimit: 100000000, rate: 30 },
  { upperLimit: null, rate: 35 },
];

// ───────── Create/Edit Policy Dialog ─────────

export function TaxPolicyDialog({
  apiBase,
  open,
  onOpenChange,
  editItem,
  onSuccess,
}: {
  apiBase: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: TaxPolicy | null;
  onSuccess: () => void;
}) {
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [personalDeduction, setPersonalDeduction] = useState('15500000');
  const [dependentDeduction, setDependentDeduction] = useState('6200000');
  const [brackets, setBrackets] = useState(BRACKET_DEFAULTS.map(b => ({ ...b })));
  const [legalReference, setLegalReference] = useState('Luật Thuế TNCN 2007/QH12');
  const [roundingRule, setRoundingRule] = useState('ROUND_HALF_UP_TO_VND');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);

    // If editing, populate form
    if (editItem) {
      setEffectiveFrom(editItem.effectiveFrom.split('T')[0]);
      setEffectiveTo(editItem.effectiveTo?.split('T')[0] ?? '');
      setPersonalDeduction((editItem.standardDeduction ?? editItem.personalDeduction).toString());
      setDependentDeduction(editItem.dependentDeduction.toString());
      setBrackets(editItem.progressiveBrackets?.map(b => ({ ...b })) ?? BRACKET_DEFAULTS);
      setLegalReference(editItem.legalReference);
      setRoundingRule(editItem.roundingRule ?? 'ROUND_HALF_UP_TO_VND');
    } else {
      resetForm();
    }
  }, [open, editItem, apiBase]);

  const resetForm = () => {
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setEffectiveTo('');
    setPersonalDeduction('15500000');
    setDependentDeduction('6200000');
    setBrackets(BRACKET_DEFAULTS.map(b => ({ ...b })));
    setLegalReference('Luật Thuế TNCN 2007/QH12');
    setRoundingRule('ROUND_HALF_UP_TO_VND');
  };

  const addBracket = () => {
    const last = brackets[brackets.length - 1];
    const previousLimit = last?.upperLimit ?? brackets.at(-2)?.upperLimit ?? 0;
    setBrackets([...brackets, { upperLimit: previousLimit + 10000000, rate: Math.min((last?.rate ?? 5) + 5, 100) }]);
  };

  const removeBracket = (index: number) => {
    setBrackets(prev => prev.filter((_, i) => i !== index));
  };

  const updateBracket = (index: number, field: 'upperLimit' | 'rate', val: number | null) => {
    setBrackets(prev => prev.map((b, i) => (i === index ? { ...b, [field]: val } : b)));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const personalDeductionAmount = Number(personalDeduction) || 0;
      const dto = {
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        standardDeduction: personalDeductionAmount,
        personalDeduction: personalDeductionAmount,
        dependentDeduction: Number(dependentDeduction) || 0,
        progressiveBrackets: brackets,
        roundingRule,
        legalReference,
      };

      if (editItem) {
        await updateTaxPolicy(apiBase, editItem._id, dto);
      } else {
        await createTaxPolicy(apiBase, dto);
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>{editItem ? 'Chỉnh sửa chính sách thuế TNCN' : 'Thêm chính sách thuế TNCN mới'}</DialogTitle>
          <DialogDescription className="mt-1">
            Cấu hình biểu thuế lũy tiến và giảm trừ cho tổ chức.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 max-h-[calc(90vh-150px)]">
            {error && (
              <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
            )}

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Thông tin chính sách</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="effectiveFrom" className="text-sm font-medium">Ngày hiệu lực</Label>
                  <Input id="effectiveFrom" type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effectiveTo" className="text-sm font-medium">Ngày hết hạn</Label>
                  <Input id="effectiveTo" type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} className="h-11" placeholder="Để trống = vô hạn" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="personalDeduction" className="text-sm font-medium">Giảm trừ bản thân (VND/tháng)</Label>
                  <Input
                    id="personalDeduction"
                    type="number"
                    value={personalDeduction}
                    onChange={e => setPersonalDeduction(e.target.value)}
                    className="h-11"
                    placeholder="15500000"
                  />
                  <p className="text-xs text-muted-foreground">{formatVnd(Number(personalDeduction))}/tháng</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dependentDeduction" className="text-sm font-medium">Giảm trừ/người phụ thuộc (VND/tháng)</Label>
                  <Input
                    id="dependentDeduction"
                    type="number"
                    value={dependentDeduction}
                    onChange={e => setDependentDeduction(e.target.value)}
                    className="h-11"
                    placeholder="6200000"
                  />
                  <p className="text-xs text-muted-foreground">{formatVnd(Number(dependentDeduction))}/người/tháng</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalRef" className="text-sm font-medium">Văn bản pháp lý tham chiếu</Label>
                <Input
                  id="legalRef"
                  value={legalReference}
                  onChange={e => setLegalReference(e.target.value)}
                  className="h-11"
                  placeholder="Luật Thuế TNCN 2007/QH12"
                />
              </div>
            </div>

            <Separator />

            {/* Tax Brackets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Biểu thuế lũy tiến</h3>
                <Button variant="outline" size="sm" onClick={addBracket} className="h-9">
                  <Plus className="mr-1.5 size-4" />Thêm bậc
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Ngưỡng trên (VND)</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Thuế suất (%)</th>
                      <th className="w-12 px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {brackets.map((b, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={b.upperLimit ?? ''}
                            onChange={e => updateBracket(i, 'upperLimit', e.target.value === '' ? null : Number(e.target.value))}
                            className="h-9"
                            placeholder={i === brackets.length - 1 ? 'Không giới hạn' : undefined}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={b.rate}
                            onChange={e => updateBracket(i, 'rate', Number(e.target.value))}
                            className="h-9"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Button variant="ghost" size="sm" onClick={() => removeBracket(i)} className="h-8 w-8 p-0">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3.5 bg-muted/15">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} type="button">
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Đang lưu...' : editItem ? 'Lưu thay đổi' : 'Tạo chính sách'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
