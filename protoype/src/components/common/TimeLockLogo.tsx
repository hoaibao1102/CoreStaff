import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
  variant?: 'full' | 'horizontal' | 'icon' | 'badge';
  theme?: 'light' | 'dark' | 'auto';
  showTagline?: boolean;
}

/**
 * TimeLock Vector Icon
 * Matches the official logo: Blue clock dial, orange lock handle, dark blue hands & user silhouette.
 */
export const TimeLockIcon: React.FC<{ size?: number | string; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-sm ${className}`}
    >
      <defs>
        <linearGradient id="tlClockGrad" x1="20" y1="15" x2="80" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="tlOrangeGrad" x1="60" y1="35" x2="90" y2="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* Orange Lock Shackle/Handle on Right */}
      <path
        d="M 62 38 H 76 C 81 38 85 42 85 47 V 55 C 85 60 81 64 76 64 H 66"
        stroke="url(#tlOrangeGrad)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main Clock Circle */}
      <circle
        cx="47"
        cy="45"
        r="29"
        stroke="url(#tlClockGrad)"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Clock Tick Marks */}
      <circle cx="47" cy="22" r="1.8" fill="#2563EB" />
      <circle cx="24" cy="45" r="1.8" fill="#2563EB" />
      <circle cx="47" cy="68" r="1.8" fill="#2563EB" />

      {/* Clock Hands (Pointing ~ 10:10) */}
      <line
        x1="47"
        y1="45"
        x2="33"
        y2="33"
        stroke="#0F2850"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="47"
        y1="45"
        x2="63"
        y2="31"
        stroke="#0F2850"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Center Pivot */}
      <circle cx="47" cy="45" r="3.5" fill="#0F2850" />

      {/* Person Silhouette (Head & Torso in Front) */}
      <circle cx="63" cy="50" r="7.5" fill="#0F2850" />
      <path
        d="M 50 77 C 50 67 76 67 76 77 C 76 78 74 80 72 80 H 54 C 52 80 50 78 50 77 Z"
        fill="#0F2850"
      />
    </svg>
  );
};

/**
 * Keyhole 'O' for the Lock wordmark
 */
const KeyholeO: React.FC<{ color?: string }> = ({ color = '#2563EB' }) => (
  <span className="relative inline-flex items-center justify-center mx-[0.5px]">
    <span
      className="inline-block w-[0.8em] h-[0.8em] rounded-full border-[0.22em] border-current align-middle"
      style={{ borderColor: color }}
    />
    <span
      className="absolute w-[0.16em] h-[0.32em] bg-current rounded-full top-[50%] left-[50%] -translate-x-1/2 -translate-y-[20%]"
      style={{ backgroundColor: color }}
    />
  </span>
);

/**
 * Main TimeLock Logo with configurable layout and dark/light modes
 */
export const TimeLockLogo: React.FC<LogoProps> = ({
  className = '',
  size = 40,
  variant = 'horizontal',
  theme = 'auto',
  showTagline = true,
}) => {
  const isDark = theme === 'dark';

  if (variant === 'icon') {
    return <TimeLockIcon size={size} className={className} />;
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        <TimeLockIcon size={typeof size === 'number' ? size * 1.8 : 80} />
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-black tracking-tight leading-none flex items-center justify-center">
            <span className={isDark ? 'text-white' : 'text-[#0B2F64]'}>Time</span>
            <span className={isDark ? 'text-cyan-400' : 'text-[#1E60F6]'}>
              L
              <svg
                className="inline-block w-[0.72em] h-[0.72em] mx-[0.5px] -mt-1"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="4.5" />
                <circle cx="12" cy="10" r="2" fill="currentColor" />
                <path d="M11 10 L13 10 L13.5 15 L10.5 15 Z" fill="currentColor" />
              </svg>
              ck
            </span>
          </div>
          {showTagline && (
            <p
              className={`mt-1.5 text-xs font-medium tracking-wide ${
                isDark ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              Chấm công nhân viên • Hỗ trợ HR
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal layout
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <TimeLockIcon size={size} />
      <div className="flex flex-col justify-center">
        <div className="text-xl sm:text-2xl font-black tracking-tight leading-none flex items-center">
          <span className={isDark ? 'text-white' : 'text-[#0B2F64]'}>Time</span>
          <span className={isDark ? 'text-cyan-400' : 'text-[#1E60F6]'}>
            L
            <svg
              className="inline-block w-[0.72em] h-[0.72em] mx-[0.5px] -mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="4.5" />
              <circle cx="12" cy="10" r="2" fill="currentColor" />
              <path d="M11 10 L13 10 L13.5 15 L10.5 15 Z" fill="currentColor" />
            </svg>
            ck
          </span>
        </div>
        {showTagline && (
          <p
            className={`mt-1 text-[11px] font-medium tracking-tight ${
              isDark ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Chấm công nhân viên • Hỗ trợ HR
          </p>
        )}
      </div>
    </div>
  );
};
