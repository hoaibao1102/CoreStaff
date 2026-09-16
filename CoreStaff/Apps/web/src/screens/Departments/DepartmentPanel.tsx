import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LoaderCircle, Pencil, Power, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/sheet';
import { Skeleton } from '@/components/skeleton';
import { FormLabel } from '@/components/form/FormLabel';
import { FormError } from '@/components/form/FormError';
import { createDepartment, getDepartmentById, hrErrorMessage, setDepartmentActive, updateDepartment, type Department } from '@/services/hrService';

interface DepartmentPanelProps {
  apiBase: string;
  organizationId: string;
  canManage: boolean;
  departmentId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export function DepartmentPanel({ apiBase, organizationId, canManage, departmentId, onClose, onSaved }: DepartmentPanelProps) {
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(!!departmentId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!departmentId);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({});
  const [revision, setRevision] = useState(0);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getDepartmentById(apiBase, departmentId).then(data => {
      if (cancelled) return;
      if (data.organizationId !== organizationId) {
        setLoadError('Bạn không có quyền xem phòng ban này.');
        return;
      }
      setDepartment(data); setCode(data.code); setName(data.name);
    }).catch(err => { if (!cancelled) setLoadError(hrErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, departmentId, organizationId, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canManage || submitting.current) return;
    const errors = {
      code: !code.trim() ? 'Vui lòng nhập mã phòng ban.' : code.trim().length > 32 ? 'Mã phòng ban tối đa 32 ký tự.' : undefined,
      name: !name.trim() ? 'Vui lòng nhập tên phòng ban.' : name.trim().length > 128 ? 'Tên phòng ban tối đa 128 ký tự.' : undefined,
    };
    setFieldErrors(errors); setError(null);
    if (errors.code || errors.name) {
      document.getElementById(errors.code ? 'department-code' : 'department-name')?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      if (department) {
        const patch: Partial<Pick<Department, 'code' | 'name'>> = {};
        if (code.trim() !== department.code) patch.code = code.trim();
        if (name.trim() !== department.name) patch.name = name.trim();
        if (!Object.keys(patch).length) { setEditing(false); return; }
        await updateDepartment(apiBase, department._id, patch);
        onSaved('Đã cập nhật phòng ban.');
      } else {
        await createDepartment(apiBase, { code: code.trim(), name: name.trim() });
        onSaved('Đã tạo phòng ban mới.');
      }
    } catch (err) {
      if ((err as { code?: string })?.code === 'DEPARTMENT_CODE_TAKEN') {
        setFieldErrors({ code: 'Mã phòng ban đã tồn tại trong tổ chức. Vui lòng chọn mã khác.' });
        document.getElementById('department-code')?.focus();
      } else setError(hrErrorMessage(err));
    } finally { submitting.current = false; setSaving(false); }
  }

  async function changeStatus() {
    if (!canManage || !department || submitting.current) return;
    submitting.current = true;
    setSaving(true); setError(null);
    try {
      await setDepartmentActive(apiBase, department._id, !department.active);
      onSaved(department.active ? 'Đã vô hiệu hóa phòng ban.' : 'Đã kích hoạt lại phòng ban.');
    } catch (err) { setError(hrErrorMessage(err)); }
    finally { submitting.current = false; setSaving(false); }
  }

  const title = !departmentId ? 'Tạo phòng ban' : editing ? 'Chỉnh sửa phòng ban' : 'Chi tiết phòng ban';
  const Container = departmentId ? Sheet : Dialog;
  const Content = departmentId ? SheetContent : DialogContent;
  const Header = departmentId ? SheetHeader : DialogHeader;
  const Title = departmentId ? SheetTitle : DialogTitle;
  const Description = departmentId ? SheetDescription : DialogDescription;

  return <Container open onOpenChange={open => { if (!open && !submitting.current) onClose(); }}>
    <Content showCloseButton={false} finalFocus={returnFocus} initialFocus={departmentId ? undefined : () => document.getElementById('department-code')} className={departmentId ? 'data-[side=right]:w-full data-[side=right]:sm:max-w-lg' : undefined}>
      <Header className="relative border-b border-border p-6 pr-16">
        <Title className="text-xl font-semibold">{title}</Title>
        <Description className="mt-2">{editing ? 'Nhập mã và tên phòng ban. Các trường có dấu * là bắt buộc.' : 'Thông tin và trạng thái phòng ban trong tổ chức.'}</Description>
        <Button variant="ghost" className="absolute right-3 top-3 min-h-11 min-w-11" aria-label="Đóng bảng phòng ban" disabled={saving} onClick={onClose}><X aria-hidden="true" /></Button>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {loading ? <div className="space-y-4" role="status" aria-label="Đang tải chi tiết phòng ban"><Skeleton className="h-16" /><Skeleton className="h-32" /></div>
          : loadError ? <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription><Button variant="outline" className="mt-4 min-h-11" onClick={() => setRevision(value => value + 1)}>Thử lại</Button></Alert>
            : editing && canManage ? <form onSubmit={save} noValidate className="space-y-6" aria-label={title} aria-busy={saving}>
              <div className="space-y-2">
                <FormLabel htmlFor="department-code" required>Mã phòng ban</FormLabel>
                <Input id="department-code" value={code} required maxLength={32} disabled={saving} className="min-h-11" placeholder="Ví dụ: HR" aria-invalid={!!fieldErrors.code} aria-describedby="department-code-hint department-code-error" onChange={event => { setCode(event.target.value); setFieldErrors(previous => ({ ...previous, code: undefined })); }} />
                <p id="department-code-hint" className="text-xs text-muted-foreground">Tối đa 32 ký tự, không trùng trong tổ chức.</p>
                <FormError message={fieldErrors.code} />
              </div>
              <div className="space-y-2">
                <FormLabel htmlFor="department-name" required>Tên phòng ban</FormLabel>
                <Input id="department-name" value={name} required maxLength={128} disabled={saving} className="min-h-11" placeholder="Ví dụ: Phòng Nhân sự" aria-invalid={!!fieldErrors.name} aria-describedby="department-name-error" onChange={event => { setName(event.target.value); setFieldErrors(previous => ({ ...previous, name: undefined })); }} />
                <FormError message={fieldErrors.name} />
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">
                <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => {
                  if (!department) onClose();
                  else { setEditing(false); setCode(department.code); setName(department.name); setFieldErrors({}); setError(null); }
                }}>Hủy</Button>
                <Button type="submit" className="min-h-11" disabled={saving}>{saving && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? 'Đang lưu…' : department ? 'Lưu thay đổi' : 'Tạo phòng ban'}</Button>
              </div>
            </form>
              : department && <div className="space-y-6">
                <div><h2 className="break-words text-xl font-semibold">{department.name}</h2><p className="mt-2 text-sm text-muted-foreground">{department.active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</p></div>
                <dl className="space-y-4 rounded-xl border border-border p-4">
                  {[
                    ['Mã phòng ban', department.code], ['Tên phòng ban', department.name],
                    ['Ngày tạo', formatDate(department.createdAt)], ['Cập nhật gần nhất', formatDate(department.updatedAt)],
                  ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
                </dl>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                {canManage && (confirming ? <Alert>
                  <AlertTitle>{department.active ? 'Vô hiệu hóa phòng ban này?' : 'Kích hoạt lại phòng ban này?'}</AlertTitle>
                  <AlertDescription className="mt-2">{department.active ? 'Phòng ban được giữ lại và có thể kích hoạt lại sau. Dữ liệu không bị xóa.' : 'Phòng ban sẽ trở lại danh sách đang hoạt động.'}</AlertDescription>
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => { setConfirming(false); setError(null); }}>Hủy</Button>
                    <Button variant={department.active ? 'destructive' : 'default'} className="min-h-11" disabled={saving} onClick={() => void changeStatus()}>{saving ? 'Đang xử lý…' : department.active ? 'Xác nhận vô hiệu hóa' : 'Xác nhận kích hoạt'}</Button>
                  </div>
                </Alert> : <div className="flex flex-wrap gap-3">
                  <Button className="min-h-11" onClick={() => { setEditing(true); setError(null); }}><Pencil aria-hidden="true" />Chỉnh sửa</Button>
                  <Button variant="outline" className="min-h-11" onClick={() => setConfirming(true)}><Power aria-hidden="true" />{department.active ? 'Vô hiệu hóa' : 'Kích hoạt lại'}</Button>
                </div>)}
              </div>}
      </div>
    </Content>
  </Container>;
}
