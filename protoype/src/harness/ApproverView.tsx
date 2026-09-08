import React from 'react';
import {
  ApproverDashboard,
  ApproverSelfieDetail,
  ApproverGPSDetail,
} from '../components/approver/ApproverViews';
import { ApproverRequest } from '../types';

export interface ApproverViewProps {
  requests: ApproverRequest[];
  selected: ApproverRequest | null;
  onSelect: (req: ApproverRequest | null) => void;
  onApprove: (req: ApproverRequest) => void;
  onOpenRejectModal: (req: ApproverRequest) => void;
  onOpenClarifyModal: (req: ApproverRequest) => void;
}

export const ApproverView: React.FC<ApproverViewProps> = ({
  requests,
  selected,
  onSelect,
  onApprove,
  onOpenRejectModal,
  onOpenClarifyModal,
}) => {
  if (!selected) {
    return (
      <ApproverDashboard
        requests={requests}
        onSelectRequest={onSelect}
        onQuickApprove={onApprove}
        onOpenRejectModal={onOpenRejectModal}
        onOpenClarifyModal={onOpenClarifyModal}
      />
    );
  }

  if (selected.method === 'SELFIE') {
    return (
      <ApproverSelfieDetail
        request={selected}
        onBack={() => onSelect(null)}
        onApprove={onApprove}
        onReject={onOpenRejectModal}
        onClarify={onOpenClarifyModal}
      />
    );
  }

  return (
    <ApproverGPSDetail
      request={selected}
      onBack={() => onSelect(null)}
      onApprove={onApprove}
      onReject={onOpenRejectModal}
      onClarify={onOpenClarifyModal}
    />
  );
};