import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/AuthLayout';

interface ForgotPasswordScreenProps {
  disabled?: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (email: string) => Promise<boolean>;
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/20';

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
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/50 p-4 text-sm leading-6 text-emerald-800">
          Yêu cầu đã được ghi nhận. Ở môi trường dev, liên kết reset được in trong console API.
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2">
            <span className="text-xs font-semibold text-foreground">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="hr-a@tvs.local"
              className={inputClass}
            />
          </label>

          {(localError || error) && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm font-semibold text-destructive" role="alert">
              {localError || error}
            </div>
          )}

          <button
            className="min-h-11 rounded-lg border-0 bg-primary font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
          >
            {disabled ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </form>
      )}

      <button
        type="button"
        className="mt-5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        onClick={onBack}
      >
        Quay lại đăng nhập
      </button>
    </AuthLayout>
  );
}
