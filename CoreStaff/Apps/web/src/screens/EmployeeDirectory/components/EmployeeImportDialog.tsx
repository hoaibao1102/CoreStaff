import { useCallback, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/dialog';
import { Button } from '../../../components/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/alert';
import { FormLabel } from '../../../components/form/FormLabel';
import { toast } from '../../../components/toast';
import {
    downloadEmployeeImportTemplate,
    hrErrorMessage,
    importEmployees,
    mapHrError,
    type EmployeeImportResult,
} from '../../../services/hrService';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface EmployeeImportDialogProps {
    apiBase: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Refresh the directory once anything was actually written. */
    onImported: () => void;
}

/** Download the row errors as CSV so HR can fix them offline and re-upload. */
function errorsToCsv(result: EmployeeImportResult): string {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = result.errors.map((e) => [e.row, e.employeeCode ?? '', e.code, mapHrError(e.code, e.message)].map(escape).join(','));
    return [['Dòng', 'Mã nhân viên', 'Mã lỗi', 'Nội dung'].join(','), ...rows].join('\n');
}

function downloadCsv(csv: string) {
    // BOM so Excel opens UTF-8 Vietnamese text without mangling it.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'loi-import-nhan-vien.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

export function EmployeeImportDialog({ apiBase, open, onOpenChange, onImported }: EmployeeImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [dryRun, setDryRun] = useState(true);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<EmployeeImportResult | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setFile(null);
        setResult(null);
        setFailure(null);
        setRunning(false);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const handleOpenChange = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const pickFile = (picked: File | undefined) => {
        setResult(null);
        setFailure(null);
        if (!picked) {
            setFile(null);
            return;
        }
        if (!picked.name.toLowerCase().endsWith('.xlsx')) {
            setFile(null);
            toast.warning('Định dạng không hỗ trợ', 'Chỉ chấp nhận tệp Excel (.xlsx).');
            return;
        }
        if (picked.size > MAX_FILE_BYTES) {
            setFile(null);
            toast.warning('Tệp quá lớn', 'Giới hạn import là 5 MB.');
            return;
        }
        setFile(picked);
    };

    const handleTemplate = async () => {
        try {
            await downloadEmployeeImportTemplate(apiBase);
        } catch (error) {
            toast.error('Không tải được file mẫu', hrErrorMessage(error));
        }
    };

    const handleImport = async () => {
        if (!file || running) return;
        setRunning(true);
        setFailure(null);
        try {
            const data = await importEmployees(apiBase, file, dryRun);
            setResult(data);
            if (!data.dryRun && data.created > 0) {
                toast.success(`Đã import ${data.created} nhân viên`, data.failed ? `${data.failed} dòng lỗi — xem bảng bên dưới.` : undefined);
                onImported();
            } else if (data.dryRun) {
                toast.info('Kiểm tra xong', data.failed ? `${data.failed} dòng cần sửa trước khi import.` : 'Tệp hợp lệ, sẵn sàng import.');
            } else {
                toast.error('Không import được dòng nào', 'Tệp có lỗi. Xem chi tiết bên dưới.');
            }
        } catch (error) {
            const message = hrErrorMessage(error);
            setFailure(message);
            toast.error('Import thất bại', message);
        } finally {
            setRunning(false);
        }
    };

    // All-or-nothing: any row error means nothing was written, so `failed > 0`
    // already implies `created === 0`.
    const rejected = result ? result.failed > 0 : false;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Import nhân viên từ Excel
                    </DialogTitle>
                    <DialogDescription>
                        Tạo tài khoản, hồ sơ, lương, bảo hiểm và hợp đồng lao động cho nhiều nhân viên
                        trong một lần. Tải file mẫu, điền thông tin, rồi tải lên. Bảo hiểm
                        BHXH/BHYT/BHTN được ghi nhận tham gia cho mọi nhân viên theo quy định.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
                    {/* Step 1 — template + file */}
                    <div className="space-y-2">
                        <FormLabel>1. Chọn tệp</FormLabel>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleTemplate}>
                                <Download className="mr-1.5 h-4 w-4" />
                                Tải file mẫu
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                                <Upload className="mr-1.5 h-4 w-4" />
                                Chọn tệp .xlsx
                            </Button>
                            <input
                                ref={inputRef}
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                aria-label="Chọn tệp Excel để import"
                                onChange={(e) => pickFile(e.target.files?.[0])}
                            />
                        </div>
                        {file && (
                            <p className="text-sm text-muted-foreground">
                                Đã chọn: <span className="font-medium text-foreground">{file.name}</span>
                                {' '}({(file.size / 1024).toFixed(0)} KB)
                            </p>
                        )}
                    </div>

                    {/* Step 2 — dry run or write */}
                    <div className="space-y-1">
                        <FormLabel>2. Cách chạy</FormLabel>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                            <span>Chạy thử — chỉ kiểm tra, không ghi dữ liệu</span>
                        </label>
                        <p className="text-sm text-muted-foreground">
                            Import là tất cả hoặc không gì cả: chỉ cần một dòng lỗi, cả tệp bị từ chối và không nhân viên nào được tạo.
                        </p>
                    </div>

                    <Button type="button" className="min-h-11 w-full" disabled={!file || running} onClick={handleImport}>
                        {running ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {running ? 'Đang xử lý…' : dryRun ? 'Kiểm tra tệp' : 'Import'}
                    </Button>

                    {failure && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Không thể xử lý tệp</AlertTitle>
                            <AlertDescription>{failure}</AlertDescription>
                        </Alert>
                    )}

                    {/* Step 3 — report */}
                    {result && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {result.created > 0 && !result.dryRun
                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    : <AlertCircle className={`h-5 w-5 ${result.failed ? 'text-amber-600' : 'text-emerald-600'}`} />}
                                <p className="text-sm font-medium">
                                    {result.dryRun
                                        ? `Kiểm tra ${result.total} dòng: ${result.total - result.failed} hợp lệ, ${result.failed} lỗi.`
                                        : `Đã tạo ${result.created}/${result.total} nhân viên, ${result.failed} dòng lỗi.`}
                                </p>
                            </div>

                            {result.errors.length > 0 && (
                                <>
                                    <div className="max-h-64 overflow-auto rounded-lg border">
                                        <table className="w-full text-sm">
                                            {/* `bg-muted` phải đặc: bản `/60` để dòng cuộn chui qua header. */}
                                            <thead className="sticky top-0 z-10 border-b bg-muted text-left">
                                                <tr>
                                                    <th className="px-3 py-2 font-medium">Dòng</th>
                                                    <th className="px-3 py-2 font-medium">Mã NV</th>
                                                    <th className="px-3 py-2 font-medium">Lỗi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {result.errors.map((e, i) => (
                                                    <tr key={`${e.row}-${e.code}-${i}`}>
                                                        <td className="px-3 py-2 tabular-nums">{e.row}</td>
                                                        <td className="px-3 py-2">{e.employeeCode ?? '—'}</td>
                                                        <td className="px-3 py-2">{mapHrError(e.code, e.message)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(errorsToCsv(result))}>
                                        <Download className="mr-1.5 h-4 w-4" />
                                        Tải danh sách lỗi (CSV)
                                    </Button>
                                </>
                            )}

                            {rejected && !result.dryRun && (
                                <p className="text-sm text-muted-foreground">
                                    Không có nhân viên nào được tạo. Sửa tệp rồi tải lên lại.
                                </p>
                            )}

                            {result.tempPasswords.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Mật khẩu tạm (chỉ hiện một lần)</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const text = result.tempPasswords
                                                    .map((p) => `${p.employeeCode}\t${p.email}\t${p.tempPassword}`)
                                                    .join('\n');
                                                navigator.clipboard?.writeText(text);
                                                toast.success('Đã sao chép', 'Chuyển cho nhân viên qua kênh nội bộ.');
                                            }}
                                        >
                                            Sao chép tất cả
                                        </Button>
                                    </div>
                                    <div className="max-h-48 overflow-auto rounded-lg border">
                                        <table className="w-full text-sm">
                                            <tbody className="divide-y">
                                                {result.tempPasswords.map((p) => (
                                                    <tr key={p.employeeCode}>
                                                        <td className="px-3 py-2">{p.employeeCode}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">{p.email}</td>
                                                        <td className="px-3 py-2 font-mono">{p.tempPassword}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Hệ thống không lưu mật khẩu tạm. Đóng cửa sổ này là không xem lại được.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
