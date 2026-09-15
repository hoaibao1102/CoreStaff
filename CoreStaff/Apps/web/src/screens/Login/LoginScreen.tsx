import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';

interface LoginScreenProps {
  disabled?: boolean;
  error?: string | null;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
}

const inputClass =
  'h-11 w-full rounded-lg border border-[#cfd6e3] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9aa4b2] hover:border-[#aeb8c8] focus:border-[#174ea6] focus:ring-3 focus:ring-[#174ea6]/15';

export function LoginScreen({ disabled = false, error, onLogin, onForgotPassword }: LoginScreenProps) {
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
      </form>
    </AuthLayout>
  );
}
