import { hrRequest, mapHrError } from './hrService';

export type ShiftScope = 'ORGANIZATION' | 'DEPARTMENT';
export interface ShiftTemplate { _id:string; organizationId?:string; scope:ShiftScope; departmentId?:string; weekdays:number[]; effectiveFrom:string; effectiveTo?:string; code?:string; name?:string; startTime:string; endTime:string; breakMinutes:number; gracePeriodMinutes:number; active:boolean; createdAt?:string; updatedAt?:string }
export interface CreateShiftTemplatePayload { scope:ShiftScope; departmentId?:string; weekdays:number[]; effectiveFrom:string; effectiveTo?:string; name:string; startTime:string; endTime:string; breakMinutes?:number; gracePeriodMinutes?:number }
export type UpdateShiftTemplatePayload = Partial<CreateShiftTemplatePayload>;
export interface ShiftTemplateFilters { scope?:ShiftScope; departmentId?:string; active?:boolean }

const idPath = (id:string) => `/api/hr/shift-templates/${encodeURIComponent(id)}`;
export function getShiftTemplates(base:string, filters:ShiftTemplateFilters={}) { const q=new URLSearchParams(); if(filters.scope)q.set('scope',filters.scope); if(filters.departmentId)q.set('departmentId',filters.departmentId); if(filters.active!==undefined)q.set('active',String(filters.active)); return hrRequest<ShiftTemplate[]>(base,`/api/hr/shift-templates${q.size?`?${q}`:''}`); }
export function getShiftTemplateById(base:string,id:string) { return hrRequest<ShiftTemplate>(base,idPath(id)); }
export function createShiftTemplate(base:string,payload:CreateShiftTemplatePayload) { return hrRequest<ShiftTemplate>(base,'/api/hr/shift-templates',{method:'POST',body:JSON.stringify(payload)}); }
export function updateShiftTemplate(base:string,id:string,payload:UpdateShiftTemplatePayload) { return hrRequest<ShiftTemplate>(base,idPath(id),{method:'PATCH',body:JSON.stringify(payload)}); }
export function activateShiftTemplate(base:string,id:string) { return hrRequest<ShiftTemplate>(base,`${idPath(id)}/activate`,{method:'PATCH'}); }
export function deactivateShiftTemplate(base:string,id:string) { return hrRequest<ShiftTemplate>(base,`${idPath(id)}/deactivate`,{method:'PATCH'}); }
export function deleteShiftTemplate(base:string,id:string) { return hrRequest<{id:string}>(base,idPath(id),{method:'DELETE'}); }

export function shiftTemplateErrorMessage(error:unknown) {
  const code=(error as {code?:string}|null)?.code;
  const details=(error as {details?:{usedMinutes?:number;limitMinutes?:number}}|null)?.details;
  if ((code==='SHIFT_DAILY_LABOR_LIMIT_EXCEEDED'||code==='SHIFT_WEEKLY_LABOR_LIMIT_EXCEEDED') &&
    typeof details?.usedMinutes==='number' && typeof details.limitMinutes==='number') {
    const duration=(minutes:number)=>[Math.floor(minutes/60)?`${Math.floor(minutes/60)} tiếng`:'',minutes%60?`${minutes%60} phút`:''].filter(Boolean).join(' ')||'0 phút';
    const period=code==='SHIFT_WEEKLY_LABOR_LIMIT_EXCEEDED'?'tuần':'ngày';
    return `Giờ làm mỗi ${period} là ${duration(details.usedMinutes)}, vượt quá ${duration(details.usedMinutes-details.limitMinutes)} so với giới hạn ${duration(details.limitMinutes)} của Chính sách tuân thủ lao động (đã trừ thời gian nghỉ).`;
  }
  const messages:Record<string,string>={
    SHIFT_LABOR_POLICY_COVERAGE_MISSING:'Chính sách tuân thủ lao động chưa bao phủ toàn bộ thời gian áp dụng ca. Hãy điều chỉnh ngày kết thúc ca hoặc bổ sung chính sách.',
    LABOR_POLICY_NOT_FOUND:'Chưa có Chính sách tuân thủ lao động có hiệu lực tại ngày bắt đầu ca. Vui lòng cấu hình chính sách trước.',
    SHIFT_BREAK_DURATION_INVALID:'Thời gian nghỉ phải không âm và nhỏ hơn tổng thời gian của ca.',
    SHIFT_DAILY_LABOR_LIMIT_EXCEEDED:'Số giờ làm mỗi ngày (đã trừ giờ nghỉ) vượt giới hạn trong Chính sách tuân thủ lao động áp dụng cho ca.',
    SHIFT_WEEKLY_LABOR_LIMIT_EXCEEDED:'Tổng giờ làm theo các ngày lặp trong tuần vượt giới hạn trong Chính sách tuân thủ lao động. Hãy giảm giờ làm hoặc số ngày lặp.',
    SHIFT_TEMPLATE_CODE_TAKEN:'Mã ca đã tồn tại trong tổ chức.',
    SHIFT_NAME_REQUIRED:'Vui lòng nhập tên ca.',
    SHIFT_START_TIME_MUST_BE_BEFORE_END:'Giờ bắt đầu phải trước giờ kết thúc.',
    SHIFT_DEPARTMENT_REQUIRED:'Vui lòng chọn phòng ban.',
    SHIFT_DEPARTMENT_NOT_FOUND_OR_INACTIVE:'Phòng ban không tồn tại hoặc đã ngưng hoạt động.',
    SHIFT_WEEKDAYS_INVALID:'Vui lòng chọn ít nhất một ngày lặp hợp lệ.',
    SHIFT_EFFECTIVE_RANGE_INVALID:'Khoảng hiệu lực không hợp lệ.',
    SHIFT_SCOPE_SCHEDULE_OVERLAP:'Đã có ca hoạt động trùng lịch trong phạm vi này.',
    SHIFT_TEMPLATE_NOT_FOUND:'Không tìm thấy ca làm việc.',
    SHIFT_DEPARTMENT_ALREADY_ASSIGNED:'Phòng ban này đã có ca làm việc.',
    SHIFT_ORGANIZATION_ALREADY_ASSIGNED:'Công ty đã có ca làm việc áp dụng toàn bộ.',
    SHIFT_TEMPLATE_IN_USE:'Không thể xóa ca đã được phân công hoặc đã phát sinh chấm công.',
  };
  return (code&&messages[code])||mapHrError(code,'Không thể thực hiện thao tác. Vui lòng thử lại.');
}
