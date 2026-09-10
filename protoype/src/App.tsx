import React, { useEffect, useState } from 'react';
import { Clock3, LogOut, ShieldCheck, UserRound } from 'lucide-react';
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
import { MANAGER_EMPLOYEE } from './data/mockData';

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
  return <div className="min-h-screen bg-[#f4f1ec]"><AppHeader session={session} onLogout={onLogout}/>{session.user.role === 'ADMIN' ? <AdminDashboard/> : session.user.role === 'HR' ? <HrApp/> : session.user.role === 'APPROVER' ? <ApproverApp/> : <EmployeeShell scenario={SCENARIOS[session.user.employeeCode] ?? SCENARIOS['TVS-0248']}/>}</div>;
}

const EmployeeShell=({scenario,profile}:{scenario:EmployeeScenario;profile?:EmployeeProfile})=>{const [policy,setPolicy]=useState(false);const [adjust,setAdjust]=useState(false);const [clarify,setClarify]=useState(false);return <><EmployeeApp scenario={scenario} profile={profile} onOpenPolicy={()=>setPolicy(true)} onOpenAdjustment={()=>setAdjust(true)} onOpenClarification={()=>setClarify(true)}/><PolicyModal isOpen={policy} onClose={()=>setPolicy(false)}/><AdjustmentModal isOpen={adjust} onClose={()=>setAdjust(false)}/><ClarificationModal isOpen={clarify} onClose={()=>setClarify(false)} onConfirm={()=>setClarify(false)}/></>};

const MANAGER_TABS: { id: ManagerTab; label: string }[] = [
  { id: 'APPROVALS', label: 'Phê duyệt' },
  { id: 'TEAM', label: 'Nhân viên phòng ban' },
  { id: 'MY_ATTENDANCE', label: 'Chấm công của tôi' },
];

function ApproverApp(){const approver=useApprover();const [tab,setTab]=useState<ManagerTab>('APPROVALS');const [selected,setSelected]=useState<ApproverRequest|null>(null);const [modal,setModal]=useState<'reject'|'clarify'|null>(null);const [active,setActive]=useState<ApproverRequest|null>(null);useEffect(()=>{approver.loadRequests()},[]);const open=(type:'reject'|'clarify',req:ApproverRequest)=>{setActive(req);setModal(type)};
  if(tab==='MY_ATTENDANCE') return <><ManagerTabBar tab={tab} onChange={setTab}/><EmployeeShell scenario={SCENARIOS['TVS-0102']} profile={MANAGER_EMPLOYEE}/></>;
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><ManagerTabBar tab={tab} onChange={setTab}/><div className="rounded-2xl border border-stone-200/80 bg-[#fefcfa] p-4 shadow-sm sm:p-6">{tab==='TEAM'?<TeamView/>:<ApproverView requests={approver.approverRequests} selected={selected} onSelect={setSelected} onApprove={async req=>{const updated=await approver.approve(req);if(updated)setSelected(updated)}} onOpenRejectModal={req=>open('reject',req)} onOpenClarifyModal={req=>open('clarify',req)}/>}</div><RejectModal isOpen={modal==='reject'} onClose={()=>setModal(null)} employeeName={active?.employee.name} itemCode={active?.id} onConfirm={async reason=>{if(active)await approver.reject(active.id,reason);setSelected(null);setModal(null)}}/><ClarificationModal isOpen={modal==='clarify'} onClose={()=>setModal(null)} employeeName={active?.employee.name} onConfirm={async msg=>{if(active)await approver.clarify(active.id,msg);setSelected(null);setModal(null)}}/></main>}

const ManagerTabBar=({tab,onChange}:{tab:ManagerTab;onChange:(t:ManagerTab)=>void})=><div className="mx-auto mb-4 flex w-full max-w-7xl gap-2 px-4 sm:px-6 lg:px-8"><div className="flex gap-2 rounded-xl border border-stone-200 bg-[#fefcfa] p-1.5 shadow-sm">{MANAGER_TABS.map(t=><button key={t.id} type="button" onClick={()=>onChange(t.id)} className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${tab===t.id?'bg-[#2d4a7a] text-white':'text-stone-600 hover:bg-stone-100'}`}>{t.label}</button>)}</div></div>;

const AppHeader=({session,onLogout}:{session:MockSession;onLogout:()=>void})=><header className="sticky top-0 z-50 border-b border-stone-900/20 bg-[#2a3a52] px-4 py-2.5 text-white shadow-sm"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#3d5f96]"><Clock3 className="h-5 w-5"/></span><div><p className="text-sm font-black">TimeLock</p><p className="hidden text-[10px] text-blue-200/80 sm:block">Chấm công · Phê duyệt · Chốt công</p></div></div><div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs sm:flex"><ShieldCheck className="h-3.5 w-3.5 text-sky-300"/><UserRound className="h-3.5 w-3.5"/>{session.user.fullName} · {session.user.role}</span><button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10"><LogOut className="h-3.5 w-3.5"/><span className="hidden sm:inline">Đăng xuất</span></button></div></div></header>;
