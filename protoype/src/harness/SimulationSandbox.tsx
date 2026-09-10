import React from 'react';
import { Sliders, RotateCcw, Building2, Car } from 'lucide-react';
import { WorkMode } from '../types';
import { InCondition, OutCondition, NetworkSource, bssidForSource } from './useSimulation';
import { UseAttendance, UseSimulation } from './types';

export interface SimulationSandboxProps {
  attendance: UseAttendance;
  sim: UseSimulation;
}

export const SimulationSandbox: React.FC<SimulationSandboxProps> = ({ attendance, sim }) => {
  const resetAll = () => {
    attendance.resetToday();
    sim.reset();
  };

  return (
    <div
      id="simulation-sandbox"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm space-y-3 xl:sticky xl:top-20"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Simulation Sandbox
          </h3>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-container"
        >
          <RotateCcw className="w-3 h-3" />
          Reset trạng thái
        </button>
      </div>

      <div className="space-y-4">
        {/* 1. Work mode (IN_OFFICE / OUT_OFFICE) */}
        <div>
          <label className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">
            1. Chế độ làm việc
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => sim.setWorkMode('IN_OFFICE')}
              className={`flex-1 py-2 px-2 rounded-lg font-semibold text-xs border transition-colors flex items-center justify-center gap-1.5 ${
                sim.workMode === 'IN_OFFICE'
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              IN · Văn phòng
            </button>
            <button
              type="button"
              onClick={() => sim.setWorkMode('OUT_OFFICE')}
              className={`flex-1 py-2 px-2 rounded-lg font-semibold text-xs border transition-colors flex items-center justify-center gap-1.5 ${
                sim.workMode === 'OUT_OFFICE'
                  ? 'bg-primary text-on-primary border-primary shadow-xs'
                  : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              OUT · Thị trường
            </button>
          </div>
        </div>

        {/* 2. IN_OFFICE conditions */}
        {sim.workMode === 'IN_OFFICE' ? (
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">
              2. Điều kiện IN (mạng / GPS)
            </label>
            <select
              value={sim.inCondition}
              onChange={(e) => sim.setInCondition(e.target.value as InCondition)}
              className="w-full py-2 px-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-hidden"
            >
              <option value="NETWORK">✅ Mạng công ty hợp lệ</option>
              <option value="GPS">📍 GPS trong vùng (mạng hỏng)</option>
              <option value="BOTH">✅ Cả mạng + GPS (ưu tiên mạng)</option>
              <option value="NONE">❌ Mất mạng + GPS yếu → tự Selfie</option>
            </select>

            {/* Simulated device WiFi — production reads the real BSSID from a
                native scan (a browser cannot); here we just pick which router
                the device claims to be joined to. */}
            {(sim.inCondition === 'NETWORK' || sim.inCondition === 'BOTH') && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">
                  2b. Kết nối WiFi (giả lập thiết bị)
                </label>
                <select
                  value={sim.networkSource}
                  onChange={(e) => sim.setNetworkSource(e.target.value as NetworkSource)}
                  className="w-full py-2 px-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-hidden"
                >
                  <option value="OFFICE_ROUTER">🏢 Router văn phòng (đúng chữ ký)</option>
                  <option value="OTHER_WIFI">📶 WiFi lạ (caf&eacute; / 4G)</option>
                  <option value="NONE">❌ Không có WiFi</option>
                </select>
                <p className="mt-1 font-mono text-[10px] text-on-surface-variant break-all">
                  BSSID thiết bị báo: {bssidForSource(sim.networkSource) ?? '—'}
                </p>
              </div>
            )}

            {/* GPS sliders only meaningful when GPS is available */}
            {(sim.inCondition === 'GPS' || sim.inCondition === 'BOTH' || sim.inCondition === 'NONE') && (
              <div className="mt-3 pt-2 border-t border-outline-variant space-y-4 rounded-lg bg-surface-container-low p-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-on-surface-variant">Khoảng cách đến VP</span>
                    <span className="font-mono font-bold text-on-surface">{sim.gpsDistance} mét</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    value={sim.gpsDistance}
                    onChange={(e) => sim.setGpsDistance(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-on-surface-variant">Độ sai số GPS</span>
                    <span className="font-mono font-bold text-on-surface">±{sim.gpsAccuracy} mét</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    value={sim.gpsAccuracy}
                    onChange={(e) => sim.setGpsAccuracy(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 2'. OUT_OFFICE conditions */
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">
              2. Điều kiện OUT (selfie)
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => sim.setOutCondition('NO_PHOTO')}
                className={`flex-1 py-2 px-2 rounded-lg font-semibold text-xs border transition-colors ${
                  sim.outCondition === 'NO_PHOTO'
                    ? 'bg-primary text-on-primary border-primary shadow-xs'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
                }`}
              >
                📸 Chưa có ảnh
              </button>
              <button
                type="button"
                onClick={() => sim.setOutCondition('HAS_PHOTO')}
                className={`flex-1 py-2 px-2 rounded-lg font-semibold text-xs border transition-colors ${
                  sim.outCondition === 'HAS_PHOTO'
                    ? 'bg-primary text-on-primary border-primary shadow-xs'
                    : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-low'
                }`}
              >
                ✅ Đã có ảnh sẵn
              </button>
            </div>
          </div>
        )}

        {/* 3. Flow #7 exception */}
        <div>
          <label className="block text-[11px] font-semibold text-on-surface-variant mb-1.5">
            3. Ngoại lệ & trạng thái hệ thống
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => sim.setShowExceptionSuggestion(!sim.showExceptionSuggestion)}
              className={`py-2 px-2 rounded-lg font-semibold text-[11px] border transition-colors flex items-center justify-center gap-1 ${
                sim.showExceptionSuggestion
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-xs'
                  : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container'
              }`}
            >
              {sim.showExceptionSuggestion ? 'Ẩn đề xuất #7' : 'Bật Đề xuất #7'}
            </button>

            <select
              value={sim.simulatedSystemState}
              onChange={(e) => sim.setSimulatedSystemState(e.target.value as any)}
              className="py-2 px-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-[11px] font-medium"
            >
              <option value="NORMAL">Hệ thống bình thường</option>
              <option value="LOADING">E11: Initial Loading</option>
              <option value="SSO_EXPIRED">E11: Phiên SSO hết hạn</option>
              <option value="OFFLINE">E11: Mất mạng Internet</option>
              <option value="API_ERROR">E11: Lỗi máy chủ API</option>
              <option value="HOLIDAY">E11: Ngày nghỉ tuần</option>
              <option value="LOCKED">E11: Bảng công đã khóa</option>
              <option value="DUPLICATE">E11: Yêu cầu trùng lặp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sandbox hint */}
      <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-[10px] text-on-surface-variant leading-relaxed">
        💡 <strong className="text-on-surface">Ghi chú:</strong> Chọn <b>IN</b> (văn phòng → BE tự chọn NETWORK/GPS, lỗi thì tự Selfie) hoặc <b>OUT</b> (thị trường → bắt buộc Selfie). Khi nối BE thật, khung này được gỡ bỏ.
      </div>
    </div>
  );
};