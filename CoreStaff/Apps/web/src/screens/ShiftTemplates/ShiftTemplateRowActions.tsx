import { useState } from 'react';
import { Eye,MoreHorizontal,Pencil,Power,PowerOff,Trash2 } from 'lucide-react';
import { Button } from '@/components/button';
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from '@/components/dialog';
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger } from '@/components/dropdown-menu';
import { toast } from '@/components/toast';
import type { Department } from '@/services/hrService';
import { deleteShiftTemplate,shiftTemplateErrorMessage,type ShiftTemplate } from '@/services/shift-template.service';
import { ShiftTemplateDetailDialog } from './ShiftTemplateDetailDialog';
import { ShiftTemplateEditDialog } from './ShiftTemplateEditDialog';
import { ShiftTemplateActivateDialog } from './ShiftTemplateActivateDialog';
import { ShiftTemplateDeactivateDialog } from './ShiftTemplateDeactivateDialog';

export function ShiftTemplateRowActions({apiBase,row,rows,departments,onChanged}:{apiBase:string;row:ShiftTemplate;rows:ShiftTemplate[];departments:Department[];onChanged:()=>void}){
 const[detail,setDetail]=useState(false),[edit,setEdit]=useState(false),[activate,setActivate]=useState(false),[deactivate,setDeactivate]=useState(false),[remove,setRemove]=useState(false),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 async function confirmDelete(){setDeleting(true);setDeleteError('');try{await deleteShiftTemplate(apiBase,row._id);toast.success('Đã xóa ca làm việc.');setRemove(false);onChanged()}catch(e){setDeleteError(shiftTemplateErrorMessage(e))}finally{setDeleting(false)}}
 return <><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="min-h-11 min-w-11"/>} aria-label="Mở thao tác ca làm việc"><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem className="min-h-10 px-3" onClick={()=>setDetail(true)}><Eye/>Xem chi tiết</DropdownMenuItem><DropdownMenuItem className="min-h-10 px-3" onClick={()=>setEdit(true)}><Pencil/>Chỉnh sửa</DropdownMenuItem>{row.active?<DropdownMenuItem className="min-h-10 px-3" onClick={()=>setDeactivate(true)}><PowerOff/>Ngưng hoạt động</DropdownMenuItem>:<DropdownMenuItem className="min-h-10 px-3 text-primary" onClick={()=>setActivate(true)}><Power/>Kích hoạt lại</DropdownMenuItem>}<DropdownMenuItem variant="destructive" className="min-h-10 px-3" onClick={()=>{setDeleteError('');setRemove(true)}}><Trash2/>Xóa ca</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
 <ShiftTemplateDetailDialog apiBase={apiBase} templateId={detail?row._id:null} departments={departments} open={detail} onOpenChange={setDetail}/>
 <ShiftTemplateEditDialog apiBase={apiBase} templateId={edit?row._id:null} departments={departments} rows={rows} open={edit} onOpenChange={setEdit} onSaved={onChanged}/>
 <ShiftTemplateActivateDialog apiBase={apiBase} templateId={activate?row._id:null} open={activate} onOpenChange={setActivate} onActivated={onChanged}/>
 <ShiftTemplateDeactivateDialog apiBase={apiBase} templateId={deactivate?row._id:null} open={deactivate} onOpenChange={setDeactivate} onDeactivated={onChanged}/>
 <Dialog open={remove} onOpenChange={v=>!deleting&&setRemove(v)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Xóa ca làm việc?</DialogTitle><DialogDescription>Ca “{row.name}” sẽ bị xóa vĩnh viễn. Ca đã được sử dụng sẽ không thể xóa.</DialogDescription></DialogHeader>{deleteError&&<p className="px-6 text-sm text-destructive">{deleteError}</p>}<div className="flex justify-end gap-3 px-6 pb-6"><Button variant="outline" onClick={()=>setRemove(false)}>Hủy</Button><Button variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting?'Đang xóa…':'Xóa ca'}</Button></div></DialogContent></Dialog></>
}
