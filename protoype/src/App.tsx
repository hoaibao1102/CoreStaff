import React, { useEffect, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { HrApp } from './components/hr/HrViews';
import { LoginScreen } from './components/auth/LoginScreen';
import { EmployeeApp, EmployeeScenario } from './components/employee/EmployeeApp';
import { TeamView } from './components/approver/TeamView';
import { ApproverView } from './harness/ApproverView';
import { RejectModal, ClarificationModal, AdjustmentModal, PolicyModal } from './components/common/Modals';
import { useApprover } from './hooks/useApprover';
import { ApproverRequest, EmployeeProfile } from './types';
import { clearMockSession, loadMockSession, MockSession } from './services/authService';

import { TimeLockLogo } from './components/common/TimeLockLogo';


const SCENARIOS: Record<string, EmployeeScenario> = {
  'TVS-0248': { workMode: 'IN_OFFICE', method: 'GPS', label: 'Nhân viên A · Check-in/check-out bằng GPS hợp lệ' },
  'TVS-0312': { workMode: 'OUT_OFFICE', method: 'SELFIE', label: 'Nhân viên C · Làm ngoài văn phòng, bắt buộc Selfie + GPS' },
  'TVS-0102': { workMode: 'IN_OFFICE', method: 'NETWORK', label: 'Quản lý · Chấm công cá nhân bằng mạng văn phòng' },
};

type ManagerTab = 'APPROVALS' | 'TEAM' | 'MY_ATTENDANCE';

export default function App() {
  const [session, setSession] = useState<MockSession | null>(() => loadMockSession());
  if (!session) return <LoginScreen onLoggedIn={setSession} />;
  return <AuthenticatedApp session={session} onLogout={() => { clearMockSession(); setSession(null); }} />;
}

function AuthenticatedApp({ session, onLogout }: { session: MockSession; onLogout: () => void }) {

  return (
    <div className="min-h-screen bg-background">
      <ShellHeader session={session} onLogout={onLogout} />
      {session.user.role === 'ADMIN' ? <AdminDashboard />
        : session.user.role === 'HR' ? <HrApp />
          : session.user.role === 'APPROVER' ? <ApproverApp />
            : <EmployeeShell scenario={SCENARIOS[session.user.employeeCode] ?? SCENARIOS['TVS-0248']} />}
    </div>
  );
}

const EmployeeShell = ({ scenario }: { scenario: EmployeeScenario }) => {
  const [policy, setPolicy] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [clarify, setClarify] = useState(false);
  return (
    <>
      <EmployeeApp scenario={scenario} onOpenPolicy={() => setPolicy(true)} onOpenAdjustment={() => setAdjust(true)} onOpenClarification={() => setClarify(true)} />
      <PolicyModal isOpen={policy} onClose={() => setPolicy(false)} />
      <AdjustmentModal isOpen={adjust} onClose={() => setAdjust(false)} />
      <ClarificationModal isOpen={clarify} onClose={() => setClarify(false)} onConfirm={() => setClarify(false)} />
    </>
  );
};

function ApproverApp() {
  const approver = useApprover();
  const [selected, setSelected] = useState<ApproverRequest | null>(null);
  const [modal, setModal] = useState<'reject' | 'clarify' | null>(null);
  const [active, setActive] = useState<ApproverRequest | null>(null);

  useEffect(() => { approver.loadRequests(); }, []);

  const open = (type: 'reject' | 'clarify', req: ApproverRequest) => { setActive(req); setModal(type); };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Summary strip */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">Bảng duyệt</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">{approver.approverRequests.length} yêu cầu cần xử lý</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${approver.approverRequests.filter(r => r.status === 'PENDING').length > 0
            ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
            : 'bg-secondary-container text-on-secondary-container'
          }`}>
          {approver.approverRequests.filter(r => r.status === 'PENDING').length} chờ duyệt
        </span>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface shadow-sm overflow-hidden">
        <ApproverView
          requests={approver.approverRequests}
          selected={selected}
          onSelect={setSelected}
          onApprove={async req => { const updated = await approver.approve(req); if (updated) setSelected(updated); }}
          onOpenRejectModal={req => open('reject', req)}
          onOpenClarifyModal={req => open('clarify', req)}
        />
      </div>

      <RejectModal isOpen={modal === 'reject'} onClose={() => setModal(null)} employeeName={active?.employee.name} itemCode={active?.id}
        onConfirm={async reason => { if (active) await approver.reject(active.id, reason); setSelected(null); setModal(null); }} />
      <ClarificationModal isOpen={modal === 'clarify'} onClose={() => setModal(null)} employeeName={active?.employee.name}
        onConfirm={async msg => { if (active) await approver.clarify(active.id, msg); setSelected(null); setModal(null); }} />
    </main>
  );
}

const ShellHeader = ({ session, onLogout }: { session: MockSession; onLogout: () => void }) => (
  <header className="sticky top-0 z-50 border-b border-outline-variant/30 bg-surface/95 backdrop-blur-md">
    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <TimeLockLogo size={28} theme="dark" showTagline={false} />
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 text-sm font-medium text-on-surface-variant sm:flex">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{session.user.fullName}</span>
          <span className="text-outline">·</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${session.user.role === 'ADMIN' ? 'bg-error-container text-on-error-container'
              : session.user.role === 'HR' ? 'bg-secondary-container text-on-secondary-container'
                : session.user.role === 'APPROVER' ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-variant text-on-surface-variant'
            }`}>{session.user.role}</span>
        </span>
        <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 py-1.5 text-xs font-semibold text-on-surface-foreground hover:bg-surface-container-low transition-colors">
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </div>
  </header>
);


