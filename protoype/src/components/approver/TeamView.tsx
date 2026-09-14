import React from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';
import { MOCK_TEAM_MEMBERS } from '../../data/mockData';
import { AttendanceStatusBadge, ApprovalStatusBadge } from '../common/Badges';

export const TeamView: React.FC = () => {
  const members = MOCK_TEAM_MEMBERS;
  const department = members[0]?.department ?? '';
  const checkedIn = members.filter((m) => m.status === 'CHECKED_IN' || m.status === 'COMPLETED' || m.status === 'LATE').length;
  const notCheckedIn = members.filter((m) => m.status === 'NOT_CHECKED_IN').length;

  return (
    <div id="manager-team-view" className="space-y-6">
      <div className="pb-4 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Nhân viên phòng ban</h2>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Tình trạng chấm công hôm nay của {department} ({members.length} nhân viên).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium">
            <span>Tổng nhân viên</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-on-surface">{members.length}</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium">
            <span>Đã chấm công</span>
            <UserCheck className="w-4 h-4 text-secondary" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-secondary">{checkedIn}</p>
        </div>
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-medium">
            <span>Chưa check-in</span>
            <UserX className="w-4 h-4 text-error" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-error">{notCheckedIn}</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Nhân viên</th>
                <th className="py-3 px-4">Chức danh</th>
                <th className="py-3 px-4">Check-in</th>
                <th className="py-3 px-4">Check-out</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Phê duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-surface-container-low/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {m.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{m.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{m.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-on-surface">{m.title}</td>
                  <td className="py-3.5 px-4 font-mono text-on-surface">{m.checkInTime ?? '—'}</td>
                  <td className="py-3.5 px-4 font-mono text-on-surface">{m.checkOutTime ?? '—'}</td>
                  <td className="py-3.5 px-4"><AttendanceStatusBadge status={m.status} size="sm" /></td>
                  <td className="py-3.5 px-4"><ApprovalStatusBadge status={m.approvalStatus} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
