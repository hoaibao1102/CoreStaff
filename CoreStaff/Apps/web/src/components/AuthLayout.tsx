import { ReactNode } from 'react';
import { CoreStaffLogo } from './CoreStaffLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f8fa] text-[#172033]">
      <header className="shrink-0 border-b border-[#e4e7ec] bg-white">
        <div className="flex min-h-20 items-center px-5 py-4 sm:px-8 lg:px-12">
          <CoreStaffLogo />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <section aria-labelledby="auth-title" className="w-full max-w-[440px] rounded-lg border border-[#e4e7ec] bg-white p-6 shadow-[0_4px_20px_rgba(17,24,39,0.04)] sm:p-8">
          <div className="mb-8">
            <h1 id="auth-title" className="m-0 text-2xl font-semibold leading-8 tracking-normal text-[#111827]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#667085]">{subtitle}</p>
          </div>
          {children}
        </section>
      </main>

      <footer className="shrink-0 px-4 pb-6 text-center text-xs leading-5 text-[#667085]">
        {footer ?? `© ${new Date().getFullYear()} CoreStaff`}
      </footer>
    </div>
  );
}
