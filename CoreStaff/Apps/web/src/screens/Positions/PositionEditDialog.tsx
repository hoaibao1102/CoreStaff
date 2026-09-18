import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { FormError } from '@/components/form/FormError';
import { FormLabel } from '@/components/form/FormLabel';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { toast } from '@/components/toast';
import { getPositionById, hrErrorMessage, updatePosition } from '@/services/hrService';

interface PositionEditDialogProps {
  apiBase: string;
  positionId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function PositionEditDialog({ apiBase, positionId, onClose, onUpdated }: PositionEditDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getPositionById(apiBase, positionId)
      .then(position => { if (!cancelled) { setCode(position.code); setName(position.name); } })
      .catch(error => { if (!cancelled) setLoadError(hrErrorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, positionId, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || loading || loadError) return;
    const payload = { code: code.trim(), name: name.trim() };
    const nextErrors = {
      code: payload.code ? undefined : 'Vui lòng nhập mã chức vụ.',
      name: payload.name ? undefined : 'Vui lòng nhập tên chức vụ.',
    };
    setErrors(nextErrors);
    if (nextErrors.code || nextErrors.name) {
      document.getElementById(nextErrors.code ? 'edit-position-code' : 'edit-position-name')?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await updatePosition(apiBase, positionId, payload);
      onClose();
      onUpdated();
      toast.success('Cập nhật chức vụ thành công.');
    } catch (error) {
      toast.error('Không thể cập nhật chức vụ', hrErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !submittingRef.current) onClose(); }}>
    <DialogContent showCloseButton={!submitting} initialFocus={() => document.getElementById('edit-position-code')}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Chỉnh sửa chức vụ</DialogTitle>
        <DialogDescription>Chỉ mã và tên chức vụ có thể được cập nhật.</DialogDescription>
      </DialogHeader>
      {loading ? <div className="space-y-4 px-6 pb-6" role="status" aria-label="Đang tải chức vụ"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
        : loadError ? <div className="px-6 pb-6"><Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription><Button variant="outline" className="mt-4 min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></Alert></div>
        : <form onSubmit={submit} noValidate className="space-y-5 overflow-y-auto px-6 pb-6" aria-busy={submitting}>
          <div className="space-y-2"><FormLabel htmlFor="edit-position-code" required>Mã chức vụ</FormLabel><Input id="edit-position-code" value={code} maxLength={32} required disabled={submitting} aria-invalid={!!errors.code} aria-describedby="edit-position-code-error" onChange={event => { setCode(event.target.value); setErrors(current => ({ ...current, code: undefined })); }} /><FormError id="edit-position-code-error" message={errors.code} /></div>
          <div className="space-y-2"><FormLabel htmlFor="edit-position-name" required>Tên chức vụ</FormLabel><Input id="edit-position-name" value={name} maxLength={128} required disabled={submitting} aria-invalid={!!errors.name} aria-describedby="edit-position-name-error" onChange={event => { setName(event.target.value); setErrors(current => ({ ...current, name: undefined })); }} /><FormError id="edit-position-name-error" message={errors.name} /></div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={onClose}>Hủy</Button><Button type="submit" className="min-h-11" disabled={submitting}>{submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></div>
        </form>}
    </DialogContent>
  </Dialog>;
}
