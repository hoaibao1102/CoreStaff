/**
 * Shared harness types — small contracts between harness components and
 * the app-core hooks, so the harness doesn't import hook impl internals.
 */
import { DayAttendance, MethodType, ApproverRequest, EmployeeTab, MainTab, FrameId, WorkMode } from '../types';
import { SimulatedSystemState, InCondition, OutCondition } from './useSimulation';

export interface SubmitParams {
  workMode: WorkMode;
  networkValid: boolean;
  gpsDistance?: number;
  gpsAccuracy?: number;
  photoUrl?: string;
}

export interface UseAttendance {
  todayRecord: DayAttendance;
  isSubmitting: boolean;
  isCameraOpen: boolean;
  cameraMode: 'CHECK_IN' | 'CHECK_OUT';
  previewPhotoUrl: string | null;
  lastError: { code: string; message: string } | null;
  clearError: () => void;
  checkIn: (o: SubmitParams) => Promise<void>;
  checkOut: (o: SubmitParams) => Promise<void>;
  openCamera: (mode: 'CHECK_IN' | 'CHECK_OUT') => void;
  closeCamera: () => void;
  onPhotoCaptured: (url: string) => void;
  confirmSelfiePhoto: (o: SubmitParams) => Promise<void>;
  retakeSelfiePhoto: () => void;
  showPreview: (url: string) => void;
  resetToday: () => Promise<void>;
  setRecord: (record: DayAttendance) => void;
}

export interface UseSimulation {
  workMode: WorkMode;
  setWorkMode: (m: WorkMode) => void;
  inCondition: InCondition;
  setInCondition: (c: InCondition) => void;
  outCondition: OutCondition;
  setOutCondition: (c: OutCondition) => void;
  gpsDistance: number;
  setGpsDistance: (n: number) => void;
  gpsAccuracy: number;
  setGpsAccuracy: (n: number) => void;
  showExceptionSuggestion: boolean;
  setShowExceptionSuggestion: (b: boolean) => void;
  simulatedSystemState: SimulatedSystemState;
  setSimulatedSystemState: (s: SimulatedSystemState) => void;
  reset: () => void;
}

export type { DayAttendance, MethodType, ApproverRequest, EmployeeTab, MainTab, FrameId, WorkMode, SimulatedSystemState, InCondition, OutCondition };
export type RoleMode = 'EMPLOYEE' | 'APPROVER';