import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/AuthLayout';

interface ForgotPasswordScreenProps {
  disabled?: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (email: string) => Promise<boolean>;
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-[#cfd6e3] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9aa4b2] hover:border-[#aeb8c8] focus:border-[#174ea6] focus:ring-3 focus:ring-[#174ea6]/15';

export function ForgotPasswordScreen({ disabled = false, error, onBack, onSubmit }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setLocalError('Vui lòng nhập email.');
      return;
    }

    setLocalError('');
    const ok = await onSubmit(email);
    if (ok) setSent(true);
  };

  return (
    <AuthLayout
      title="Khôi phục mật khẩu"
      subtitle="Nhập email tài khoản. Nếu thông tin hợp lệ, hệ thống sẽ tạo liên kết đặt lại mật khẩu."
    >
      {sent ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
          Yêu cầu đã được ghi nhận. Ở môi trường dev, liên kết reset được in trong console API.
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold text-[#374151]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="hr-a@tvs.local"
              className={inputClass}
            />
          </label>

          {(localError || error) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-800" role="alert">
              {localError || error}
            </div>
          )}

          <button
            className="min-h-11 rounded-lg border-0 bg-[#174ea6] font-bold text-white shadow-sm transition hover:bg-[#0f3b82] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
          >
            {disabled ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </form>
      )}

      <button
        type="button"
        className="mt-5 text-sm font-bold text-[#174ea6] hover:text-[#0f3b82]"
        onClick={onBack}
      >
        Quay lại đăng nhập
      </button>
    </AuthLayout>
  );
}
