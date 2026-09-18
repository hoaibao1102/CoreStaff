import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/button';
import { Card, CardContent } from '../../components/card';
import { EmployeeDataState } from '../../components/EmployeeDataState';
import { hrRequest } from '../../services/hrService';

type Kind = 'salary-profiles' | 'organization-allowances' | 'attendance-bonus-policies' | 'kpi-inputs';
const meta: Record<Kind, { title: string; description: string; columns: string[] }> = {
  'salary-profiles': { title: 'Hồ sơ lương', description: 'Lương cơ bản, lương bảo hiểm và hiệu lực theo thời gian.', columns: ['employeeProfileId','baseSalary','insuranceSalary','effectiveFrom','version'] },
  'organization-allowances': { title: 'Phụ cấp', description: 'Danh mục chuẩn và phụ cấp tùy chỉnh của tổ chức.', columns: ['code','name','amount','taxable','effectiveFrom'] },
  'attendance-bonus-policies': { title: 'Thưởng chuyên cần', description: 'Policy theo phiên bản, tiers và điều kiện.', columns: ['name','bonusAmount','effectiveFrom','version','active'] },
  'kpi-inputs': { title: 'KPI kỳ lương', description: 'Dữ liệu KPI thủ công theo nhân viên và kỳ.', columns: ['employeeProfileId','period','score','amount','status'] },
};

export function CompensationScreen({ apiBase, kind }: { apiBase: string | null; kind: Kind }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true); setError(null);
    try { setRows(await hrRequest<Record<string, unknown>[]>(apiBase, `/api/hr/${kind}`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [apiBase, kind]);
  useEffect(() => { void load(); }, [load]);
  if (!apiBase) return <EmployeeDataState status="error" message="Chưa kết nối được API." />;
  if (loading) return <EmployeeDataState status="loading" />;
  if (error) return <EmployeeDataState status="error" message={error} />;
  const info = meta[kind];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{info.title}</h1><p className="mt-2 text-sm text-muted-foreground">{info.description}</p></div>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40">{info.columns.map(c => <th className="p-4 text-left" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr className="border-b" key={String(row._id ?? i)}>{info.columns.map(c => <td className="p-4" key={c}>{format(row[c])}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-muted-foreground">Chưa có dữ liệu. Sử dụng API HR để tạo bản ghi đầu tiên.</p>}</div></CardContent></Card>
    <Button variant="outline" onClick={() => void load()}>Tải lại</Button>
  </div>;
}
function format(value: unknown) { if (typeof value === 'boolean') return value ? 'Có' : 'Không'; if (typeof value === 'number') return new Intl.NumberFormat('vi-VN').format(value); if (!value) return '—'; return String(value).slice(0, 24); }
