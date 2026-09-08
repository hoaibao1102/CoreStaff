/**
 * approverService.ts — Mock API layer for approver (approval) operations.
 *
 * SWAP POINT for a real backend: keep signatures, replace bodies with HTTP
 * calls to the ERP approval APIs (POST approve / reject / request-clarify).
 * Each function returns the updated `ApproverRequest[]`.
 *
 * State is persisted to localStorage so reloads keep history and both the
 * Employee and Approver harness views share the same authoritative store
 * (simulating server-side state).
 */
import { ApproverRequest, ApprovalStatus } from '../types';
import { MOCK_APPROVER_REQUESTS } from '../data/mockData';

const STORAGE_KEY = 'tvs-timekeeping-mock-approver-v1';
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function loadStore(): ApproverRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ApproverRequest[];
  } catch {
    /* ignore */
  }
  return MOCK_APPROVER_REQUESTS.map((r) => clone(r));
}

function persist(store: ApproverRequest[]): ApproverRequest[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  return store.map((r) => clone(r));
}

const simulateLatency = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** GET /api/approval/requests */
export async function fetchApproverRequests(): Promise<ApproverRequest[]> {
  await simulateLatency(400);
  return clone(loadStore());
}

/** Approve a request. */
export async function approveRequest(id: string): Promise<ApproverRequest[]> {
  await simulateLatency(200);
  const store = loadStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx >= 0) {
    store[idx] = {
      ...store[idx],
      status: 'APPROVED',
      auditTrail: [
        ...store[idx].auditTrail,
        { id: `apv-${Date.now()}`, timestamp: 'Vừa xong', actor: 'Lê Hoàng Hải (Approver)', action: 'Đã phê duyệt ngày công hợp lệ.' },
      ],
    };
  }
  return persist(store);
}

export async function rejectRequest(id: string, reason: string): Promise<ApproverRequest[]> {
  await simulateLatency(200);
  const store = loadStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx >= 0) {
    store[idx] = {
      ...store[idx],
      status: 'REJECTED',
      rejectionReason: reason,
      auditTrail: [
        ...store[idx].auditTrail,
        { id: `rej-${Date.now()}`, timestamp: 'Vừa xong', actor: 'Lê Hoàng Hải (Approver)', action: `Từ chối phê duyệt: ${reason}` },
      ],
    };
  }
  return persist(store);
}

export async function clarifyRequest(id: string, message: string): Promise<ApproverRequest[]> {
  await simulateLatency(200);
  const store = loadStore();
  const idx = store.findIndex((r) => r.id === id);
  if (idx >= 0) {
    store[idx] = {
      ...store[idx],
      status: 'CLARIFICATION_REQUESTED',
      auditTrail: [
        ...store[idx].auditTrail,
        { id: `cla-${Date.now()}`, timestamp: 'Vừa xong', actor: 'Lê Hoàng Hải (Approver)', action: `Yêu cầu giải trình: ${message}` },
      ],
    };
  }
  return persist(store);
}

/** Reset the store to seed data (dev/testing convenience). */
export function resetApproverStore(): ApproverRequest[] {
  const fresh = MOCK_APPROVER_REQUESTS.map((r) => clone(r));
  return persist(fresh);
}

export type { ApprovalStatus };
export type ApprovalAction = 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';