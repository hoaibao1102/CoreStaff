import React, { useEffect, useState } from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { HrApp } from './components/hr/HrViews';
import { LoginScreen } from './components/auth/LoginScreen';
import { EmployeeApp, EmployeeScenario } from './components/employee/EmployeeApp';
import { ApproverView } from './harness/ApproverView';
import { RejectModal, ClarificationModal, AdjustmentModal, PolicyModal } from './components/common/Modals';
import { useApprover } from './hooks/useApprover';
import { ApproverRequest } from './types';
import { clearMockSession, loadMockSession, MockSession } from './services/authService';
import { TimeLockLogo } from './components/common/TimeLockLogo';

const SCENARIOS: Record<string, EmployeeScenario> = {
  'TVS-0248': { workMode: 'IN_OFFICE', method: 'GPS', label: 'Nhân viên A · Check-in/check-out bằng GPS hợp lệ' },
  'TVS-0312': { workMode: 'OUT_OFFICE', method: 'SELFIE', label: 'Nhân viên C · Làm ngoài văn phòng, bắt buộc Selfie + GPS' },
};

export default function App() {
  const [session, setSession] = useState<MockSession | null>(() => loadMockSession());
  if (!session) return <LoginScreen onLoggedIn={setSession} />;
  return <AuthenticatedApp session={session} onLogout={() => { clearMockSession(); setSession(null); }} />;
}

function AuthenticatedApp({ session, onLogout }: { session: MockSession; onLogout: () => void }) {
  return <div className="min-h-screen bg-[#f5f7fb]"><AppHeader session={session} onLogout={onLogout}/>{session.user.role === 'ADMIN' ? <AdminDashboard/> : session.user.role === 'HR' ? <HrApp/> : session.user.role === 'APPROVER' ? <ApproverApp/> : <EmployeeShell scenario={SCENARIOS[session.user.employeeCode] ?? SCENARIOS['TVS-0248']}/>}</div>;
}

const EmployeeShell=({scenario}:{scenario:EmployeeScenario})=>{const [policy,setPolicy]=useState(false);const [adjust,setAdjust]=useState(false);const [clarify,setClarify]=useState(false);return <><EmployeeApp scenario={scenario} onOpenPolicy={()=>setPolicy(true)} onOpenAdjustment={()=>setAdjust(true)} onOpenClarification={()=>setClarify(true)}/><PolicyModal isOpen={policy} onClose={()=>setPolicy(false)}/><AdjustmentModal isOpen={adjust} onClose={()=>setAdjust(false)}/><ClarificationModal isOpen={clarify} onClose={()=>setClarify(false)} onConfirm={()=>setClarify(false)}/></>};

function ApproverApp(){const approver=useApprover();const [selected,setSelected]=useState<ApproverRequest|null>(null);const [modal,setModal]=useState<'reject'|'clarify'|null>(null);const [active,setActive]=useState<ApproverRequest|null>(null);useEffect(()=>{approver.loadRequests()},[]);const open=(type:'reject'|'clarify',req:ApproverRequest)=>{setActive(req);setModal(type)};return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><ApproverView requests={approver.approverRequests} selected={selected} onSelect={setSelected} onApprove={async req=>{const updated=await approver.approve(req);if(updated)setSelected(updated)}} onOpenRejectModal={req=>open('reject',req)} onOpenClarifyModal={req=>open('clarify',req)}/></div><RejectModal isOpen={modal==='reject'} onClose={()=>setModal(null)} employeeName={active?.employee.name} itemCode={active?.id} onConfirm={async reason=>{if(active)await approver.reject(active.id,reason);setSelected(null);setModal(null)}}/><ClarificationModal isOpen={modal==='clarify'} onClose={()=>setModal(null)} employeeName={active?.employee.name} onConfirm={async msg=>{if(active)await approver.clarify(active.id,msg);setSelected(null);setModal(null)}}/></main>}

const AppHeader=({session,onLogout}:{session:MockSession;onLogout:()=>void})=><header className="sticky top-0 z-50 border-b border-blue-950/20 bg-[#071c3b] px-4 py-2 text-white shadow-sm"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><TimeLockLogo size={34} theme="dark" showTagline={false}/><div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs sm:flex"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300"/><UserRound className="h-3.5 w-3.5"/>{session.user.fullName} · {session.user.role}</span><button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10 transition-colors"><LogOut className="h-3.5 w-3.5"/><span className="hidden sm:inline">Đăng xuất</span></button></div></div></header>;

