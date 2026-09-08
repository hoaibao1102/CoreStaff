import React, { useState } from 'react';
import {
  Smartphone,
  Monitor,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { FRAME_METADATA_LIST } from '../../data/mockData';
import { FrameId, FrameMetadata } from '../../types';

interface FrameCatalogViewProps {
  onSelectFrameToPreview: (frameId: FrameId) => void;
}

export const FrameCatalogView: React.FC<FrameCatalogViewProps> = ({
  onSelectFrameToPreview,
}) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'EMPLOYEE' | 'APPROVER' | 'SYSTEM'>('ALL');
  const [selectedFrame, setSelectedFrame] = useState<FrameMetadata>(FRAME_METADATA_LIST[0]);

  const filteredFrames = FRAME_METADATA_LIST.filter(
    (f) => activeCategory === 'ALL' || f.role === activeCategory
  );

  return (
    <div id="frame-catalog-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
        <div>
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Layers className="w-5 h-5 text-on-surface" />
            Bộ danh mục Wireframe E01–E11 & A01–A03 kèm UX Specs
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Tổng hợp toàn bộ các màn hình wireframe, biến thể trạng thái và ghi chú thiết kế chi tiết.
          </p>
        </div>

        {/* Filter categories */}
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg">
          {[
            { id: 'ALL', label: 'Tất cả (16)' },
            { id: 'EMPLOYEE', label: 'Employee (11)' },
            { id: 'APPROVER', label: 'Approver (3)' },
            { id: 'SYSTEM', label: 'System (2)' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeCategory === cat.id
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout: Left side frame list, Right side UX design annotations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Frames */}
        <div className="lg:col-span-5 space-y-2 max-h-[75vh] overflow-y-auto pr-1">
          {filteredFrames.map((frame) => {
            const isSelected = selectedFrame.id === frame.id;
            return (
              <div
                key={frame.id}
                onClick={() => setSelectedFrame(frame)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-primary text-on-primary border-slate-900 shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-slate-400 hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-primary text-amber-300'
                          : 'bg-surface-container-low text-on-surface border border-outline-variant'
                      }`}
                    >
                      {frame.code}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      isSelected ? 'text-outline' : 'text-on-surface-variant'
                    }`}>
                      {frame.category}
                    </span>
                  </div>
                  {frame.role === 'EMPLOYEE' ? (
                    <Smartphone className={`w-3.5 h-3.5 ${isSelected ? 'text-outline' : 'text-on-surface-variant'}`} />
                  ) : (
                    <Monitor className={`w-3.5 h-3.5 ${isSelected ? 'text-outline' : 'text-on-surface-variant'}`} />
                  )}
                </div>

                <h4 className="text-xs font-bold leading-tight">{frame.title}</h4>
                <p className={`text-[11px] line-clamp-1 ${isSelected ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>
                  {frame.goal}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Detailed UX Annotation Sheet */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-sm space-y-5">
            {/* Header info */}
            <div className="flex items-start justify-between pb-3 border-b border-outline-variant">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold bg-primary text-on-primary px-2.5 py-0.5 rounded">
                    {selectedFrame.code}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                    {selectedFrame.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-on-surface">{selectedFrame.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => onSelectFrameToPreview(selectedFrame.id)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-on-primary font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
              >
                <span>Xem Prototype trực tiếp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Core UX Annotation Points as required in section 13.5 */}
            <div className="space-y-4 text-xs">
              {/* Point 1: Mục tiêu màn hình */}
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] block text-on-surface-variant">
                  1. Mục tiêu màn hình (Screen Goal)
                </span>
                <p className="text-on-surface font-medium leading-relaxed">{selectedFrame.goal}</p>
              </div>

              {/* Point 2: Điều kiện xuất hiện */}
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] block text-on-surface-variant">
                  2. Điều kiện xuất hiện (Trigger Condition)
                </span>
                <p className="text-on-surface leading-relaxed">{selectedFrame.condition}</p>
              </div>

              {/* Point 3: Hành động chính */}
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] block text-on-surface-variant">
                  3. Hành động chính (Primary Action & CTA State)
                </span>
                <p className="text-on-surface font-semibold leading-relaxed text-emerald-800">
                  {selectedFrame.primaryAction}
                </p>
              </div>

              {/* Point 4: Điều hướng tiếp theo */}
              <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] block text-on-surface-variant">
                  4. Điều hướng tiếp theo (Next Navigation Flow)
                </span>
                <p className="text-on-surface leading-relaxed">{selectedFrame.nextNavigation}</p>
              </div>
            </div>

            {/* Tags */}
            {selectedFrame.tags && (
              <div className="pt-2 border-t border-outline-variant flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-outline font-semibold uppercase">Tags:</span>
                {selectedFrame.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
