import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Skeleton } from "@/components/skeleton";

/* ─────────────────────────────────────────────────────────────────────────
   Shared presentational helpers for the two policy screens
   (Labor Compliance Policy + Overtime Pay Policy, TASK-036/037).
   Kept in one module so both screens stay pixel-consistent.
   ───────────────────────────────────────────────────────────────────────── */

/** Format an ISO/date string as dd/mm/yyyy; tolerant of missing/invalid input. */
export function formatPolicyDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

/** "01/01/2026 – Hiện tại" or "01/01/2026 – 30/06/2026". */
export function formatEffectiveRange(effectiveFrom: string, effectiveTo?: string | null): string {
  return `${formatPolicyDate(effectiveFrom)} → ${effectiveTo ? formatPolicyDate(effectiveTo) : "Hiện tại"}`;
}

/** Minutes → "480 phút" or "8 giờ" when divisible by 60. */
export function formatMinutes(minutes: number): string {
  const m = Number(minutes);
  if (!Number.isFinite(m)) return "—";
  if (m !== 0 && m % 60 === 0) return `${m / 60} giờ`;
  return `${m} phút`;
}

/** Rate multiplier → "x1.5" / "x2.0" / "x3.0". */
export function formatRate(rate: number): string {
  const r = Number(rate);
  if (!Number.isFinite(r)) return "—";
  return `x${r.toFixed(1)}`;
}

/** Status badge — reuses the exact WorkplaceScreen active/inactive styling. */
export function PolicyStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        active
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
      }
    >
      {active ? "Đang hiệu lực" : "Ngưng hiệu lực"}
    </Badge>
  );
}

/** Skeleton rows while the list is loading (mirrors WorkplaceScreen). */
export function PolicyLoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div
      className="space-y-4 p-4 sm:p-6"
      role="status"
      aria-label="Đang tải danh sách"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** "1–5 / 12" pagination footer with prev/next buttons. */
export function PolicyPaginationFooter({
  from,
  to,
  total,
  page,
  pages,
  onPrev,
  onNext,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4 sm:px-6">
      <p className="text-sm text-muted-foreground" role="status">
        {from}–{to} / {total} chính sách
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Trang trước"
          disabled={page === 1}
          onClick={onPrev}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="text-sm">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Trang sau"
          disabled={page === pages}
          onClick={onNext}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}