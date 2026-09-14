/**
 * AdminDashboard.tsx — SYSTEM_ADMIN platform screens (multi-tenant control).
 *
 * S01: Organization list — platform KPIs, create/lock orgs (FR-SYS-01)
 * S02: Organization detail — provision first HR with a one-time temp password
 *      (FR-SYS-02), reset passwords + revoke sessions (§4.8), manual
 *      lock/unlock accounts (§4.7), platform audit.
 *
 * Per SRS the System Admin has NO business authority: no approval, no
 * period close, no attendance. Tenant user management belongs to HR.
 */
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  KeyRound,
  Link2Off,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
  Wifi,
  XCircle,
} from 'lucide-react';
import { Organization, PlatformUserAccount, Workplace } from '../../types';
import { AuditTimeline, EmptyState } from '../common/CommonStates';
import { useAdmin } from '../../hooks/useAdmin';
import { AdminError, type NewWorkplaceInput } from '../../services/adminService';

/** Color-safe badge for org status */
const OrgStatusBadge: React.FC<{ status: Organization['status'] }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${
    status === 'ACTIVE' ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'
  }`}>
    {status === 'ACTIVE' ? <Unlock className="w-3 h-3" /> : <LockKeyhole className="w-3 h-3" />}
    {status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
  </span>
);

/** Color-safe account status badge */
const AccountStatusBadge: React.FC<{ account: PlatformUserAccount }> = ({ account }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${
    account.status === 'ACTIVE' ? 'bg-success-container text-on-success-container'
      : account.status === 'LOCKED' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
      : 'bg-surface-variant text-on-surface-variant'
  }`}>
    {account.status === 'ACTIVE' ? 'ACTIVE' : account.status === 'LOCKED' ? 'LOCKED' : 'DISABLED'}
    {account.mustChangePassword && <span className="ml-1 px-1 rounded bg-primary-fixed text-on-primary-fixed">must-change</span>}
  </span>
);

/** All form values are strings; parsed on submit so typing feels natural. */
interface OrgForm {
  name: string;
  code: string;
  wpName: string;
  address: string;
  latitude: string;
  longitude: string;
  radius: string;
  accuracy: string;
  bssid: string;
  ssid: string;
}

const EMPTY_FORM: OrgForm = {
  name: '', code: '', wpName: '', address: '',
  latitude: '', longitude: '', radius: '100', accuracy: '80', bssid: '', ssid: '',
};

const formFromWorkplace = (wp: Workplace): OrgForm => ({
  name: '', code: '',
  wpName: wp.name, address: wp.address,
  latitude: String(wp.latitude), longitude: String(wp.longitude),
  radius: String(wp.allowedRadiusMeters), accuracy: String(wp.maximumAccuracyMeters),
  bssid: wp.networks[0]?.bssid ?? '', ssid: wp.networks[0]?.ssid ?? '',
});

type WpModal =
  | { mode: 'create' }                      // new tenant + its HQ
  | { mode: 'add'; orgId: string }          // first workplace for an existing tenant
  | { mode: 'edit'; orgId: string; wpId: string }
  | null;

const INPUT_CLS = 'w-full rounded-lg border border-outline bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-900';

export const AdminDashboard: React.FC<{ initialOrgId?: string }> = ({ initialOrgId }) => {
  const admin = useAdmin();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(initialOrgId ?? null);
  const [flash, setFlash] = useState<{ kind: 'error' | 'success' | 'password'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Modals (local inline JSX). One modal drives both create-org and edit-workplace.
  const [wpModal, setWpModal] = useState<WpModal>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);
  const [orgError, setOrgError] = useState('');
  const [showHrModal, setShowHrModal] = useState(false);
  const [hrForm, setHrForm] = useState({ fullName: '', email: '', employeeCode: '' });
  const [hrError, setHrError] = useState('');

  useEffect(() => {
    void admin.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      void admin.loadAccounts(selectedOrgId);
      void admin.loadWorkplaces(selectedOrgId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  const setField = (key: keyof OrgForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setOrgError('');
  };

  const selectedOrg = admin.organizations.find((o) => o.id === selectedOrgId) ?? null;

  /** Returns null on success, or the error message — callers use it to decide
   *  whether to close a modal (a failed submit must not wipe a filled form). */
  const run = async (fn: () => Promise<unknown>, successText?: string): Promise<string | null> => {
    setBusy(true);
    setFlash(null);
    try {
      await fn();
      if (successText) setFlash({ kind: 'success', text: successText });
      return null;
    } catch (err) {
      const message = err instanceof AdminError ? err.message : 'Có lỗi phát sinh, vui lòng thử lại.';
      setFlash({ kind: 'error', text: message });
      return message;
    } finally {
      setBusy(false);
    }
  };

  const numberField = (v: string) => Number(v.replace(',', '.'));

  /** Build the service payload from the string form; returns null + sets error on bad input. */
  const buildPayload = (): { workplace: NewWorkplaceInput } | null => {
    const lat = numberField(form.latitude);
    const lng = numberField(form.longitude);
    const radius = numberField(form.radius);
    const accuracy = numberField(form.accuracy);
    if (form.wpName.trim() && !form.address.trim()) { setOrgError('Địa chỉ văn phòng là bắt buộc.'); return null; }
    // Number('') === 0, so an empty coordinate would otherwise pass as the equator.
    if (!form.latitude.trim() || !form.longitude.trim()) { setOrgError('Vĩ độ và kinh độ là bắt buộc.'); return null; }
    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius) || Number.isNaN(accuracy)) {
      setOrgError('Tọa độ, bán kính và độ sai số phải là số.'); return null;
    }
    return { workplace: {
      name: form.wpName, address: form.address,
      latitude: lat, longitude: lng,
      allowedRadiusMeters: radius, maximumAccuracyMeters: accuracy,
      bssid: form.bssid, ssid: form.ssid || undefined,
    } };
  };

  const submitOrgForm = async () => {
    if (!wpModal) return;
    if (wpModal.mode === 'create') {
      if (!form.name.trim() || !form.code.trim()) { setOrgError('Tên và mã Organization là bắt buộc.'); return; }
    }
    const payload = buildPayload();
    if (!payload) return;
    setOrgError('');
    const err = wpModal.mode === 'create'
      ? await run(() => admin.createOrganization({ name: form.name, code: form.code, workplace: payload.workplace }))
      : wpModal.mode === 'add'
      ? await run(() => admin.addWorkplace(wpModal.orgId, payload.workplace))
      : await run(() => admin.updateWorkplace(wpModal.orgId, wpModal.wpId, {
          name: payload.workplace.name,
          address: payload.workplace.address,
          latitude: payload.workplace.latitude,
          longitude: payload.workplace.longitude,
          allowedRadiusMeters: payload.workplace.allowedRadiusMeters,
          maximumAccuracyMeters: payload.workplace.maximumAccuracyMeters,
          networks: [{ id: wpModal.wpId + '-net-1', name: 'Mạng văn phòng', ssid: payload.workplace.ssid, bssid: payload.workplace.bssid.toUpperCase(), active: true }],
        }));
    // Only close + reset on success — a validation throw must keep the form intact.
    if (err) { setOrgError(err); return; }
    setWpModal(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => { setForm(EMPTY_FORM); setOrgError(''); setFlash(null); setWpModal({ mode: 'create' }); };
  const openAdd = (orgId: string) => { setForm(EMPTY_FORM); setOrgError(''); setFlash(null); setWpModal({ mode: 'add', orgId }); };
  const openEdit = (wp: Workplace) => { setForm(formFromWorkplace(wp)); setOrgError(''); setFlash(null); setWpModal({ mode: 'edit', orgId: wp.organizationId, wpId: wp.id }); };
  const closeWpModal = () => { setWpModal(null); setOrgError(''); };

  const submitProvisionHr = async () => {
    if (!selectedOrg) return;
    if (!hrForm.fullName.trim() || !hrForm.email.trim() || !hrForm.employeeCode.trim()) {
      setHrError('Họ tên, email và mã nhân viên là bắt buộc.');
      return;
    }
    setHrError('');
    const err = await run(async () => {
      const { tempPassword } = await admin.provisionFirstHr(selectedOrg.id, hrForm.fullName, hrForm.email, hrForm.employeeCode);
      setFlash({ kind: 'password', text: `Cấp HR thành công — mật khẩu tạm thời (hiển thị một lần): ${tempPassword}` });
    });
    if (err) { setHrError(err); return; }
    setShowHrModal(false);
    setHrForm({ fullName: '', email: '', employeeCode: '' });
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      {selectedOrg ? (
        /* ---------------- S02 — Organization detail ---------------- */
        <div id="admin-org-detail-s02" className="space-y-6">
          {/* Header row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-outline-variant">
            <div className="flex items-center gap-3">
              <button id="btn-admin-back-to-orgs" type="button" onClick={() => setSelectedOrgId(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors">
                <ArrowLeft className="w-4 h-4" /> Danh sách Organization
              </button>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-on-surface">{selectedOrg.name}</h2>
                <p className="text-[11px] text-on-surface-variant font-mono">Mã tenant: {selectedOrg.code} · tạo {selectedOrg.createdAt}</p>
              </div>
              <OrgStatusBadge status={selectedOrg.status} />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy}
                onClick={() => run(
                  () => admin.setOrganizationStatus(selectedOrg.id, selectedOrg.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'),
                  selectedOrg.status === 'ACTIVE' ? 'Đã khóa tenant.' : 'Đã mở khóa tenant.',
                )}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  selectedOrg.status === 'ACTIVE'
                    ? 'border-error/30 text-error hover:bg-error-container/50'
                    : 'border-success/30 text-on-success-container hover:bg-success-container/50'
                }`}>
                {selectedOrg.status === 'ACTIVE' ? <><LockKeyhole className="w-3.5 h-3.5" /> Khóa tenant</> : <><Unlock className="w-3.5 h-3.5" /> Mở khóa tenant</>}
              </button>
              <button id="btn-admin-provision-hr" type="button" disabled={busy || selectedOrg.status === 'LOCKED'} onClick={() => setShowHrModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-40">
                <UserPlus className="w-3.5 h-3.5" /> Cấp HR đầu tiên
              </button>
            </div>
          </div>

          {/* Accounts table */}
          <div className="rounded-xl border border-outline-variant bg-surface shadow-card-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3">
              <h3 className="text-sm font-bold text-on-surface">Tài khoản trong tenant</h3>
              <span className="text-[11px] text-on-surface-variant">System Admin không quản lý nhân viên nghiệp vụ.</span>
            </div>
            {admin.accounts.length === 0 ? (
              <EmptyState title="Chưa có tài khoản" description="Cấp tài khoản HR đầu tiên để tenant bắt đầu." icon={<Building2 className="w-6 h-6" />} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Mã NV</th>
                      <th className="py-3 px-4">Họ tên / Email</th>
                      <th className="py-3 px-4">Vai trò</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Đăng nhập cuối</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {admin.accounts.map((acct) => (
                      <tr key={acct.id}>
                        <td className="py-3 px-4 font-mono font-bold text-primary">{acct.employeeCode}</td>
                        <td className="py-3 px-4"><p className="font-medium text-on-surface">{acct.fullName}</p><p className="text-[11px] text-on-surface-variant">{acct.email}</p></td>
                        <td className="py-3 px-4 text-on-surface-variant">{acct.role}</td>
                        <td className="py-3 px-4"><AccountStatusBadge account={acct} /></td>
                        <td className="py-3 px-4 text-on-surface-variant">{acct.lastLoginAt ?? '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" disabled={busy}
                              onClick={() => run(async () => { const { tempPassword } = await admin.resetPassword(acct.id); setFlash({ kind: 'password', text: `Mật khẩu tạm cho ${acct.fullName}: ${tempPassword}` }); })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-outline-variant/50 text-on-surface hover:bg-surface-container-low transition-colors">
                              <KeyRound className="w-3 h-3" /> Reset
                            </button>
                            {acct.status !== 'LOCKED' ? (
                              <button type="button" disabled={busy} onClick={() => run(() => admin.setAccountStatus(acct.id, 'LOCKED'), `Đã khóa ${acct.employeeCode}.`)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-error/30 text-error hover:bg-error-container/50 transition-colors">
                                <LockKeyhole className="w-3 h-3" /> Khóa
                              </button>
                            ) : (
                              <button type="button" disabled={busy} onClick={() => run(() => admin.setAccountStatus(acct.id, 'ACTIVE'), `Đã mở khóa ${acct.employeeCode}.`)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-success/30 text-on-success-container hover:bg-success-container/50 transition-colors">
                                <Unlock className="w-3 h-3" /> Mở khóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Workplace config */}
          <div className="rounded-xl border border-outline-variant bg-surface shadow-card-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3">
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Vị trí &amp; mạng chấm công</h3>
              {admin.workplaces.length > 0 && (
                <button id="btn-admin-edit-workplace" type="button" disabled={busy} onClick={() => openEdit(admin.workplaces[0])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant/50 text-on-surface hover:bg-surface-container-low transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Sửa vị trí
                </button>
              )}
            </div>
            {admin.workplaces.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-xs text-on-surface-variant leading-relaxed">Chưa cấu hình vị trí — nhân viên chỉ chấm công bằng Selfie.</p>
                <button type="button" disabled={busy} onClick={() => selectedOrgId && openAdd(selectedOrgId)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90">
                  <Plus className="w-3.5 h-3.5" /> Cấu hình vị trí
                </button>
              </div>
            ) : (
              admin.workplaces.map((wp) => (
                <div key={wp.id} className="px-5 py-4 space-y-4">
                  <div><p className="text-sm font-bold text-on-surface">{wp.name} <span className="font-mono text-[10px] text-on-surface-variant">{wp.code}</span></p><p className="text-[11px] text-on-surface-variant">{wp.address}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['geofence ±' + wp.allowedRadiusMeters + 'm', 'text-primary bg-primary-fixed'],
                      ['accuracy ≤ ' + wp.maximumAccuracyMeters + 'm', 'text-on-surface-variant bg-surface-container-low'],
                      ['lat ' + wp.latitude + ', lng ' + wp.longitude, 'text-on-surface-variant bg-surface-container-low'],
                    ].map(([label, cls]) => (
                      <span key={label as string} className={`px-2 py-1 rounded-md border border-outline-variant/40 font-mono text-[10px] ${cls}`}>{label as string}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wp.allowNetworkAttendance && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary-fixed-dim text-on-primary-fixed">NETWORK</span>}
                    {wp.allowGpsAttendance && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-success-container text-on-success-container">GPS</span>}
                    {wp.allowSelfieFallback && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-tertiary-fixed text-on-tertiary-fixed-variant">SELFIE fallback</span>}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 flex items-center gap-1"><Wifi className="w-3 h-3" /> BSSID</p>
                    <div className="flex flex-wrap gap-2">
                      {wp.networks.map((n) => (
                        <span key={n.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border font-mono text-[10px] ${n.active ? 'border-outline-variant/40 bg-surface-container-low text-on-surface' : 'border-outline-variant/40 bg-surface-variant text-outline line-through'}`}>
                          {n.ssid && <span className="font-sans font-bold">{n.ssid}</span>}{n.bssid}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Audit log */}
          <div className="rounded-xl border border-outline-variant bg-surface p-4 space-y-3">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Nhật ký nền tảng (tenant này)</h4>
            <AuditTimeline logs={admin.audit} />
          </div>

          {/* Provision HR modal */}
          {showHrModal && (
            <div id="admin-provision-hr-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-surface border border-outline-variant p-5 shadow-xl">
                <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
                  <UserPlus className="w-4.5 h-4.5 text-primary" />
                  <h3 className="text-sm font-bold text-on-surface">C cấp HR đầu tiên · {selectedOrg.name}</h3>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-3">Hệ thống sinh tài khoản ACTIVE với mật khẩu tạm, buộc đổi ở lần đăng nhập đầu.</p>
                {(['fullName', 'email', 'employeeCode'] as const).map((field) => (
                  <label key={field} className="block mt-3">
                    <span className="mb-1 block text-xs font-bold text-on-surface">{field === 'fullName' ? 'Họ tên' : field === 'email' ? 'Email' : 'Mã nhân viên'}</span>
                    <input value={hrForm[field]} onChange={(e) => setHrForm((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder={field === 'employeeCode' ? 'TVS-0009' : field === 'email' ? 'hr@company.vn' : 'Nguyễn Thị H.'}
                      className="w-full rounded-lg border border-outline bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40" />
                  </label>
                ))}
                {hrError && <p className="mt-2 text-[11px] font-semibold text-error">{hrError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowHrModal(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant/50 hover:bg-surface-container-low">Hủy</button>
                  <button type="button" onClick={submitProvisionHr} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90">Cấp tài khoản</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ---------------- S01 — Organization list ---------------- */
        <div id="admin-org-list-s01" className="space-y-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-outline-variant">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-on-surface">Quản trị nền tảng</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary-container/80 text-on-primary-container">
                  <ShieldCheck className="w-3 h-3" /> System Admin
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">Tạo / khóa Organization và cấp HR đầu tiên. Không tham gia nghiệp vụ chấm công.</p>
            </div>
            <button id="btn-admin-create-org" type="button" onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 self-start">
              <Plus className="w-4 h-4" /> Tạo Organization
            </button>
          </div>

          {/* Summary stat strip — replaces 3-col card grid */}
          <div className="flex items-stretch gap-4 overflow-x-auto pb-1">
            {[
              ['Tổng Organization', String(admin.organizations.length)],
              ['Đang hoạt động', String(admin.organizations.filter(o => o.status === 'ACTIVE').length)],
              ['Tổng tài khoản', String(admin.organizations.reduce((n, o) => n + o.userCount, 0))],
            ].map(([label, value]) => (
              <div key={label} className="flex-1 min-w-[140px] rounded-xl border border-outline-variant bg-surface px-4 py-3 shadow-card-sm">
                <p className="text-[11px] text-on-surface-foreground">{label}</p>
                <p className="mt-0.5 text-2xl font-bold font-mono text-on-surface">{value}</p>
              </div>
            ))}
          </div>

          {/* Tenant list table */}
          <div className="rounded-xl border border-outline-variant bg-surface shadow-card-sm overflow-hidden">
            <div className="border-b border-outline-variant px-5 py-3"><h3 className="text-sm font-bold text-on-surface">Danh sách tenant</h3></div>
            {admin.organizations.length === 0 ? (
              <EmptyState title="Chưa có Organization" description="Tạo Organization đầu tiên để bắt đầu." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Tài khoản</th>
                      <th className="py-3 px-4">Ngày tạo</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {admin.organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-surface-container-low/70 transition-colors cursor-pointer" onClick={() => setSelectedOrgId(org.id)}>
                        <td className="py-3.5 px-4"><p className="font-medium text-on-surface">{org.name}</p><p className="text-[11px] text-on-surface-variant font-mono">{org.code}</p></td>
                        <td className="py-3.5 px-4"><OrgStatusBadge status={org.status} /></td>
                        <td className="py-3.5 px-4 font-mono text-on-surface">{org.userCount}</td>
                        <td className="py-3.5 px-4 text-on-surface-variant">{org.createdAt}</td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => setSelectedOrgId(org.id)} className="px-2.5 py-1 text-xs font-semibold rounded-md border border-outline-variant/50 text-on-surface bg-surface-container-low hover:bg-surface-container transition-colors">Xem</button>
                            {org.status === 'ACTIVE' ? (
                              <button type="button" disabled={busy} onClick={() => run(() => admin.setOrganizationStatus(org.id, 'LOCKED'), `Đã khóa ${org.name}.`)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-error/30 text-error hover:bg-error-container/50 transition-colors">
                                <Link2Off className="w-3 h-3" /> Khóa
                              </button>
                            ) : (
                              <button type="button" disabled={busy} onClick={() => run(() => admin.setOrganizationStatus(org.id, 'ACTIVE'), `Đã mở khóa ${org.name}.`)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border border-success/30 text-on-success-container hover:bg-success-container/50 transition-colors">
                                <Unlock className="w-3 h-3" /> Mở khóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Platform audit */}
          <div className="rounded-xl border border-outline-variant bg-surface p-4 space-y-3">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Nhật ký nền tảng</h4>
            <AuditTimeline logs={admin.audit} />
          </div>
        </div>
      )}

      {/* Organization + Workplace modal — shared by S01/S02 */}
      {wpModal && (() => {
        const isCreate = wpModal.mode === 'create';
        const isEdit = wpModal.mode === 'edit';
        const heading = isCreate ? 'Tạo Organization mới'
          : `${isEdit ? 'Cập nhật' : 'Thêm'} vị trí làm việc · ${selectedOrg?.name ?? ''}`;
        return (
        <div id="admin-workplace-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-surface border border-outline-variant p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div className="flex items-center gap-2"><Building2 className="w-4.5 h-4.5 text-primary" /><h3 className="text-sm font-bold text-on-surface">{heading}</h3></div>
              <button type="button" onClick={closeWpModal} className="p-1.5 rounded-lg text-outline hover:bg-surface-container-low transition-colors"><XCircle className="w-4 h-4" /></button>
            </div>

            {isCreate && (
              <fieldset className="mt-3">
                <legend className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">1 · Organization</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-on-surface">Tên Organization</span>
                    <input value={form.name} onChange={setField('name')} placeholder="VD: Công ty TNHH Minh An" className={INPUT_CLS} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-on-surface">Mã tenant (duy nhất)</span>
                    <input value={form.code} onChange={setField('code')} placeholder="VD: MAN" maxLength={10} className={`${INPUT_CLS} font-mono`} />
                  </label>
                </div>
              </fieldset>
            )}

            <fieldset className="mt-4">
              <legend className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                {isCreate ? '2 · Vị trí làm việc (HQ)' : 'Vị trí làm việc'}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Tên văn phòng</span>
                  <input value={form.wpName} onChange={setField('wpName')} placeholder="Văn phòng Quận 8" className={INPUT_CLS} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Địa chỉ</span>
                  <input value={form.address} onChange={setField('address')} placeholder="123 đường mẫu, Quận 8, TP.HCM" className={INPUT_CLS} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Vĩ độ <span className="font-normal text-on-surface-variant">[-90, 90]</span></span>
                  <input value={form.latitude} onChange={setField('latitude')} placeholder="10.7512" inputMode="decimal" className={`${INPUT_CLS} font-mono`} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Kinh độ <span className="font-normal text-on-surface-variant">[-180, 180]</span></span>
                  <input value={form.longitude} onChange={setField('longitude')} placeholder="106.6974" inputMode="decimal" className={`${INPUT_CLS} font-mono`} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Bán kính cho phép (m)</span>
                  <input value={form.radius} onChange={setField('radius')} inputMode="numeric" className={`${INPUT_CLS} font-mono`} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">Sai số GPS tối đa (m)</span>
                  <input value={form.accuracy} onChange={setField('accuracy')} inputMode="numeric" className={`${INPUT_CLS} font-mono`} />
                </label>
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                {isCreate ? '3 · Chữ ký mạng (BSSID)' : 'Chữ ký mạng (BSSID)'}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">BSSID router <span className="font-normal text-error">*</span></span>
                  <input value={form.bssid} onChange={setField('bssid')} placeholder="AA:BB:CC:DD:EE:01" className={`${INPUT_CLS} font-mono uppercase`} />
                  <span className="mt-1 block text-[10px] text-on-surface-variant">Địa chỉ MAC của router, định dạng 6 cặp hex phân cách bởi ':'. Backend đối chiếu giá trị này với BSSID thiết bị quét được.</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-on-surface">SSID <span className="font-normal text-on-surface-variant">(tùy chọn, hiển thị)</span></span>
                  <input value={form.ssid} onChange={setField('ssid')} placeholder="TVS_OFFICE_Q8" className={`${INPUT_CLS} font-mono`} />
                </label>
              </div>
              <p className="mt-2 text-[10px] text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-lg p-2 leading-relaxed">
                ⚠️ Browser không đọc được BSSID — bản production cần wrapper native (WiFi scan). Prototype giả lập bằng bộ chọn WiFi trong Simulation Sandbox.
              </p>
            </fieldset>

            {orgError && <p className="mt-3 text-[11px] font-semibold text-error">{orgError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeWpModal} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-outline-variant/50 hover:bg-surface-container-low">Hủy</button>
              <button type="button" disabled={busy} onClick={submitOrgForm} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-40">
                {busy ? 'Đang lưu…' : isCreate ? 'Tạo Organization' : isEdit ? 'Lưu thay đổi' : 'Thêm vị trí'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </main>
  );
};
