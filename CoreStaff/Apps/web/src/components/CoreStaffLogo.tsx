interface CoreStaffLogoProps {
  compact?: boolean;
}

export function CoreStaffLogo({ compact = false }: CoreStaffLogoProps) {
  return (
    <div className="inline-flex items-center gap-3" aria-label="CoreStaff">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#174ea6] font-extrabold text-white shadow-sm">
        CS
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <strong className="text-lg tracking-normal text-[#111827]">CoreStaff</strong>
          <small className="mt-1 text-[11px] font-semibold uppercase leading-4 tracking-normal text-[#6b7280]">
            Workforce Management
          </small>
        </span>
      )}
    </div>
  );
}
