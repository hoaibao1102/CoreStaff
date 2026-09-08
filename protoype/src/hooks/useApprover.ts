/**
 * useApprover.ts — App-core hook for approver (approval) state. Wraps
 * approverService so components never call the API layer directly.
 */
import { useState, useCallback } from 'react';
import { ApproverRequest } from '../types';
import * as approverService from '../services/approverService';

export function useApprover() {
  const [approverRequests, setApproverRequests] = useState<ApproverRequest[]>([]);

  const loadRequests = useCallback(async () => {
    const data = await approverService.fetchApproverRequests();
    setApproverRequests(data);
  }, []);

  const approve = useCallback(async (req: ApproverRequest) => {
    const list = await approverService.approveRequest(req.id);
    setApproverRequests(list);
    return list.find((r) => r.id === req.id);
  }, []);

  const reject = useCallback(async (id: string, reason: string) => {
    const list = await approverService.rejectRequest(id, reason);
    setApproverRequests(list);
    return list.find((r) => r.id === id);
  }, []);

  const clarify = useCallback(async (id: string, message: string) => {
    const list = await approverService.clarifyRequest(id, message);
    setApproverRequests(list);
    return list.find((r) => r.id === id);
  }, []);

  const reset = useCallback(() => {
    setApproverRequests(approverService.resetApproverStore());
  }, []);

  return { approverRequests, loadRequests, approve, reject, clarify, reset };
}