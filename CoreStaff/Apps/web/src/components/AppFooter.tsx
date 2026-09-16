interface AppFooterProps {
  apiBase: string | null;
  apiStatus: string;
  mongoStatus: string;
  timezone?: string;
}

export function AppFooter({ apiBase, apiStatus, mongoStatus, timezone }: AppFooterProps) {
  return (
    <footer className="border-t border-[#d9dee8] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-sm text-[#5c6170] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <strong className="block text-[#111827]">CoreStaff</strong>
          <span className="mt-1 block">Copyright {new Date().getFullYear()} CoreStaff. All rights reserved.</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-bold text-[#174ea6]">
            API: {apiStatus}
          </span>
          <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs font-bold text-[#5c6170]">
            MongoDB: {mongoStatus}
          </span>
          {timezone && (
            <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs font-bold text-[#5c6170]">
              {timezone}
            </span>
          )}
          {apiBase && <span className="sr-only">API base: {apiBase}</span>}
        </div>
      </div>
    </footer>
  );
}
