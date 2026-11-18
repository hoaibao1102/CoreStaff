import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { CalendarDays } from "lucide-react"
import { cn } from "cn"
import { parseDateVN } from "@/lib/datetime"

const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "date") return <DateInput className={className} {...props} />
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(INPUT_CLASS, className)}
      {...props}
    />
  )
}

/** "2027-02-05" -> "05/02/2027"; anything else -> "". */
function isoToDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ""
}

/** Progressive mask: "0502" -> "05/02", "05022027" -> "05/02/2027". */
function maskDigits(digits: string): string {
  const d = digits.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/**
 * Every date field in the system reads and is typed as dd/mm/yyyy, whatever the
 * browser language. The value that reaches `onChange` is still YYYY-MM-DD, taken
 * from a real change event on a hidden native date input, so call sites that
 * read `event.target.value` need no change. The calendar button opens the native
 * picker (honouring `min` / `max`).
 */
function DateInput({
  className, value, defaultValue, onChange, onBlur, min, max, disabled, readOnly, id, name, required,
  placeholder, ...rest
}: React.ComponentProps<"input">) {
  const nativeRef = React.useRef<HTMLInputElement>(null)
  const [uncontrolled, setUncontrolled] = React.useState(typeof defaultValue === "string" ? defaultValue : "")
  const isControlled = value !== undefined
  const iso = isControlled ? String(value ?? "") : uncontrolled
  const [draft, setDraft] = React.useState<string | null>(null)

  // A committed value from the parent always wins over half-typed text.
  React.useEffect(() => { setDraft(null) }, [iso])

  function commit(next: string) {
    const el = nativeRef.current
    if (!el) return
    // Go through the native setter so React sees a genuine input event.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
    setter?.call(el, next)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }

  function handleNativeChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!isControlled) setUncontrolled(event.target.value)
    onChange?.(event)
  }

  function handleText(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value
    if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) { setDraft(null); commit(text.trim()); return }
    const digits = text.replace(/\D/g, "")
    if (!digits) { setDraft(null); if (iso) commit(""); return }
    const masked = maskDigits(digits)
    setDraft(masked)
    const parsed = masked.length === 10 ? parseDateVN(masked) : null
    if (parsed) { setDraft(null); if (parsed !== iso) commit(parsed) }
  }

  function openPicker() {
    const el = nativeRef.current
    if (!el || disabled || readOnly) return
    if (typeof el.showPicker === "function") { try { el.showPicker(); return } catch { /* fall through */ } }
    el.focus(); el.click()
  }

  const shown = draft ?? isoToDisplay(iso)
  const incomplete = draft !== null && draft.length > 0

  return (
    <div className="relative w-full" data-slot="date-input">
      <InputPrimitive
        {...rest}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? "dd/mm/yyyy"}
        maxLength={10}
        value={shown}
        onChange={handleText}
        onBlur={event => { setDraft(null); onBlur?.(event) }}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={incomplete ? true : rest["aria-invalid"]}
        data-slot="input"
        className={cn(INPUT_CLASS, "pr-9", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Chọn ngày từ lịch"
        disabled={disabled || readOnly}
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={iso}
        min={min}
        max={max}
        disabled={disabled}
        onChange={handleNativeChange}
        className="pointer-events-none absolute right-0 bottom-0 size-0 opacity-0"
      />
    </div>
  )
}

export { Input }
