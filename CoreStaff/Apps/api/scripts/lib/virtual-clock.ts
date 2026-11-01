/**
 * Virtual wall clock for demo seeding.
 *
 * The seed drives the real services (OT filing, leave approval, period close,
 * payroll...). They stamp `new Date()` on every decision and also validate
 * "is this date in the past/future" against it, so replaying September at
 * the real current time would produce a history where every approval happened
 * today. Installing this before the services run makes `new Date()` and
 * `Date.now()` read a chosen instant instead, which then keeps ticking in real
 * time so durations measured inside one action stay meaningful.
 *
 * Only argument-less construction and `Date.now()` move; `new Date(value)`,
 * `Date.UTC`, parsing and `instanceof Date` behave exactly as before because
 * the global is a Proxy over the real constructor. The MongoDB driver measures
 * timeouts with `process.hrtime`, so it is unaffected.
 */
const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
let offsetMs = 0;
let installed = false;

export function installVirtualClock(): void {
  if (installed) return;
  installed = true;
  RealDate.now = () => realNow() + offsetMs;
  (globalThis as any).Date = new Proxy(RealDate, {
    construct(target, args, newTarget) {
      return args.length === 0
        ? Reflect.construct(target, [target.now()], newTarget)
        : Reflect.construct(target, args, newTarget);
    },
    apply(target) {
      // `Date()` called as a function returns the current time as a string.
      return new target(target.now()).toString();
    },
  });
}

/** Move the clock so "now" reads `instant` (it keeps ticking from there). */
export function setVirtualNow(instant: Date | number): void {
  offsetMs = (typeof instant === 'number' ? instant : instant.getTime()) - realNow();
}

/** Return to real time; later `setVirtualNow` calls still work. */
export function resetVirtualClock(): void {
  offsetMs = 0;
}

/** `YYYY-MM-DD` + `HH:mm[:ss]` read as Vietnam wall clock (UTC+7, no DST). */
export function vnInstant(date: string, time = '00:00:00'): Date {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new RealDate(`${date}T${normalized}+07:00`);
}
