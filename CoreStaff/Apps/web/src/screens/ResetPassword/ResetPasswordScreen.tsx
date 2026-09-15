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
  'min-h-11 w-full rounded-lg border border-[#cfd6e3] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9aa4b2] hover:border-[#aeb8c8] focus:border-[#174ea6] focus:ring-3 focus:ring-[#174ea6]/15';

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
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
          Mật khẩu đã được đặt lại. Vui lòng đăng nhập lại bằng mật khẩu mới.
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold text-[#374151]">Mật khẩu mới</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
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
            {disabled ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
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
