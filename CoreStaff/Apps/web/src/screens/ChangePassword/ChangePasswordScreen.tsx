import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  'min-h-11 w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/20';

const passwordPolicyPattern = /(?=.*[a-zA-Z])(?=.*\d)/;

interface PasswordFieldProps {
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}

function PasswordField({ label, value, visible, autoComplete, onChange, onToggle }: PasswordFieldProps) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div className="relative h-11">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-pressed={visible}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          onClick={onToggle}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </label>
  );
}

export function ChangePasswordScreen({ disabled = false, error, user, onLogout, onSubmit }: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (newPassword.length < 8 || !passwordPolicyPattern.test(newPassword)) {
      setLocalError('Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm ít nhất 1 chữ cái và 1 chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      setLocalError('Mật khẩu mới không được trùng mật khẩu hiện tại.');
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
        <PasswordField
          label="Mật khẩu hiện tại"
          value={currentPassword}
          visible={showCurrentPassword}
          autoComplete="current-password"
          onChange={setCurrentPassword}
          onToggle={() => setShowCurrentPassword((value) => !value)}
        />

        <PasswordField
          label="Mật khẩu mới"
          value={newPassword}
          visible={showNewPassword}
          autoComplete="new-password"
          onChange={setNewPassword}
          onToggle={() => setShowNewPassword((value) => !value)}
        />

        <PasswordField
          label="Xác nhận mật khẩu mới"
          value={confirmPassword}
          visible={showConfirmPassword}
          autoComplete="new-password"
          onChange={setConfirmPassword}
          onToggle={() => setShowConfirmPassword((value) => !value)}
        />

        <p className="text-xs leading-5 text-muted-foreground">
          Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm ít nhất 1 chữ cái và 1 chữ số.
        </p>

        {(localError || error) && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm font-semibold text-destructive" role="alert">
            {localError || error}
          </div>
        )}

        <button
          className="min-h-11 rounded-lg border-0 bg-primary font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
        >
          {disabled ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
        </button>

        <button
          type="button"
          className="justify-self-center text-xs font-semibold text-primary transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55"
          disabled={disabled}
          onClick={onLogout}
        >
          Đăng xuất
        </button>
      </form>
    </AuthLayout>
  );
}
