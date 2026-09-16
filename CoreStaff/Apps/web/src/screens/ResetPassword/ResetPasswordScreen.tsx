import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/AuthLayout';

interface ResetPasswordScreenProps {
  disabled?: boolean;
  error?: string | null;
  token: string;
  onBack: () => void;
  onSubmit: (token: string, newPassword: string) => Promise<boolean>;
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/20';

export function ResetPasswordScreen({ disabled = false, error, token, onBack, onSubmit }: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPassword) {
      setLocalError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    setLocalError('');
    const ok = await onSubmit(token, newPassword);
    if (ok) setDone(true);
  };

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      subtitle="Mật khẩu mới cần ít nhất 8 ký tự, bao gồm tối thiểu một chữ cái và một chữ số."
    >
      {done ? (
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-50/50 p-4 text-sm leading-6 text-emerald-800">
          Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại bằng mật khẩu mới.
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2">
            <span className="text-xs font-semibold text-foreground">Mật khẩu mới</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
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
            {disabled ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
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
