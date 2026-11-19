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

    <div className="inline-flex w-full rounded-xl bg-muted p-1 sm:w-auto" role="tablist" aria-label="Công và lương của tôi" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : current === 0 ? 1 : 0;
      setTab(index === 0 ? 'timesheet' : 'payslip');
      buttons[index].focus();
    }}>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'timesheet'}
        id="compensation-timesheet-tab"
        aria-controls="compensation-panel"
        tabIndex={tab === 'timesheet' ? 0 : -1}
        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:min-w-44 ${tab === 'timesheet' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTab('timesheet')}
      >
        <CalendarCheck2 className="size-4" />Bảng công
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'payslip'}
        id="compensation-payslip-tab"
        aria-controls="compensation-panel"
        tabIndex={tab === 'payslip' ? 0 : -1}
        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:min-w-44 ${tab === 'payslip' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setTab('payslip')}
      >
        <WalletCards className="size-4" />Bảng lương
      </button>
    </div>

    <div role="tabpanel" id="compensation-panel" aria-labelledby={`compensation-${tab}-tab`} tabIndex={0}>
      {tab === 'timesheet'
        ? <EmployeeTimesheetReviewScreen apiBase={apiBase} embedded />
        : <MyPayslipsScreen apiBase={apiBase} embedded />}
    </div>
  </section>;
}
