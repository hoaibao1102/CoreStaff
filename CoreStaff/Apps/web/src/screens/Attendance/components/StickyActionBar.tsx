import * as React from 'react';

export interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyActionBar({ children, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`employee-sticky-action fixed left-0 right-0 mx-auto z-20 w-full max-w-[480px] px-4 pt-3 pb-2.5 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none lg:static lg:max-w-none lg:p-0 lg:bg-transparent lg:pointer-events-auto ${className}`}
    >
      <div className="pointer-events-auto flex flex-col gap-1.5 w-full">
        {children}
      </div>
    </div>
  );
}
