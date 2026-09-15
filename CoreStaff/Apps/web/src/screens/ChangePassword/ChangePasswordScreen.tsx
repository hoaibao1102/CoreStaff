import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/AuthLayout';
import { AuthUser } from '../../services/auth';

interface ChangePasswordScreenProps {
  disabled?: boolean;
  error?: string | null;
  user: AuthUser;
  onLogout: () => void;
  onSubmit: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-[#cfd6e3] bg-white px-3.5 py-2.5 text-sm text-[#111827] outline-none transition placeholder:text-[#9aa4b2] hover:border-[#aeb8c8] focus:border-[#174ea6] focus:ring-3 focus:ring-[#174ea6]/15';

export function ChangePasswordScreen({ disabled = false, error, user, onLogout, onSubmit }: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLocalError('');
    await onSubmit(currentPassword, newPassword, confirmPassword);
  };

  return (
    <AuthLayout
      title="Đổi mật khẩu tạm thời"
      subtitle={`Xin chào ${user.fullName}. Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng CoreStaff.`}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-2">
          <span className="text-xs font-bold text-[#374151]">Mật khẩu hiện tại</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </label>

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

        <label className="grid gap-2">
          <span className="text-xs font-bold text-[#374151]">Xác nhận mật khẩu mới</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {disabled ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
        </button>

        <button
          type="button"
          className="justify-self-center text-xs font-bold text-[#174ea6] transition hover:text-[#0f3b82] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174ea6] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
          onClick={onLogout}
        >
          Đăng xuất
        </button>
      </form>
    </AuthLayout>
  );
}
