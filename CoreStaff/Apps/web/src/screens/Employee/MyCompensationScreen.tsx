import { useState } from 'react';
import { CalendarCheck2, WalletCards } from 'lucide-react';
import { EmployeeTimesheetReviewScreen } from './EmployeeTimesheetReviewScreen';
import { MyPayslipsScreen } from './MyPayslipsScreen';

type CompensationTab = 'timesheet' | 'payslip';

export function MyCompensationScreen({
  apiBase,
  initialTab = 'timesheet',
}: {
  apiBase: string;
  initialTab?: CompensationTab;
}) {
  const [tab, setTab] = useState<CompensationTab>(initialTab);

  return <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Công &amp; Lương của tôi</h1>
      <p className="mt-2 text-sm text-muted-foreground">Theo dõi xuyên suốt từ xác nhận bảng công đến nhận phiếu lương.</p>
    </header>

    <div className="inline-flex w-full rounded-xl bg-muted p-1 sm:w-auto" role="tablist" aria-label="Công và lương của tôi">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'timesheet'}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors sm:min-w-44 ${tab === 'timesheet' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTab('timesheet')}
      >
        <CalendarCheck2 className="size-4" />Bảng công
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'payslip'}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors sm:min-w-44 ${tab === 'payslip' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTab('payslip')}
      >
        <WalletCards className="size-4" />Bảng lương
      </button>
    </div>

    <div role="tabpanel">
      {tab === 'timesheet'
        ? <EmployeeTimesheetReviewScreen apiBase={apiBase} embedded />
        : <MyPayslipsScreen apiBase={apiBase} embedded />}
    </div>
  </section>;
}
