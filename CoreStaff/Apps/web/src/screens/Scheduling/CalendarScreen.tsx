import { listOvertimePolicies, type OvertimePayPolicy } from '@/services/policies.service';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Eye, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/alert';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/dropdown-menu';
import { FormError } from '@/components/form/FormError';
import { FormLabel } from '@/components/form/FormLabel';
import { Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { toast } from '@/components/toast';
import { createCalendarException, deleteCalendarException, listCalendarExceptions, updateCalendarException, type CalendarException } from '@/services/scheduling.service';

type CalendarForm={date:string;type:CalendarException['type'];name:string};
const emptyForm=():CalendarForm=>({date:new Date().toISOString().slice(0,10),type:'PUBLIC_HOLIDAY',name:''});
const typeLabel:Record<CalendarException['type'],string>={PUBLIC_HOLIDAY:'Ngày lễ',SPECIAL_WORKING_DAY:'Ngày thường',WEEKLY_OFF:'Ngày nghỉ tuần'};
const formatDate=(date:string)=>new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
const apiError=(error:unknown)=>{const code=(error as {code?:string})?.code;const messages:Record<string,string>={OVERTIME_POLICY_NOT_FOUND:'Chưa có Chính sách lương tăng ca có hiệu lực cho ngày này. Vui lòng cấu hình chính sách trước khi lưu lịch.',CALENDAR_DATE_ALREADY_CONFIGURED:'Ngày này đã được cấu hình trong lịch Organization.',CALENDAR_EXCEPTION_NOT_FOUND:'Không tìm thấy ngày lịch cần thao tác.',INVALID_DATE:'Ngày được chọn không hợp lệ.'};return(code&&messages[code])||(error instanceof Error?error.message:'Không thể thực hiện thao tác.')};

export function CalendarScreen({apiBase}:{apiBase:string}){
  const [rows,setRows]=useState<CalendarException[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[typeFilter,setTypeFilter]=useState<'all'|CalendarException['type']>('all'),[year,setYear]=useState(String(new Date().getFullYear())),[formOpen,setFormOpen]=useState(false),[detail,setDetail]=useState<CalendarException|null>(null),[editing,setEditing]=useState<CalendarException|null>(null),[deleting,setDeleting]=useState<CalendarException|null>(null),[form,setForm]=useState<CalendarForm>(emptyForm()),[formError,setFormError]=useState(''),[busy,setBusy]=useState(false),[rev,setRev]=useState(0);
  useEffect(()=>{let cancelled=false;setLoading(true);setError('');const from=year?`${year}-01-01`:undefined,to=year?`${year}-12-31`:undefined;listCalendarExceptions(apiBase,from,to).then(data=>!cancelled&&setRows(data)).catch(e=>!cancelled&&setError(apiError(e))).finally(()=>!cancelled&&setLoading(false));return()=>{cancelled=true}},[apiBase,rev,year]);
  const [policies,setPolicies]=useState<OvertimePayPolicy[]>([]),[policyLoading,setPolicyLoading]=useState(true),[policyError,setPolicyError]=useState('');
  useEffect(()=>{let cancelled=false;setPolicyLoading(true);setPolicyError('');listOvertimePolicies(apiBase).then(data=>{if(!cancelled)setPolicies(data)}).catch(()=>{if(!cancelled)setPolicyError('Không thể tải Chính sách lương tăng ca. Vui lòng thử lại.')}).finally(()=>{if(!cancelled)setPolicyLoading(false)});return()=>{cancelled=true}},[apiBase,rev,formOpen]);
  const policyFor=(date:string)=>policies.filter(p=>p.active&&new Date(p.effectiveFrom).getTime()<=new Date(date).getTime()&&(!p.effectiveTo||new Date(date).getTime()<new Date(p.effectiveTo).getTime())).sort((a,b)=>new Date(b.effectiveFrom).getTime()-new Date(a.effectiveFrom).getTime())[0];
  const policyInfo=(date:string,type:CalendarException['type'])=>{
    if(policyLoading)return 'Đang tải chính sách…';
    if(policyError)return policyError;
    const policy=policyFor(date);
    if(!policy)return 'Chưa có chính sách có hiệu lực cho ngày này';
    const rate=type==='PUBLIC_HOLIDAY'?policy.publicHolidayRate:type==='WEEKLY_OFF'?policy.weeklyOffRate:policy.workingDayRate;
    return `${type==='PUBLIC_HOLIDAY'?'Tăng ca ngày lễ':type==='WEEKLY_OFF'?'Tăng ca ngày nghỉ tuần':'Tăng ca ngày thường'}: ${new Intl.NumberFormat('vi-VN',{style:'percent',maximumFractionDigits:2}).format(rate)} · Chính sách v${policy.version}`;
  };
  const visible=useMemo(()=>{const keyword=query.trim().toLocaleLowerCase('vi');return rows.filter(row=>(typeFilter==='all'||row.type===typeFilter)&&(!keyword||[row.name,row.date,typeLabel[row.type]].some(value=>value.toLocaleLowerCase('vi').includes(keyword))))},[query,rows,typeFilter]);
  const stats=useMemo(()=>({total:rows.length,holidays:rows.filter(r=>r.type==='PUBLIC_HOLIDAY').length,special:rows.filter(r=>r.type==='SPECIAL_WORKING_DAY').length}),[rows]);
  function openCreate(){setEditing(null);setForm(emptyForm());setFormError('');setFormOpen(true)}
  function openEdit(row:CalendarException){setEditing(row);setForm({date:row.date,type:row.type,name:row.name});setFormError('');setFormOpen(true)}
  function validate(){if(!form.date)return'Vui lòng chọn ngày.';if(form.name.trim().length<2)return'Tên ngày phải có ít nhất 2 ký tự.';if(form.name.trim().length>200)return'Tên ngày không được vượt quá 200 ký tự.';return''}
  async function save(){const validation=validate();if(validation){setFormError(validation);return}if(policyLoading){setFormError('Đang tải chính sách, vui lòng đợi.');return}if(policyError){setFormError(policyError);return}if(!policyFor(form.date)){setFormError('Chưa có Chính sách lương tăng ca có hiệu lực cho ngày này.');return}setBusy(true);setFormError('');try{const payload={date:form.date,type:form.type,name:form.name.trim()};if(editing)await updateCalendarException(apiBase,editing._id,payload);else await createCalendarException(apiBase,payload);toast.success(editing?'Cập nhật ngày lịch thành công.':'Thêm ngày vào lịch thành công.');setFormOpen(false);setRev(x=>x+1)}catch(e){setFormError(apiError(e))}finally{setBusy(false)}}
  async function remove(){if(!deleting)return;setBusy(true);try{await deleteCalendarException(apiBase,deleting._id);toast.success('Đã xóa ngày khỏi lịch Organization.');setDeleting(null);setRev(x=>x+1)}catch(e){setError(apiError(e))}finally{setBusy(false)}}
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lịch Organization</h1><p className="mt-2 text-sm text-muted-foreground">Quản lý ngày thường, ngày nghỉ tuần và ngày lễ theo Chính sách lương tăng ca.</p></div><Button className="min-h-11" onClick={openCreate}><Plus/>Thêm ngày lịch</Button></header>
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-5"/></span><div><p className="text-sm text-muted-foreground">Tổng ngày cấu hình</p><p className="text-2xl font-semibold">{stats.total}</p></div></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ngày nghỉ lễ</p><p className="mt-1 text-2xl font-semibold text-rose-700">{stats.holidays}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Ngày thường</p><p className="mt-1 text-2xl font-semibold text-blue-700">{stats.special}</p></CardContent></Card></div>
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="grid gap-4 border-b p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_240px_auto] lg:items-end sm:p-6"><FormLabel className="space-y-2"><span>Tìm kiếm</span><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên ngày, loại hoặc ngày…"/></FormLabel><FormLabel className="space-y-2"><span>Năm</span><Input inputMode="numeric" maxLength={4} value={year} onChange={e=>setYear(e.target.value.replace(/\D/g,''))}/></FormLabel><FormLabel className="space-y-2"><span>Loại ngày</span><select className="h-10 w-full rounded-lg border bg-background px-3" value={typeFilter} onChange={e=>setTypeFilter(e.target.value as typeof typeFilter)}><option value="all">Tất cả loại ngày</option><option value="SPECIAL_WORKING_DAY">Ngày thường</option><option value="WEEKLY_OFF">Ngày nghỉ tuần</option><option value="PUBLIC_HOLIDAY">Ngày lễ</option></select></FormLabel><Button variant="outline" className="min-h-10" onClick={()=>setRev(x=>x+1)}><RefreshCw/>Làm mới</Button></div>
      {loading?<div className="space-y-3 p-6" role="status">{[1,2,3,4].map(i=><Skeleton key={i} className="h-12"/>)}</div>:!visible.length?<div className="p-14 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-3 size-10"/><p className="font-medium text-foreground">Chưa có ngày lịch phù hợp</p><p className="mt-1 text-sm">Thêm ngày nghỉ lễ hoặc thay đổi bộ lọc tìm kiếm.</p></div>:<><div className="hidden overflow-x-auto md:block"><Table className="min-w-[820px]"><TableHeader><TableRow><TableHead className="pl-6">Ngày</TableHead><TableHead>Tên ngày</TableHead><TableHead>Loại ngày</TableHead><TableHead>Chính sách lương tăng ca</TableHead><TableHead>Ảnh hưởng chấm công</TableHead><TableHead className="pr-6 text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{visible.map(row=><TableRow key={row._id}><TableCell className="pl-6 font-medium capitalize">{formatDate(row.date)}</TableCell><TableCell>{row.name}</TableCell><TableCell><TypeBadge type={row.type}/></TableCell><TableCell className="text-sm">{policyInfo(row.date,row.type)}</TableCell><TableCell className="text-sm text-muted-foreground">{row.type==='SPECIAL_WORKING_DAY'?'Áp dụng nghĩa vụ làm việc':'Không tính vắng mặt'}</TableCell><TableCell className="pr-6 text-right"><RowMenu row={row} onDetail={()=>setDetail(row)} onEdit={()=>openEdit(row)} onDelete={()=>setDeleting(row)}/></TableCell></TableRow>)}</TableBody></Table></div><div className="grid gap-3 p-4 md:hidden">{visible.map(row=><Card key={row._id} className="shadow-none"><CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{row.name}</CardTitle><p className="mt-1 text-xs capitalize text-muted-foreground">{formatDate(row.date)}</p></div><RowMenu row={row} onDetail={()=>setDetail(row)} onEdit={()=>openEdit(row)} onDelete={()=>setDeleting(row)}/></div></CardHeader><CardContent><TypeBadge type={row.type}/><p className="mt-2 text-sm">{policyInfo(row.date,row.type)}</p><p className="mt-2 text-xs text-muted-foreground">{row.type==='SPECIAL_WORKING_DAY'?'Áp dụng nghĩa vụ làm việc':'Không tính vắng mặt'}</p></CardContent></Card>)}</div></>}
    </div>
    <Dialog open={formOpen} onOpenChange={next=>!busy&&setFormOpen(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="border-b pr-16">
          <DialogTitle>{editing?'Chỉnh sửa ngày lịch':'Thêm ngày vào lịch'}</DialogTitle>
          <DialogDescription>Mỗi ngày chỉ có một cấu hình trong Organization.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {formError&&<div className="mb-4"><FormError message={formError}/></div>}
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <FormLabel className="flex min-w-0 flex-col gap-2">
              <span>Ngày <span className="text-destructive">*</span></span>
              <Input className="h-10 w-full" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} disabled={busy}/>
            </FormLabel>
            <FormLabel className="flex min-w-0 flex-col gap-2">
              <span>Loại ngày <span className="text-destructive">*</span></span>
              <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" value={form.type} onChange={e=>setForm({...form,type:e.target.value as CalendarException['type']})} disabled={busy}>
                <option value="SPECIAL_WORKING_DAY">Ngày thường</option>
                <option value="WEEKLY_OFF">Ngày nghỉ tuần</option>
                <option value="PUBLIC_HOLIDAY">Ngày lễ</option>
              </select>
            </FormLabel>
            <FormLabel className="flex min-w-0 flex-col gap-2 sm:col-span-2">
              <span>Tên ngày <span className="text-destructive">*</span></span>
              <Input className="h-10 w-full" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ví dụ: Quốc khánh" maxLength={200} disabled={busy}/>
              <small className="font-normal text-muted-foreground">{form.name.length}/200 ký tự</small>
            </FormLabel>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm sm:col-span-2">
              <p className="font-medium">Chính sách lương tăng ca</p>
              <p className="mt-1 text-muted-foreground">{policyInfo(form.date,form.type)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Hệ số áp dụng cho thời gian tăng ca được duyệt. Ngày lễ được ưu tiên khi trùng ngày nghỉ tuần.</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" disabled={busy} onClick={()=>setFormOpen(false)}>Hủy</Button>
          <Button disabled={busy} onClick={save}>{busy?'Đang lưu…':editing?'Lưu thay đổi':'Thêm ngày'}</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!detail} onOpenChange={next=>!next&&setDetail(null)}><DialogContent className="max-w-xl"><DialogHeader className="border-b pr-16"><DialogTitle>Chi tiết ngày lịch</DialogTitle><DialogDescription>Thông tin ngoại lệ lịch của Organization.</DialogDescription></DialogHeader>{detail&&<dl className="grid gap-5 px-6 pb-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Tên ngày</dt><dd className="mt-1 font-medium">{detail.name}</dd></div><div><dt className="text-xs text-muted-foreground">Ngày</dt><dd className="mt-1 capitalize">{formatDate(detail.date)}</dd></div><div><dt className="text-xs text-muted-foreground">Loại</dt><dd className="mt-1"><TypeBadge type={detail.type}/></dd></div><div><dt className="text-xs text-muted-foreground">Quy tắc</dt><dd className="mt-1">{detail.type==='PUBLIC_HOLIDAY'?'Ưu tiên hơn lịch làm việc và ngày nghỉ tuần.':detail.type==='WEEKLY_OFF'?'Ngày nghỉ tuần, không tính vắng mặt.':'Được xem là ngày có nghĩa vụ làm việc.'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Chính sách lương tăng ca</dt><dd className="mt-1">{policyInfo(detail.date,detail.type)}</dd></div></dl>}<div className="mx-6 mb-6 flex justify-end border-t pt-5"><Button variant="outline" onClick={()=>setDetail(null)}>Đóng</Button></div></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={next=>!next&&!busy&&setDeleting(null)}><DialogContent className="max-w-lg"><DialogHeader className="border-b pr-16"><DialogTitle>Xóa ngày khỏi lịch?</DialogTitle><DialogDescription>Phân loại ngày công có thể thay đổi sau thao tác này.</DialogDescription></DialogHeader>{deleting&&<Alert className="mx-6"><AlertDescription>Bạn đang xóa <strong>{deleting.name}</strong> — {formatDate(deleting.date)}.</AlertDescription></Alert>}<div className="mx-6 mb-6 flex justify-end gap-3 border-t pt-5"><Button variant="outline" disabled={busy} onClick={()=>setDeleting(null)}>Hủy</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy?'Đang xóa…':'Xóa ngày'}</Button></div></DialogContent></Dialog>
  </div>
}

function TypeBadge({type}:{type:CalendarException['type']}){return <Badge variant="secondary" className={type==='PUBLIC_HOLIDAY'?'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300':'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}>{typeLabel[type]}</Badge>}
function RowMenu({row,onDetail,onEdit,onDelete}:{row:CalendarException;onDetail:()=>void;onEdit:()=>void;onDelete:()=>void}){return <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="min-h-10 min-w-10"/>} aria-label={`Mở thao tác ${row.name}`}><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuItem onClick={onDetail}><Eye/>Xem chi tiết</DropdownMenuItem><DropdownMenuItem onClick={onEdit}><Pencil/>Chỉnh sửa</DropdownMenuItem><DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2/>Xóa</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
