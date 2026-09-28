import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { FormLabel } from './form/FormLabel';
import { FormError } from './form/FormError';
import { toast } from './toast';
import { hrErrorMessage } from '../services/hrService';

/**
 * D42 — the ONE mutation the effective-dating pattern allows on an existing
 * record: setting `effectiveTo` on one that's currently open-ended. Nothing
 * else about the record changes here; correcting rates/participation/etc.
 * still means creating a new version via the normal "Tạo..." dialog — this
 * one only unblocks that create by closing the sibling that would otherwise
 * overlap every future period. Shared by InsuranceProfile/InsurancePolicy/
 * EnterpriseInsurancePolicy since all three use the identical pattern.
 */
export function CloseEffectiveRecordDialog(props: {
  open: boolean;
  title: string;
  description: string;
  effectiveFrom: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (effectiveTo: string) => Promise<unknown>;
  onClosed?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.open) { setEffectiveTo(''); setError(null); }
  }, [props.open]);

  const minDate = props.effectiveFrom.slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!effectiveTo) { setError('Vui lòng chọn ngày kết thúc hiệu lực.'); return; }
    if (effectiveTo <= minDate) { setError('Ngày kết thúc phải sau ngày hiệu lực từ.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await props.onConfirm(effectiveTo);
      toast.success('Đã kết thúc hiệu lực', 'Bây giờ có thể tạo phiên bản mới kế tiếp.');
      props.onOpenChange(false);
      props.onClosed?.();
    } catch (err) {
      setError(hrErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(next) => { if (!submitting) props.onOpenChange(next); }}>
      <DialogContent className="max-w-md gap-0">
        <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
          <DialogTitle className="text-lg font-semibold">{props.title}</DialogTitle>
          <DialogDescription className="mt-1.5">{props.description}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          <div className="space-y-1.5 px-5 py-6 sm:px-6">
            <FormLabel htmlFor="close-effective-to" required>Ngày kết thúc hiệu lực</FormLabel>
            <Input
              id="close-effective-to"
              type="date"
              className="h-11"
              min={minDate}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              disabled={submitting}
              aria-invalid={!!error}
            />
            <FormError message={error} />
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-popover px-5 py-4">
            <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => props.onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submitting ? 'Đang xử lý…' : 'Kết thúc hiệu lực'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
