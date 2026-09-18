import { Eye, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import type { Workplace } from "@/services/workplace.service";
import type { ShiftTemplate } from "@/services/shift-template.service";
import { ShiftTemplateDetailDialog } from "./ShiftTemplateDetailDialog";
import { ShiftTemplateEditDialog } from "./ShiftTemplateEditDialog";
import { ShiftTemplateActivateDialog } from "./ShiftTemplateActivateDialog";
import { ShiftTemplateDeactivateDialog } from "./ShiftTemplateDeactivateDialog";
import { useState } from "react";

export function ShiftTemplateRowActions({
  apiBase,
  row,
  workplaces,
  onChanged,
}: {
  apiBase: string;
  row: ShiftTemplate;
  workplaces: Workplace[];
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState(false),
    [edit, setEdit] = useState(false),
    [activate, setActivate] = useState(false),
    [deactivate, setDeactivate] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" />
          }
          aria-label={`Mở thao tác ca làm việc`}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="min-h-10 px-3"
            onClick={() => setDetail(true)}
          >
            <Eye />
            Xem chi tiết
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 px-3"
            onClick={() => setEdit(true)}
          >
            <Pencil />
            Chỉnh sửa
          </DropdownMenuItem>
          {row.active ? (
            <DropdownMenuItem
              variant="destructive"
              className="min-h-10 px-3"
              onClick={() => setDeactivate(true)}
            >
              <PowerOff />
              Ngưng hoạt động
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="min-h-10 px-3 text-primary"
              onClick={() => setActivate(true)}
            >
              <Power />
              Kích hoạt lại
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ShiftTemplateDetailDialog
        apiBase={apiBase}
        templateId={detail ? row._id : null}
        workplaces={workplaces}
        open={detail}
        onOpenChange={setDetail}
      />
      <ShiftTemplateEditDialog
        apiBase={apiBase}
        templateId={edit ? row._id : null}
        workplaces={workplaces}
        open={edit}
        onOpenChange={setEdit}
        onSaved={onChanged}
      />
      <ShiftTemplateActivateDialog
        apiBase={apiBase}
        templateId={activate ? row._id : null}
        open={activate}
        onOpenChange={setActivate}
        onActivated={onChanged}
      />
      <ShiftTemplateDeactivateDialog
        apiBase={apiBase}
        templateId={deactivate ? row._id : null}
        open={deactivate}
        onOpenChange={setDeactivate}
        onDeactivated={onChanged}
      />
    </>
  );
}
