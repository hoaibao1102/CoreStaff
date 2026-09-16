import { useCallback, useRef, useState } from 'react';
import { Building2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/dialog';
import { Button } from '../../components/button';
import { Alert, AlertDescription, AlertTitle } from '../../components/alert';
import { FormLabel } from '../../components/form/FormLabel';
import { FormError } from '../../components/form/FormError';
import { Input } from '../../components/input';
import { toast } from '../../components/toast';
import {
    createInitialHr,
    createOrganization,
    platformErrorMessage,
    validateOrganizationCode,
} from '../../services/platformService';

type Step = 'org' | 'hr' | 'done';

/**
 * FR-SYS-01/02 — two chained platform calls in one dialog: create the org, then
 * create its first HR. A failed step 2 keeps the new org id in state so Retry
 * re-runs only that step (the pair is deliberately not transactional).
 * The one-time password lives in component state only — never localStorage,
 * never the toast body — and dies with the dialog.
 */
export function OrganizationCreateDialog({
    apiBase,
    open,
    onOpenChange,
    onCreated,
}: {
    apiBase: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}) {
    const [step, setStep] = useState<Step>('org');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [hrEmail, setHrEmail] = useState('');
    const [hrFullName, setHrFullName] = useState('');
    const [orgId, setOrgId] = useState<string | null>(null);
    const [orgCode, setOrgCode] = useState('');
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string; email?: string; fullName?: string }>({});
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);
    const [copied, setCopied] = useState(false);

    const reset = useCallback(() => {
        setStep('org'); setCode(''); setName(''); setHrEmail(''); setHrFullName('');
        setOrgId(null); setOrgCode(''); setTempPassword(null);
        setError(null); setFieldErrors({}); setCopied(false);
    }, []);

    const handleOpenChange = (next: boolean) => {
        if (submitting.current) return;
        if (!next) reset();
        onOpenChange(next);
    };

    const createOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting.current) return;
        const errors = {
            code: validateOrganizationCode(code) ?? undefined,
            name: name.trim() ? undefined : 'Vui lòng nhập tên tổ chức.',
        };
        setFieldErrors(errors); setError(null);
        if (errors.code || errors.name) return;
        submitting.current = true; setBusy(true);
        try {
            const org = await createOrganization(apiBase, { code, name });
            setOrgId(String(org._id));
            setOrgCode(org.code);
            setStep('hr');
        } catch (err) {
            setError(platformErrorMessage(err));
        } finally {
            submitting.current = false; setBusy(false);
        }
    };

    const createHr = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting.current || !orgId) return;
        const errors = {
            email: hrEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(hrEmail.trim())
                ? 'Email chưa đúng định dạng. Ví dụ: hr@company.com'
                : hrEmail.trim() ? undefined : 'Vui lòng nhập email của HR đầu tiên.',
            fullName: hrFullName.trim().split(/\s+/).filter(Boolean).length >= 2 ? undefined : 'Họ và tên phải có ít nhất hai từ.',
        };
        setFieldErrors(errors); setError(null);
        if (errors.email || errors.fullName) return;
        submitting.current = true; setBusy(true);
        try {
            const hr = await createInitialHr(apiBase, orgId, { email: hrEmail.trim(), fullName: hrFullName.trim() });
            // Shown exactly once and never persisted; relay it out-of-band.
            setTempPassword(hr.tempPassword ?? null);
            setStep('done');
            onCreated();
            toast.success('Đã tạo tổ chức và HR đầu tiên', 'Mã tạm thời xuất hiện trong cửa sổ — hãy chuyển cho HR kèm hướng dẫn đổi mật khẩu.');
        } catch (err) {
            setError(platformErrorMessage(err));
        } finally {
            submitting.current = false; setBusy(false);
        }
    };

    const copyPassword = async () => {
        if (!tempPassword) return;
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard may be unavailable in restricted contexts; the code is selectable by hand.
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-xl gap-0">
                <DialogHeader className="border-b border-border px-5 py-5 pr-16 sm:px-6">
                    <DialogTitle className="text-xl font-semibold">Tạo tổ chức mới</DialogTitle>
                    <DialogDescription className="mt-1.5 max-w-xl">
                        Tạo tổ chức, sau đó là tài khoản HR đầu tiên để vận hành.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
                    {step === 'org' ? (
                        <form aria-label="Tạo tổ chức" onSubmit={createOrg} noValidate aria-busy={busy}>
                            {/* account-validation width */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <FormLabel htmlFor="platform-org-code" required>Mã tổ chức</FormLabel>
                                    <Input
                                        id="platform-org-code"
                                        value={code}
                                        maxLength={20}
                                        disabled={busy}
                                        autoComplete="off"
                                        className="min-h-11"
                                        placeholder="Ví dụ: TVS"
                                        aria-invalid={!!fieldErrors.code}
                                        aria-describedby={fieldErrors.code ? 'platform-org-code-error' : undefined}
                                        onChange={(e) => { setCode(e.target.value); setFieldErrors((prev) => ({ ...prev, code: undefined })); }}
                                    />
                                    <FormError id="platform-org-code-error" message={fieldErrors.code} />
                                </div>
                                <div className="space-y-1.5">
                                    <FormLabel htmlFor="platform-org-name" required>Tên tổ chức</FormLabel>
                                    <Input
                                        id="platform-org-name"
                                        value={name}
                                        maxLength={256}
                                        disabled={busy}
                                        className="min-h-11"
                                        placeholder="Ví dụ: TVS Corporation"
                                        aria-invalid={!!fieldErrors.name}
                                        aria-describedby={fieldErrors.name ? 'platform-org-name-error' : undefined}
                                        onChange={(e) => { setName(e.target.value); setFieldErrors((prev) => ({ ...prev, name: undefined })); }}
                                    />
                                    <FormError id="platform-org-name-error" message={fieldErrors.name} />
                                </div>
                            </div>
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border pt-6">
                                <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => handleOpenChange(false)}>Hủy</Button>
                                <Button type="submit" className="min-h-11" disabled={busy}>
                                    {busy && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                    {busy ? 'Đang tạo…' : 'Tạo tổ chức'}
                                </Button>
                            </div>
                        </form>
                    ) : step === 'hr' ? (
                        <form aria-label="HR đầu tiên" onSubmit={createHr} noValidate aria-busy={busy}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <FormLabel htmlFor="platform-hr-email" required>Email HR</FormLabel>
                                    <Input
                                        id="platform-hr-email"
                                        type="email"
                                        value={hrEmail}
                                        maxLength={256}
                                        disabled={busy}
                                        autoComplete="off"
                                        className="min-h-11"
                                        placeholder="hr@company.com"
                                        aria-invalid={!!fieldErrors.email}
                                        aria-describedby={fieldErrors.email ? 'platform-hr-email-error' : undefined}
                                        onChange={(e) => { setHrEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined })); }}
                                    />
                                    <FormError id="platform-hr-email-error" message={fieldErrors.email} />
                                </div>
                                <div className="space-y-1.5">
                                    <FormLabel htmlFor="platform-hr-fullname" required>Họ và tên HR</FormLabel>
                                    <Input
                                        id="platform-hr-fullname"
                                        value={hrFullName}
                                        maxLength={256}
                                        disabled={busy}
                                        autoComplete="off"
                                        className="min-h-11"
                                        placeholder="Ví dụ: Nguyễn Thị HR"
                                        aria-invalid={!!fieldErrors.fullName}
                                        aria-describedby={fieldErrors.fullName ? 'platform-hr-fullname-error' : undefined}
                                        onChange={(e) => { setHrFullName(e.target.value); setFieldErrors((prev) => ({ ...prev, fullName: undefined })); }}
                                    />
                                    <FormError id="platform-hr-fullname-error" message={fieldErrors.fullName} />
                                </div>
                            </div>
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            {error && <div className="mt-3 flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><span className="text-sm text-muted-foreground">Tổ chức {orgCode} đã được tạo — thử lại chỉ chạy bước tạo HR.</span></div>}
                            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border pt-6">
                                <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => handleOpenChange(false)}>Hủy</Button>
                                <Button type="submit" className="min-h-11" disabled={busy}>
                                    {busy && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                    {busy ? 'Đang tạo…' : 'Tạo HR đầu tiên'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <Alert>
                                <Building2 className="mt-0.5 size-4" aria-hidden="true" />
                                <AlertTitle>Tổ chức {orgCode} đã sẵn sàng</AlertTitle>
                                <AlertDescription className="mt-0.5">
                                    Mã tạm thời của HR chỉ hiển thị đúng một lần. Hãy chép ngay và chuyển cho HR ngoài hệ thống; mật khẩu sẽ phải đổi khi đăng nhập lần đầu.
                                </AlertDescription>
                            </Alert>
                            {tempPassword ? (
                                <div>
                                    <FormLabel htmlFor="platform-temp-password">Mật khẩu tạm thời (một lần)</FormLabel>
                                    <div className="flex gap-2">
                                        <code id="platform-temp-password" className="min-h-11 select-all rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-base font-semibold tracking-wide">{tempPassword}</code>
                                        <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyPassword()}>
                                            {copied ? 'Đã chép' : 'Chép'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Không nhận được mật khẩu tạm thời — hãy dùng chức năng đặt lại mật khẩu khi cần.</p>
                            )}
                            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-6">
                                <Button type="button" className="min-h-11" onClick={() => handleOpenChange(false)}>Đóng</Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}