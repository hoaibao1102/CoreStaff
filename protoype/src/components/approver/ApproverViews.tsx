import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Filter,
  Search,
  ChevronRight,
  Eye,
  MapPin,
  Camera,
  Navigation,
  ArrowLeft,
  Building2,
  User,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { ApproverRequest, ApprovalStatus, MethodType } from '../../types';
import { ApprovalStatusBadge, MethodBadge } from '../common/Badges';
import { AuditTimeline, EmptyState } from '../common/CommonStates';

interface ApproverDashboardProps {
  requests: ApproverRequest[];
  onSelectRequest: (req: ApproverRequest) => void;
  onQuickApprove: (req: ApproverRequest) => void;
  onOpenRejectModal: (req: ApproverRequest) => void;
  onOpenClarifyModal: (req: ApproverRequest) => void;
}

export const ApproverDashboard: React.FC<ApproverDashboardProps> = ({
  requests,
  onSelectRequest,
  onQuickApprove,
  onOpenRejectModal,
  onOpenClarifyModal,
}) => {
  const [activeTab, setActiveTab] = useState<ApprovalStatus | 'ALL'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  const pendingList = requests.filter((r) => r.status === 'PENDING');
  const warningList = requests.filter((r) => r.warning && r.status === 'PENDING');

  const filteredRequests = requests.filter((req) => {
    const matchesTab = activeTab === 'ALL' || req.status === activeTab;
    const matchesSearch =
      req.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employee.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      departmentFilter === 'ALL' || req.employee.department === departmentFilter;
    return matchesTab && matchesSearch && matchesDept;
  });

  return (
    <div id="approver-dashboard-a01" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-on-surface tracking-tight">
              Phê duyệt chấm công & Bằng chứng
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim">
              {pendingList.length} yêu cầu chờ xử lý
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Cổng quản trị dành cho Cấp trên / Quản lý phê duyệt bằng chứng Selfie và ngoại lệ GPS.
          </p>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium">
            <span>Tổng yêu cầu chờ duyệt</span>
            <Clock className="w-4 h-4 text-on-secondary-container" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-on-surface">
              {pendingList.length}
            </span>
            <span className="text-xs text-tertiary font-medium">Cần xử lý trong ca</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-tertiary-fixed-dim bg-tertiary-fixed/40 shadow-sm">
          <div className="flex items-center justify-between text-on-tertiary-fixed-variant text-xs font-medium">
            <span>Yêu cầu có Cảnh báo</span>
            <AlertTriangle className="w-4 h-4 text-tertiary-container" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-on-tertiary-fixed-variant">
              {warningList.length}
            </span>
            <span className="text-xs text-tertiary">Khoảng cách xa / Bất thường GPS</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium">
            <span>Đã xử lý hôm nay</span>
            <ShieldCheck className="w-4 h-4 text-secondary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-secondary">
              {requests.filter((r) => r.status === 'APPROVED').length}
            </span>
            <span className="text-xs text-on-surface-variant">Đã phê duyệt hợp lệ</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Tabs */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 border-b border-outline-variant pb-3 overflow-x-auto">
          {[
            { id: 'PENDING', label: 'Chờ duyệt', count: pendingList.length },
            { id: 'APPROVED', label: 'Đã duyệt', count: requests.filter((r) => r.status === 'APPROVED').length },
            { id: 'REJECTED', label: 'Đã từ chối', count: requests.filter((r) => r.status === 'REJECTED').length },
            { id: 'CLARIFICATION_REQUESTED', label: 'Yêu cầu giải trình', count: requests.filter((r) => r.status === 'CLARIFICATION_REQUESTED').length },
            { id: 'ALL', label: 'Tất cả', count: requests.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Department Dropdowns */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên nhân viên, mã nhân viên (TVS-0248), mã yêu cầu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-outline focus:outline-hidden focus:ring-2 focus:ring-primary/40 bg-surface-container-lowest"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-outline bg-surface-container-lowest text-on-surface focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">Tất cả phòng ban</option>
              <option value="Phòng Kinh doanh">Phòng Kinh doanh</option>
              <option value="Phòng Dự án ERP">Phòng Dự án ERP</option>
              <option value="Phòng Kỹ thuật">Phòng Kỹ thuật</option>
              <option value="Phòng Marketing">Phòng Marketing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Request Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        {filteredRequests.length === 0 ? (
          <EmptyState
            title="Không có yêu cầu nào"
            description="Không tìm thấy yêu cầu phê duyệt phù hợp với bộ lọc đã chọn."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Ngày làm việc</th>
                  <th className="py-3 px-4">Phương thức</th>
                  <th className="py-3 px-4">Lý do cần duyệt</th>
                  <th className="py-3 px-4">Cảnh báo</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-surface-container-low/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectRequest(req)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {req.employee.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface group-hover:text-on-surface">
                            {req.employee.name}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {req.employee.code} • {req.employee.department}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-on-surface">
                      <p className="font-medium">{req.date}</p>
                      <p className="text-[11px] text-on-surface-variant">{req.shiftName}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <MethodBadge method={req.method} />
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-on-surface font-medium line-clamp-1">
                        {req.reasonNeedApproval}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        Mã phiếu: {req.id} • Server time: {req.serverTime}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      {req.warning ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim font-medium text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-tertiary-container shrink-0" />
                          <span className="line-clamp-1">{req.warning}</span>
                        </span>
                      ) : (
                        <span className="text-outline text-[11px]">Không có</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <ApprovalStatusBadge status={req.status} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectRequest(req)}
                          className="px-2.5 py-1 text-xs font-semibold text-on-surface bg-surface-container-low hover:bg-surface-container rounded-md transition-colors border border-outline-variant"
                        >
                          Chi tiết
                        </button>
                        {req.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onQuickApprove(req)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-secondary hover:bg-secondary rounded-md transition-colors"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenRejectModal(req)}
                              className="px-2 py-1 text-xs font-medium text-error hover:bg-error-container rounded-md transition-colors border border-error-container"
                            >
                              Từ chối
                            </button>
                          </>
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
    </div>
  );
};

interface ApproverSelfieDetailProps {
  request: ApproverRequest;
  onBack: () => void;
  onApprove: (req: ApproverRequest) => void;
  onReject: (req: ApproverRequest) => void;
  onClarify: (req: ApproverRequest) => void;
}

export const ApproverSelfieDetail: React.FC<ApproverSelfieDetailProps> = ({
  request,
  onBack,
  onApprove,
  onReject,
  onClarify,
}) => {
  return (
    <div id="approver-selfie-detail-a02" className="space-y-6 pb-20">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
        <button
          id="btn-back-to-approver-list"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface hover:text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors border border-outline-variant"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">Mã yêu cầu: <strong>{request.id}</strong></span>
          <ApprovalStatusBadge status={request.status} />
        </div>
      </div>

      {/* Employee Overview Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Nhân viên</span>
          <h3 className="text-sm font-bold text-on-surface">{request.employee.name}</h3>
          <p className="text-xs text-on-surface-variant">{request.employee.code} • {request.employee.department}</p>
        </div>

        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Ngày làm việc</span>
          <p className="text-xs font-bold text-on-surface">{request.date}</p>
          <p className="text-xs text-on-surface-variant">{request.shiftName} ({request.shiftHours})</p>
        </div>

        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Phương thức</span>
          <MethodBadge method="SELFIE" />
          <p className="text-[11px] text-on-surface-variant mt-1">Chính sách nhân viên thị trường</p>
        </div>
      </div>

      {/* Distance Warning Banner (18.4km distance between Q7 and Thu Duc) */}
      {request.distanceBetweenPointsKm && request.distanceBetweenPointsKm > 10 && (
        <div className="p-4 rounded-xl bg-tertiary-fixed border border-tertiary-fixed-dim text-on-tertiary-fixed-variant space-y-1 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-tertiary-container shrink-0" />
            <h4 className="text-xs font-bold">
              Cảnh báo khoảng cách di chuyển: Check-in và Check-out cách nhau {request.distanceBetweenPointsKm} km
            </h4>
          </div>
          <p className="text-xs pl-7 leading-relaxed">
            * <strong>Ghi chú chính sách:</strong> Đây là cảnh báo tham khảo để Quản lý nắm thông tin di chuyển theo lịch trình thị trường, hệ thống <strong>không tự động từ chối</strong>.
          </p>
        </div>
      )}

      {/* DUAL SELFIE COMPARISON VIEWER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-in Selfie Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-on-success"></span>
              <h4 className="text-xs font-bold text-on-surface">1. Ảnh Selfie Check-in</h4>
            </div>
            <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant">
              {request.checkIn?.time || '08:15'}
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-primary border border-outline aspect-3/4 flex items-center justify-center">
            <img
              src={request.checkIn?.selfieUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
              alt="Selfie Check-in"
              className="w-full h-full object-cover"
            />
            {/* Watermark */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent text-white text-[10px] font-mono space-y-0.5">
              <div className="font-bold text-[11px] flex justify-between">
                <span>CHECK-IN VERIFIED</span>
                <span>{request.checkIn?.serverTime}</span>
              </div>
              <p className="truncate text-slate-200">📍 {request.checkIn?.address}</p>
              <p className="text-[9px] text-outline">GPS ACCURACY: ±{request.checkIn?.accuracy || 18}M</p>
            </div>
          </div>

          <div className="p-2.5 bg-surface-container-low rounded-lg text-xs space-y-1 border border-outline-variant">
            <p className="text-on-surface font-medium flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
              <span>{request.checkIn?.address}</span>
            </p>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant">
              <span>Thời gian server: <strong>{request.checkIn?.serverTime}</strong></span>
              <span>Độ chính xác: <strong>±{request.checkIn?.accuracy}m</strong></span>
            </div>
          </div>
        </div>

        {/* Check-out Selfie Card */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-on-success"></span>
              <h4 className="text-xs font-bold text-on-surface">2. Ảnh Selfie Check-out</h4>
            </div>
            <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant">
              {request.checkOut?.time || '17:20'}
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-primary border border-outline aspect-3/4 flex items-center justify-center">
            <img
              src={request.checkOut?.selfieUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500'}
              alt="Selfie Check-out"
              className="w-full h-full object-cover"
            />
            {/* Watermark */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent text-white text-[10px] font-mono space-y-0.5">
              <div className="font-bold text-[11px] flex justify-between">
                <span>CHECK-OUT VERIFIED</span>
                <span>{request.checkOut?.serverTime}</span>
              </div>
              <p className="truncate text-slate-200">📍 {request.checkOut?.address}</p>
              <p className="text-[9px] text-outline">GPS ACCURACY: ±{request.checkOut?.accuracy || 15}M</p>
            </div>
          </div>

          <div className="p-2.5 bg-surface-container-low rounded-lg text-xs space-y-1 border border-outline-variant">
            <p className="text-on-surface font-medium flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
              <span>{request.checkOut?.address}</span>
            </p>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant">
              <span>Thời gian server: <strong>{request.checkOut?.serverTime}</strong></span>
              <span>Độ chính xác: <strong>±{request.checkOut?.accuracy}m</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Explanation & Clarification History */}
      {request.employeeClarification && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-2">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-on-surface-variant" />
            Giải trình / Ghi chú từ nhân viên
          </h4>
          <p className="text-xs text-on-surface bg-surface-container-low p-3 rounded-lg border border-outline-variant leading-relaxed italic">
            "{request.employeeClarification}"
          </p>
        </div>
      )}

      {/* Audit History */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Nhật ký phê duyệt & Lịch sử thao tác
        </h4>
        <AuditTimeline logs={request.auditTrail} />
      </div>

      {/* STICKY BOTTOM ACTION BAR FOR APPROVER */}
      <div
        id="approver-sticky-action-bar"
        className="fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant p-4 shadow-xl z-30 flex items-center justify-between max-w-7xl mx-auto"
      >
        <div className="text-xs text-on-surface-variant">
          Đang xem xét: <strong>{request.employee.name}</strong> ({request.date})
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-approver-reject"
            type="button"
            onClick={() => onReject(request)}
            className="px-4 py-2.5 text-xs font-bold text-error bg-error-container hover:bg-error-container border border-error-container rounded-xl transition-colors shadow-sm"
          >
            Từ chối (Bắt buộc lý do)
          </button>

          <button
            id="btn-approver-clarify"
            type="button"
            onClick={() => onClarify(request)}
            className="px-4 py-2.5 text-xs font-bold text-primary bg-primary-fixed hover:bg-primary-container border border-outline-variant rounded-xl transition-colors shadow-sm"
          >
            Yêu cầu giải trình
          </button>

          <button
            id="btn-approver-approve"
            type="button"
            onClick={() => onApprove(request)}
            className="px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-secondary" />
            Duyệt ngày công
          </button>
        </div>
      </div>
    </div>
  );
};

interface ApproverGPSDetailProps {
  request: ApproverRequest;
  onBack: () => void;
  onApprove: (req: ApproverRequest) => void;
  onReject: (req: ApproverRequest) => void;
  onClarify: (req: ApproverRequest) => void;
}

export const ApproverGPSDetail: React.FC<ApproverGPSDetailProps> = ({
  request,
  onBack,
  onApprove,
  onReject,
  onClarify,
}) => {
  return (
    <div id="approver-gps-detail-a03" className="space-y-6 pb-20">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface hover:text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg transition-colors border border-outline-variant"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">Mã yêu cầu: <strong>{request.id}</strong></span>
          <ApprovalStatusBadge status={request.status} />
        </div>
      </div>

      {/* Overview */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Nhân viên</span>
          <h3 className="text-sm font-bold text-on-surface">{request.employee.name}</h3>
          <p className="text-xs text-on-surface-variant">{request.employee.code} • {request.employee.department}</p>
        </div>

        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Workplace chỉ định</span>
          <p className="text-xs font-bold text-on-surface">Văn phòng TVS Quận 8</p>
          <p className="text-[11px] text-on-surface-variant">123 đường mẫu, Quận 8, TP.HCM</p>
        </div>

        <div>
          <span className="text-[10px] text-outline font-semibold uppercase block">Quy chuẩn Geofence</span>
          <p className="text-xs font-semibold text-on-surface">Bán kính: 100m • Max accuracy: 80m</p>
        </div>
      </div>

      {/* Geofence Anomaly Radar Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-error-container text-error">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-on-surface">
              Chi tiết bất thường định vị GPS (450m &gt; 100m)
            </h3>
          </div>
          <span className="text-xs font-bold text-error bg-error-container px-2 py-0.5 rounded border border-error-container">
            Vượt 350m
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Vị trí nhân viên ghi nhận:</span>
                <span className="font-mono font-bold text-on-surface">{request.checkIn?.time} ({request.serverTime})</span>
              </div>
              <p className="text-on-surface flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
                <span>{request.checkIn?.address}</span>
              </p>
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant">
                <span>Khoảng cách đo được: <strong className="text-error">450 mét</strong></span>
                <span>Độ chính xác GPS: <strong>±25 mét (Hợp lệ)</strong></span>
              </div>
            </div>

            {request.employeeClarification && (
              <div className="p-3 bg-surface-container-low rounded-lg text-xs space-y-1">
                <span className="font-semibold text-on-surface">Lý do nhân viên cung cấp khi submit:</span>
                <p className="text-on-surface italic">"{request.employeeClarification}"</p>
              </div>
            )}
          </div>

          {/* SVG Map Geofence Visualization */}
          <div className="bg-primary rounded-xl p-4 text-white flex flex-col items-center justify-center relative overflow-hidden min-h-[200px]">
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-teal-400/60 flex items-center justify-center relative">
              {/* Office Center */}
              <div className="w-5 h-5 rounded-full bg-surface-container-low0 flex items-center justify-center text-[9px] font-bold shadow-lg">
                VP
              </div>
              <span className="absolute -top-5 text-[10px] text-teal-300 font-mono">Geofence (100m)</span>

              {/* Employee Position outside */}
              <div className="absolute -right-8 -bottom-6 flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-error-container0 text-white flex items-center justify-center text-[10px] font-bold animate-bounce shadow-lg">
                  AN
                </div>
                <span className="text-[10px] text-rose-300 font-mono mt-1">450m (Ngoài vùng)</span>
              </div>
            </div>
            <p className="text-[10px] text-outline mt-4 text-center">
              Mô phỏng tọa độ nhân viên so với tâm geofence của Workplace
            </p>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
          Lịch sử thao tác
        </h4>
        <AuditTimeline logs={request.auditTrail} />
      </div>

      {/* Sticky Bottom Actions */}
      <div
        id="approver-gps-sticky-bar"
        className="fixed bottom-0 inset-x-0 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant p-4 shadow-xl z-30 flex items-center justify-between max-w-7xl mx-auto"
      >
        <div className="text-xs text-on-surface-variant">
          Xem xét ngoại lệ GPS: <strong>{request.employee.name}</strong>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onReject(request)}
            className="px-4 py-2.5 text-xs font-bold text-error bg-error-container hover:bg-error-container border border-error-container rounded-xl transition-colors shadow-sm"
          >
            Từ chối
          </button>

          <button
            type="button"
            onClick={() => onClarify(request)}
            className="px-4 py-2.5 text-xs font-bold text-primary bg-primary-fixed hover:bg-primary-container border border-outline-variant rounded-xl transition-colors shadow-sm"
          >
            Yêu cầu giải trình thêm
          </button>

          <button
            type="button"
            onClick={() => onApprove(request)}
            className="px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-secondary" />
            Duyệt ngoại lệ GPS
          </button>
        </div>
      </div>
    </div>
  );
};
