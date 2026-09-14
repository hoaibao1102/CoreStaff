import React, { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import { AuthError, authenticateMockUser, MOCK_ACCOUNTS, MockSession } from '../../services/authService';
import { TimeLockLogo } from '../common/TimeLockLogo';

interface LoginScreenProps { onLoggedIn: (session: MockSession) => void; }

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoggedIn }) => {
  const [identifier, setIdentifier] = useState('TVS-0248');
  const [password, setPassword] = useState('Employee@123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) { setError('Vui lòng nhập tài khoản và mật khẩu.'); return; }
    setIsSubmitting(true); setError('');
    try { onLoggedIn(await authenticateMockUser(identifier, password)); }
    catch (reason) { setError(reason instanceof AuthError ? reason.message : 'Không thể đăng nhập. Vui lòng thử lại.'); }
    finally { setIsSubmitting(false); }
  };

  const useAccount = (index: number) => {
    const account = MOCK_ACCOUNTS[index];
    setIdentifier(account.employeeCode); setPassword(account.password); setError('');
  };

  return (
    <main className="min-h-screen bg-[#f4f5f8] flex">
      {/* Left panel — brand / info strip */}
      <aside className="hidden lg:flex w-96 flex-col justify-between border-r border-outline-variant/30 bg-surface px-10 py-8">
        <div>
          <TimeLockLogo size={40} theme="dark" showTagline />
          <div className="mt-12 space-y-6">
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
              Nền tảng ghi nhận thời gian làm việc.<br/>
              Chuẩn hóa quy trình chấm công cho doanh nghiệp.
            </p>
            <div className="space-y-4 mt-10">
              {[
                ['Phương thức chấm công', 'GPS · NETWORK · SELFIE', 'Mỗi phương thức có bằng chứng kiểm tra tự động'],
                ['Chu kỳ chốt công tháng', 'OPEN → CLOSED', 'Xác nhận phòng ban trước khi đóng kỳ'],
                ['Quản lý multi-tenant', 'M organization riêng', 'System Admin cấu hình hạ tầng'],
              ].map(([title, subtitle, desc]) => (
                <div key={title as string} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-bold text-on-surface">{title}</p>
                    <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-outline">© 2026 TimeLock · SWP391 Student Project</p>
      </aside>

      {/* Right panel — form card */}
      <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <TimeLockLogo size={36} theme="light" showTagline />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">Đăng nhập hệ thống</h1>
            <p className="mt-1.5 text-sm text-on-surface-variant">Sử dụng email hoặc mã nhân viên được cấp.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-on-surface">Email hoặc mã nhân viên</span>
              <input
                aria-label="Email hoặc mã nhân viên"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3.5 py-2.5 text-sm outline-none transition placeholder:text-outline hover:border-on-surface/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="VD: TVS-0248"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-on-surface">Mật khẩu</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-3 h-4 w-4 text-outline" />
                <input
                  aria-label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-outline-variant bg-surface pl-10 pr-11 py-2.5 text-sm outline-none transition placeholder:text-outline hover:border-on-surface/20 focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 rounded p-1 text-outline hover:bg-surface-container-low transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </label>

            {error && (
              <div role="alert" className="rounded-lg bg-error-container/50 px-3.5 py-2.5 text-sm font-medium text-on-error-container">
                {error}
              </div>
            )}

            <button
              disabled={isSubmitting}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white transition hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang xác thực...' : (
                <>Đăng nhập <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          {/* Quick-select accounts */}
          <div className="mt-8 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Tài khoản demo</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MOCK_ACCOUNTS.map((account, index) => (
                <button
                  key={account.id}
                  onClick={() => useAccount(index)}
                  className="rounded-lg border border-outline-variant/40 bg-surface px-2.5 py-2 text-left transition hover:border-outline-variant hover:bg-surface-container-low"
                >
                  <p className="text-[10px] font-semibold text-on-surface-variant">{account.role}</p>
                  <p className="mt-0.5 text-xs font-mono font-bold text-on-surface">{account.employeeCode}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-on-surface-variant">Chọn một vai trò để tự điền thông tin. Dữ liệu mock, không gửi tới máy chủ.</p>
          </div>
        </div>
      </section>
    </main>
  );
};
