import { useRef, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { FormError } from '@/components/form/FormError';
import { FormLabel } from '@/components/form/FormLabel';
import { Input } from '@/components/input';
import { toast } from '@/components/toast';
import { createPosition } from '@/services/hrService';

interface PositionCreateDialogProps {
  apiBase: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const INVALID_MESSAGE = 'Thông tin chức vụ chưa hợp lệ. Vui lòng kiểm tra lại.';

export function PositionCreateDialog({ apiBase, open, onClose, onCreated }: PositionCreateDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function close() {
    if (submittingRef.current) return;
    setCode('');
    setName('');
    setErrors({});
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const payload = { code: code.trim(), name: name.trim() };
    const nextErrors = {
      code: payload.code ? undefined : 'Vui lòng nhập mã chức vụ.',
      name: payload.name ? undefined : 'Vui lòng nhập tên chức vụ.',
    };
    setErrors(nextErrors);
    if (nextErrors.code || nextErrors.name) {
      document.getElementById(nextErrors.code ? 'position-code' : 'position-name')?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createPosition(apiBase, payload);
      setCode('');
      setName('');
      setErrors({});
      onClose();
      onCreated();
      toast.success('Tạo chức vụ thành công.');
    } catch {
      toast.error('Không thể tạo chức vụ', INVALID_MESSAGE);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) close(); }}>
    <DialogContent showCloseButton={!submitting} initialFocus={() => document.getElementById('position-code')}>
      <DialogHeader className="border-b border-border pr-16">
        <DialogTitle>Thêm chức vụ</DialogTitle>
        <DialogDescription>Nhập thông tin chức vụ mới. Các trường có dấu * là bắt buộc.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} noValidate className="space-y-5 overflow-y-auto px-6 pb-6" aria-busy={submitting}>
        <div className="space-y-2">
          <FormLabel htmlFor="position-code" required>Mã chức vụ</FormLabel>
          <Input id="position-code" value={code} maxLength={32} required disabled={submitting} aria-invalid={!!errors.code} aria-describedby="position-code-error" onChange={event => { setCode(event.target.value); setErrors(current => ({ ...current, code: undefined })); }} />
          <FormError id="position-code-error" message={errors.code} />
        </div>
        <div className="space-y-2">
          <FormLabel htmlFor="position-name" required>Tên chức vụ</FormLabel>
          <Input id="position-name" value={name} maxLength={128} required disabled={submitting} aria-invalid={!!errors.name} aria-describedby="position-name-error" onChange={event => { setName(event.target.value); setErrors(current => ({ ...current, name: undefined })); }} />
          <FormError id="position-name-error" message={errors.name} />
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={close}>Hủy</Button>
          <Button type="submit" className="min-h-11" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {submitting ? 'Đang tạo...' : 'Tạo chức vụ'}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
