/**
 * useSimulation.ts — TEST/HARNESS-ONLY hook. Holds the UX Simulation Sandbox
 * state for the two work-mode conditions. Removed entirely when wiring the
 * real backend (the real signals come from network/geolocation/camera).
 */
import { useState, useCallback } from 'react';
import { WorkMode } from '../types';

export type SimulatedSystemState =
  | 'NORMAL'
  | 'LOADING'
  | 'SSO_EXPIRED'
  | 'OFFLINE'
  | 'API_ERROR'
  | 'HOLIDAY'
  | 'LOCKED'
  | 'DUPLICATE';

/** IN_OFFICE condition — which signal is "available" at the device. */
export type InCondition = 'NETWORK' | 'GPS' | 'BOTH' | 'NONE';

/** OUT_OFFICE condition — whether a selfie photo is already captured. */
export type OutCondition = 'HAS_PHOTO' | 'NO_PHOTO';

export function useSimulation() {
  const [workMode, setWorkMode] = useState<WorkMode>('IN_OFFICE');
  const [inCondition, setInCondition] = useState<InCondition>('NETWORK');
  const [outCondition, setOutCondition] = useState<OutCondition>('NO_PHOTO');
  const [gpsDistance, setGpsDistance] = useState<number>(18);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(16);
  const [showExceptionSuggestion, setShowExceptionSuggestion] = useState<boolean>(false);
  const [simulatedSystemState, setSimulatedSystemState] = useState<SimulatedSystemState>('NORMAL');

  const reset = useCallback(() => {
    setWorkMode('IN_OFFICE');
    setInCondition('NETWORK');
    setOutCondition('NO_PHOTO');
    setGpsDistance(18);
    setGpsAccuracy(16);
    setSimulatedSystemState('NORMAL');
    setShowExceptionSuggestion(false);
  }, []);

  return {
    workMode,
    setWorkMode,
    inCondition,
    setInCondition,
    outCondition,
    setOutCondition,
    gpsDistance,
    setGpsDistance,
    gpsAccuracy,
    setGpsAccuracy,
    showExceptionSuggestion,
    setShowExceptionSuggestion,
    simulatedSystemState,
    setSimulatedSystemState,
    reset,
  };
}

/** Map IN condition + GPS sliders into raw submit signals. */
export function inSignals(workMode: WorkMode, inCondition: InCondition, gpsDistance: number, gpsAccuracy: number) {
  const networkValid = workMode === 'IN_OFFICE' && (inCondition === 'NETWORK' || inCondition === 'BOTH');
  const gpsAvailable = workMode === 'IN_OFFICE' && (inCondition === 'GPS' || inCondition === 'BOTH');
  return {
    networkValid,
    gpsDistance: gpsAvailable ? gpsDistance : undefined,
    gpsAccuracy: gpsAvailable ? gpsAccuracy : undefined,
  };
}