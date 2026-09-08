import React, { useEffect, useState } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import {
  MainTab,
  EmployeeTab,
  FrameId,
  DayAttendance,
  ApproverRequest,
} from '../types';
import { CURRENT_EMPLOYEE, MOCK_HISTORY_RECORDS } from '../data/mockData';
import { useAttendance } from '../hooks/useAttendance';
import { useApprover } from '../hooks/useApprover';
import { useSimulation } from './useSimulation';
import { PhoneFrame } from './PhoneFrame';
import { SimulationSandbox } from './SimulationSandbox';
import { ApproverView } from './ApproverView';
import { FrameCatalogView } from './docs/FrameCatalogView';
import { SitemapView, UserFlowView } from './docs/SitemapAndFlows';
import { ButtonMatrixView, ComponentInventoryView } from './docs/MatrixAndInventory';
import {
  RejectModal,
  ClarificationModal,
  AdjustmentModal,
  PolicyModal,
} from '../components/common/Modals';

interface PrototypeWorkspaceProps {
  initialRole?: 'EMPLOYEE' | 'APPROVER';
}

export const PrototypeWorkspace: React.FC<PrototypeWorkspaceProps> = ({ initialRole = 'EMPLOYEE' }) => {
  const attendance = useAttendance();
  const approver = useApprover();
  const sim = useSimulation();

  // Navigation & Role
  const [mainTab, setMainTab] = useState<MainTab>('PROTOTYPE');
  const [roleMode, setRoleMode] = useState<'EMPLOYEE' | 'APPROVER'>(initialRole);
  const [employeeTab, setEmployeeTab] = useState<EmployeeTab>('TODAY');

  // History & Detail
  const [historyRecords] = useState<DayAttendance[]>(MOCK_HISTORY_RECORDS);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<DayAttendance | null>(null);

  // Approver selection
  const [selectedApproverReq, setSelectedApproverReq] = useState<ApproverRequest | null>(null);

  // Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isClarifyModalOpen, setIsClarifyModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [activeReqForModal, setActiveReqForModal] = useState<ApproverRequest | null>(null);

  // Load approver requests on mount
  useEffect(() => {
    approver.loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApprove = async (req: ApproverRequest) => {
    const updated = await approver.approve(req);
    // Mirror approval onto today's record if it's the current employee's
    if (req.employee.code === CURRENT_EMPLOYEE.code) {
      attendance.setRecord({
        ...attendance.todayRecord,
        overallApprovalStatus: 'APPROVED',
        checkIn: attendance.todayRecord.checkIn ? { ...attendance.todayRecord.checkIn, approvalStatus: 'APPROVED' } : undefined,
        checkOut: attendance.todayRecord.checkOut ? { ...attendance.todayRecord.checkOut, approvalStatus: 'APPROVED' } : undefined,
      });
    }
    if (selectedApproverReq?.id === req.id && updated) {
      setSelectedApproverReq({ ...updated });
    }
  };

  const onConfirmReject = async (reason: string) => {
    if (!activeReqForModal) return;
    const reqId = activeReqForModal.id;
    const updated = await approver.reject(reqId, reason);
    if (activeReqForModal.employee.code === CURRENT_EMPLOYEE.code) {
      attendance.setRecord({
        ...attendance.todayRecord,
        overallApprovalStatus: 'REJECTED',
        checkIn: attendance.todayRecord.checkIn
          ? { ...attendance.todayRecord.checkIn, approvalStatus: 'REJECTED', rejectionReason: reason }
          : undefined,
      });
    }
    if (selectedApproverReq?.id === reqId && updated) {
      setSelectedApproverReq({ ...updated });
    }
    setIsRejectModalOpen(false);
  };

  const onConfirmClarification = async (msg: string) => {
    if (!activeReqForModal) return;
    const reqId = activeReqForModal.id;
    const updated = await approver.clarify(reqId, msg);
    if (selectedApproverReq?.id === reqId && updated) {
      setSelectedApproverReq({ ...updated });
    }
    setIsClarifyModalOpen(false);
  };

  const handlePreviewFrame = (frameId: FrameId) => {
    setMainTab('PROTOTYPE');
    sim.reset();
    attendance.setRecord({
      ...(requireInitToday()),
    });

    if (frameId.startsWith('A')) {
      setRoleMode('APPROVER');
      if (frameId === 'A01') setSelectedApproverReq(null);
      else if (frameId === 'A02') setSelectedApproverReq(approver.approverRequests[0]);
      else if (frameId === 'A03') setSelectedApproverReq(approver.approverRequests[1]);
      return;
    }

    setRoleMode('EMPLOYEE');
    setSelectedApproverReq(null);
    setSelectedHistoryDay(null);

    switch (frameId) {
      case 'E01_A': setEmployeeTab('TODAY'); sim.setWorkMode('IN_OFFICE'); sim.setInCondition('NETWORK'); break;
      case 'E01_B': setEmployeeTab('TODAY'); sim.setWorkMode('IN_OFFICE'); sim.setInCondition('GPS'); break;
      case 'E01_C': setEmployeeTab('TODAY'); sim.setWorkMode('OUT_OFFICE'); sim.setOutCondition('NO_PHOTO'); break;
      case 'E02': setEmployeeTab('TODAY'); sim.setWorkMode('IN_OFFICE'); sim.setInCondition('NONE'); break;
      case 'E03': setEmployeeTab('TODAY'); break;
      case 'E04': setEmployeeTab('TODAY'); sim.setWorkMode('IN_OFFICE'); sim.setInCondition('NETWORK'); attendance.setRecord({ ...requireInitToday(), status: 'CHECKED_IN', checkIn: { time: '08:15', serverTime: '08:15:24 GMT+7', method: 'NETWORK', workplace: 'Văn phòng TVS Quận 8', address: 'Mạng TVS_OFFICE_Q8 (LAN)', approvalStatus: 'NOT_REQUIRED' } }); break;
      case 'E05': setEmployeeTab('TODAY'); sim.setWorkMode('OUT_OFFICE'); attendance.openCamera('CHECK_IN'); break;
      case 'E06': setEmployeeTab('TODAY'); sim.setWorkMode('OUT_OFFICE'); attendance.showPreview('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'); break;
      case 'E07': setEmployeeTab('TODAY'); setTodayFromFrame('E07'); break;
      case 'E08': setEmployeeTab('TODAY'); setTodayFromFrame('E08'); break;
      case 'E09': setEmployeeTab('HISTORY'); setSelectedHistoryDay(null); break;
      case 'E10': setEmployeeTab('HISTORY'); setSelectedHistoryDay(MOCK_HISTORY_RECORDS.find((r) => r.id === 'att-completed-selfie') || MOCK_HISTORY_RECORDS[0]); break;
      case 'E11': setEmployeeTab('TODAY'); sim.setSimulatedSystemState('SSO_EXPIRED'); break;
      default: break;
    }
  };

  const requireInitToday = (): DayAttendance => {
    // minimal reset to NOT_CHECKED_IN day
    return {
      id: 'att-today', date: '2026-08-21', formattedDate: 'Thứ Sáu, 21/08/2026',
      shiftName: 'Ca hành chính', shiftHours: '08:00 – 17:00',
      workplace: 'Văn phòng TVS Quận 8', workplaceAddress: '123 đường mẫu, Quận 8, TP.HCM',
      status: 'NOT_CHECKED_IN', overallApprovalStatus: 'NOT_REQUIRED', auditTrail: [],
    };
  };

  const setTodayFromFrame = (frameId: string) => {
    if (frameId === 'E07') {
      const completed = MOCK_HISTORY_RECORDS.find((r) => r.id === 'att-completed-selfie')!;
      attendance.setRecord({ ...completed });
    } else if (frameId === 'E08') {
      const rejected = MOCK_HISTORY_RECORDS.find((r) => r.id === 'att-rejected')!;
      attendance.setRecord({ ...rejected });
    }
  };

  const pendingCount = approver.approverRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-background text-on-background font-sans antialiased flex flex-col">
      {/* GLOBAL TOP APP BAR & SPEC NAVIGATION */}
      <header className="hidden sm:block bg-surface text-on-surface sticky top-0 z-40 shadow-sm border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary font-black flex items-center justify-center text-xs shadow-xs">TL</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-on-surface">TimeLock</span>
                <span className="text-[10px] font-semibold bg-secondary-container/40 text-on-secondary-container px-1.5 py-0.5 rounded border border-secondary/20">Mock session</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">Chấm công · Phê duyệt · Chốt kỳ công</p>
            </div>
          </div>

          <div className="flex w-full xl:w-auto items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
            <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant">
              <button
                id="btn-switch-employee"
                type="button"
                onClick={() => { setRoleMode('EMPLOYEE'); setSelectedApproverReq(null); }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${roleMode === 'EMPLOYEE' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> <span>Nhân viên (Mobile)</span>
              </button>
              <button
                id="btn-switch-approver"
                type="button"
                onClick={() => setRoleMode('APPROVER')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${roleMode === 'APPROVER' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Monitor className="w-3.5 h-3.5" /> <span>Approver (Desktop)</span>
                {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>}
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-outline-variant pl-2">
              {[
                { id: 'PROTOTYPE', label: 'Prototype Live' },
                { id: 'FRAME_CATALOG', label: 'Wireframe Catalog' },
                { id: 'SITEMAP', label: 'Sitemap' },
                { id: 'USER_FLOWS', label: 'User Flows' },
                { id: 'BUTTON_MATRIX', label: 'Button Matrix' },
                { id: 'COMPONENT_INVENTORY', label: 'Components (24)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMainTab(tab.id as MainTab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${mainTab === tab.id ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-0 sm:p-4 md:p-6">
        {/* TAB 1: PROTOTYPE — 2-COLUMN (6-4) LAYOUT */}
        {mainTab === 'PROTOTYPE' && (
          <>
            {roleMode === 'EMPLOYEE' ? (
              <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                {/* LEFT (8/10): phone preview */}
                <div className="xl:col-span-8 flex justify-center xl:sticky xl:top-20 xl:self-start">
                  <PhoneFrame
                    attendance={attendance}
                    sim={sim}
                    employeeTab={employeeTab}
                    onTabChange={(tab) => { setEmployeeTab(tab); setSelectedHistoryDay(null); }}
                    historyRecords={historyRecords}
                    selectedHistoryDay={selectedHistoryDay}
                    onSelectHistoryDay={setSelectedHistoryDay}
                    onOpenPolicy={() => setIsPolicyModalOpen(true)}
                    onOpenAdjustment={() => setIsAdjustmentModalOpen(true)}
                    onOpenClarification={() => { setActiveReqForModal(approver.approverRequests[0]); setIsClarifyModalOpen(true); }}
                  />
                </div>
                {/* RIGHT (2/10): simulation sandbox */}
                <div className="xl:col-span-2">
                  <SimulationSandbox attendance={attendance} sim={sim} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                <div className="xl:col-span-8">
                  <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 shadow-sm">
                    <ApproverView
                      requests={approver.approverRequests}
                      selected={selectedApproverReq}
                      onSelect={setSelectedApproverReq}
                      onApprove={onApprove}
                      onOpenRejectModal={(req) => { setActiveReqForModal(req); setIsRejectModalOpen(true); }}
                      onOpenClarifyModal={(req) => { setActiveReqForModal(req); setIsClarifyModalOpen(true); }}
                    />
                  </div>
                </div>
                <div className="xl:col-span-2">
                  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3 xl:sticky xl:top-20">
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Approver tools</h3>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Chọn 1 yêu cầu trong danh sách bên trái để xem chi tiết bằng chứng và thao tác Duyệt / Từ chối / Yêu cầu giải trình.
                    </p>
                    <div className="text-[10px] text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-lg p-2.5 leading-relaxed">
                      💡 <strong className="text-on-surface">Ghi chú:</strong> Đây là khu vực test Approver. Khi nối BE thật, khung điều khiển này được gỡ bỏ.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: FRAME CATALOG */}
        {mainTab === 'FRAME_CATALOG' && <FrameCatalogView onSelectFrameToPreview={handlePreviewFrame} />}

        {/* TAB 3: SITEMAP */}
        {mainTab === 'SITEMAP' && <SitemapView />}

        {/* TAB 4: USER FLOWS */}
        {mainTab === 'USER_FLOWS' && <UserFlowView />}

        {/* TAB 5: BUTTON DECISION MATRIX */}
        {mainTab === 'BUTTON_MATRIX' && <ButtonMatrixView />}

        {/* TAB 6: COMPONENT INVENTORY */}
        {mainTab === 'COMPONENT_INVENTORY' && <ComponentInventoryView />}
      </main>

      {/* GLOBAL MODALS */}
      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={onConfirmReject}
        employeeName={activeReqForModal?.employee.name}
        itemCode={activeReqForModal?.id}
      />
      <ClarificationModal
        isOpen={isClarifyModalOpen}
        onClose={() => setIsClarifyModalOpen(false)}
        onConfirm={onConfirmClarification}
        employeeName={activeReqForModal?.employee.name}
      />
      <AdjustmentModal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} />
      <PolicyModal isOpen={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />
    </div>
  );
};