import React, { FormEvent, useState } from 'react';
import { ArrowRight, Clock3, Eye, EyeOff, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { AuthError, authenticateMockUser, MOCK_ACCOUNTS, MockSession } from '../../services/authService';

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
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950 lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#071c3b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#3b82f6_0,transparent_35%),radial-gradient(circle_at_90%_80%,#14b8a6_0,transparent_32%)]" />
        <div className="relative flex items-center gap-3"><BrandMark /><div><p className="text-xl font-black tracking-tight">TimeLock</p><p className="text-xs text-blue-200">Attendance & Workforce Control</p></div></div>
        <div className="relative max-w-xl">
          <span className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">Nền tảng chấm công hiện đại</span>
          <h1 className="text-5xl font-black leading-[1.08] tracking-[-.04em]">Minh bạch từng phút.<br/><span className="text-[#67e8f9]">Vững chắc mỗi kỳ công.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">Ghi nhận thời gian bằng Network, GPS hoặc Selfie; quản lý phê duyệt và chuẩn bị chốt công trên cùng một hệ thống.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[['Network & GPS', MapPin], ['Bằng chứng bảo mật', ShieldCheck], ['Giờ server', Clock3]].map(([label, Icon]) => <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[.07] p-4"><Icon className="mb-3 h-5 w-5 text-cyan-300"/><p className="text-xs font-semibold text-slate-100">{label as string}</p></div>)}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© 2026 TimeLock · SWP391 Student Project</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><BrandMark /><div><p className="text-lg font-black">TimeLock</p><p className="text-xs text-slate-500">Chấm công & chốt công</p></div></div>
          <p className="text-sm font-bold text-blue-700">CHÀO MỪNG TRỞ LẠI</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Đăng nhập hệ thống</h2>
          <p className="mt-2 text-sm text-slate-500">Sử dụng email hoặc mã nhân viên được cấp.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-bold">Email hoặc mã nhân viên</span><input aria-label="Email hoặc mã nhân viên" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100" placeholder="VD: TVS-0248" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold">Mật khẩu</span><span className="relative block"><LockKeyhole className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/><input aria-label="Mật khẩu" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-12 text-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"/><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">{showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}</button></span></label>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            <button disabled={isSubmitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3b8f] text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#092f72] disabled:opacity-60">{isSubmitting ? 'Đang xác thực...' : <>Đăng nhập <ArrowRight className="h-4 w-4"/></>}</button>
          </form>
          <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-black text-blue-900">TÀI KHOẢN DEMO</p><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{MOCK_ACCOUNTS.map((account, index) => <button key={account.id} onClick={() => useAccount(index)} className="rounded-xl border border-blue-100 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-sm"><span className="block text-[10px] font-black text-blue-700">{account.role}</span><span className="mt-1 block text-xs font-bold text-slate-800">{account.employeeCode}</span></button>)}</div><p className="mt-3 text-[11px] leading-5 text-slate-500">Chọn một vai trò để tự điền thông tin. Đây là dữ liệu mock, không gửi tới máy chủ.</p></div>
        </div>
      </section>
    </main>
  );
};

const BrandMark = () => <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-900/20"><Clock3 className="h-6 w-6"/></div>;
