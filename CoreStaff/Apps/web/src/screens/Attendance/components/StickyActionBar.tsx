import * as React from 'react';

export interface StickyActionBarProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyActionBar({ children, className = '' }: StickyActionBarProps) {
  return (
    <div
      className={`fixed bottom-[60px] left-0 right-0 mx-auto z-20 w-full max-w-[480px] px-4 pt-3 pb-2.5 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none md:static md:max-w-none md:p-0 md:bg-transparent md:pointer-events-auto ${className}`}
    >
      <div className="pointer-events-auto flex flex-col gap-1.5 w-full">
        {children}
      </div>
    </div>
  );
}
