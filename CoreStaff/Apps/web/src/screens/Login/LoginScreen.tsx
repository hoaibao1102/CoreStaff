import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';

interface LoginScreenProps {
  disabled?: boolean;
  error?: string | null;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
  onGmailLogin: () => void;
}

const inputClass =
  'h-11 w-full rounded-lg border border-[#cfd6e3] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9aa4b2] hover:border-[#aeb8c8] focus:border-[#174ea6] focus:ring-3 focus:ring-[#174ea6]/15';

export function LoginScreen({ disabled = false, error, onLogin, onForgotPassword, onGmailLogin }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setLocalError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    setLocalError('');
    await onLogin(identifier, password);
  };

  return (
    <AuthLayout
      title="Đăng nhập CoreStaff"
      subtitle="Sử dụng email hoặc mã nhân viên được cấp để truy cập hệ thống."
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-2">
          <span className="text-xs font-bold text-[#374151]">Email hoặc mã nhân viên</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="email công ty hoặc mã nhân viên"
            className={inputClass}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold text-[#374151]">Mật khẩu</span>
          <div className="relative h-11">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[#667085] transition hover:bg-[#f3f6fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174ea6]"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </label>

        {(localError || error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-800" role="alert">
            {localError || error}
          </div>
        )}

        <button
          className="mt-1 min-h-11 rounded-lg border-0 bg-[#174ea6] font-bold text-white shadow-sm transition hover:bg-[#0f3b82] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
        >
          {disabled ? 'Đang xác thực...' : 'Đăng nhập'}
        </button>

        <button
          type="button"
          className="justify-self-center text-xs font-bold text-[#174ea6] transition hover:text-[#0f3b82] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174ea6]"
          onClick={onForgotPassword}
        >
          Quên mật khẩu?
        </button>

        <div className="flex items-center gap-3 text-xs font-semibold text-[#98a2b3]">
          <span className="h-px flex-1 bg-[#e4e7ec]" />
          <span>hoặc</span>
          <span className="h-px flex-1 bg-[#e4e7ec]" />
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg border border-[#cfd6e3] bg-white px-4 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#aeb8c8] hover:bg-[#f9fafb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174ea6] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
          onClick={onGmailLogin}
        >
          <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.43Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.34l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.4 13.97a6 6 0 0 1 0-3.94V7.44H3.06a10 10 0 0 0 0 9.12l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.9c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 2.93 14.7 2 12 2a10 10 0 0 0-8.94 5.44l3.34 2.59C7.19 7.66 9.4 5.9 12 5.9Z" />
          </svg>
          Tiếp tục với Gmail
        </button>
      </form>
    </AuthLayout>
  );
}
