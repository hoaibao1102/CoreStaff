/**
 * useAttendance.ts — App-core hook holding the employee "today" attendance
 * state and driving the mock services. Swap services impl for real API without
 * touching components.
 *
 * workMode is a simulation/sandbox input (where the employee is working) —
 * it lives in the harness `useSimulation`, not here. This hook only submits
 * raw signals and lets the service decide the actual attendance method.
 */
import { useState, useCallback } from 'react';
import { DayAttendance, AttendanceSignals, SelfieEvidenceResponse } from '../types';
import { AttendanceError, loadToday } from '../services/attendanceService';
import * as attendanceService from '../services/attendanceService';
import { getMockSelfieEvidence } from '../services/evidenceService';

export type AttendanceErrorState = { code: string; message: string } | null;

/** Same shape the service consumes — declared once in types.ts. */
export type SubmitParams = AttendanceSignals;

export function useAttendance() {
  const [todayRecord, setTodayRecord] = useState<DayAttendance>(() => loadToday());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastError, setLastError] = useState<AttendanceErrorState>(null);

  // Camera & Selfie flow (used by OUT_OFFICE / SELFIE fallback)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [previewEvidence, setPreviewEvidence] = useState<SelfieEvidenceResponse | null>(null);

  const clearError = useCallback(() => setLastError(null), []);

  /** One-touch Check-in. BE decides the method from signals. */
  const checkIn = useCallback(
    async (params: SubmitParams) => {
      setIsSubmitting(true);
      setLastError(null);
      try {
        const next = await attendanceService.submitCheckIn(todayRecord, params);
        setTodayRecord(next);
        setPreviewEvidence(null);
      } catch (e) {
        if (e instanceof AttendanceError) setLastError({ code: e.code, message: e.message });
        else throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [todayRecord]
  );

  /** One-touch Check-out. BE decides the method from signals. */
  const checkOut = useCallback(
    async (params: SubmitParams) => {
      setIsSubmitting(true);
      setLastError(null);
      try {
        const next = await attendanceService.submitCheckOut(todayRecord, params);
        setTodayRecord(next);
        setPreviewEvidence(null);
      } catch (e) {
        if (e instanceof AttendanceError) setLastError({ code: e.code, message: e.message });
        else throw e;
      } finally {
        setIsSubmitting(false);
      }
    },
    [todayRecord]
  );

  /** Open camera for the OUT_OFFICE / SELFIE-fallback flow. */
  const openCamera = useCallback((mode: 'CHECK_IN' | 'CHECK_OUT') => {
    setCameraMode(mode);
    setIsCameraOpen(true);
    setLastError(null);
  }, []);

  const captureSelfie = useCallback(
    async (customPhotoUrl?: string) => {
      const evidence = await getMockSelfieEvidence(cameraMode);
      setIsCameraOpen(false);
      setPreviewEvidence({
        ...evidence,
        photoUrl: customPhotoUrl || evidence.photoUrl,
      });
    },
    [cameraMode]
  );

  const confirmSelfiePhoto = useCallback(
    (params: SubmitParams) => {
      if (!previewEvidence) return;
      const withEvidence: SubmitParams = {
        ...params,
        photoUrl: previewEvidence.photoUrl,
        location: previewEvidence.location,
        gpsAccuracy: previewEvidence.location.accuracyMeters,
      };
      if (cameraMode === 'CHECK_IN') return checkIn(withEvidence);
      return checkOut(withEvidence);
    },
    [previewEvidence, cameraMode, checkIn, checkOut]
  );

  const retakeSelfiePhoto = useCallback(() => {
    setPreviewEvidence(null);
    setIsCameraOpen(true);
  }, []);

  const showPreview = useCallback(async (_url?: string) => {
    const evidence = await getMockSelfieEvidence(cameraMode);
    setPreviewEvidence(evidence);
    setIsCameraOpen(false);
  }, [cameraMode]);

  const resetToday = useCallback(async () => {
    setLastError(null);
    setPreviewEvidence(null);
    setIsCameraOpen(false);
    setIsSubmitting(false);
    setTodayRecord(attendanceService.resetToday());
  }, []);

  const setRecord = useCallback((record: DayAttendance) => {
    setTodayRecord(record);
    setPreviewEvidence(null);
    setIsCameraOpen(false);
  }, []);

  return {
    todayRecord,
    isSubmitting,
    isCameraOpen,
    cameraMode,
    previewPhotoUrl: previewEvidence?.photoUrl ?? null,
    previewEvidence,
    lastError,
    clearError,
    checkIn,
    checkOut,
    openCamera,
    closeCamera: () => setIsCameraOpen(false),
    captureSelfie,
    confirmSelfiePhoto,
    retakeSelfiePhoto,
    showPreview,
    resetToday,
    setRecord,
  };
}

/**
 * Readable label for the BE-decided method, shown as a small badge under the
 * button. `networkLabel` is the tenant's matched SSID/name so the badge tracks
 * admin edits instead of hardcoding "TVS_OFFICE_Q8".
 */
export function methodLabel(method: string, gpsDistance?: number, networkLabel?: string): string {
  switch (method) {
    case 'NETWORK': return `📡 Mạng ${networkLabel ?? 'văn phòng'}`;
    case 'GPS': return `📍 GPS (cách ${gpsDistance ?? 0}m)`;
    case 'SELFIE': return '📸 Selfie (bằng chứng ảnh)';
    default: return '';
  }
}