/**
 * useSimulation.ts — TEST/HARNESS-ONLY hook. Holds the UX Simulation Sandbox
 * state for the two work-mode conditions. Removed entirely when wiring the
 * real backend (the real signals come from network/geolocation/camera).
 */
import { useState, useCallback } from 'react';
import { WorkMode } from '../types';
import { loadActiveWorkplace } from '../services/adminService';

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

/**
 * Which WiFi the simulated device is joined to. Production reads the real
 * BSSID from a native scan (a browser cannot); here it only decides whether we
 * report the tenant's registered router or a foreign one.
 */
export type NetworkSource = 'OFFICE_ROUTER' | 'OTHER_WIFI' | 'NONE';

/** A router that is definitely not the tenant's. */
export const FOREIGN_BSSID = 'DE:AD:BE:EF:00:01';

/** The BSSID a device joined to `source` would report to the backend. */
export function bssidForSource(source: NetworkSource): string | undefined {
  if (source === 'NONE') return undefined;
  if (source === 'OTHER_WIFI') return FOREIGN_BSSID;
  // Office router = whatever the tenant currently has registered, so an admin
  // edit in S02 flips NETWORK↔GPS with no change here.
  return loadActiveWorkplace()?.networks.find((n) => n.active)?.bssid;
}

export function useSimulation() {
  const [workMode, setWorkMode] = useState<WorkMode>('IN_OFFICE');
  const [inCondition, setInCondition] = useState<InCondition>('NETWORK');
  const [outCondition, setOutCondition] = useState<OutCondition>('NO_PHOTO');
  const [networkSource, setNetworkSource] = useState<NetworkSource>('OFFICE_ROUTER');
  const [gpsDistance, setGpsDistance] = useState<number>(18);
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(16);
  const [showExceptionSuggestion, setShowExceptionSuggestion] = useState<boolean>(false);
  const [simulatedSystemState, setSimulatedSystemState] = useState<SimulatedSystemState>('NORMAL');

  const reset = useCallback(() => {
    setWorkMode('IN_OFFICE');
    setInCondition('NETWORK');
    setOutCondition('NO_PHOTO');
    setNetworkSource('OFFICE_ROUTER');
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
    networkSource,
    setNetworkSource,
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

/** Map IN condition + network source + GPS sliders into raw submit signals. */
export function inSignals(
  workMode: WorkMode,
  inCondition: InCondition,
  gpsDistance: number,
  gpsAccuracy: number,
  networkSource: NetworkSource,
) {
  const inOffice = workMode === 'IN_OFFICE';
  const networkClaimed = inOffice && (inCondition === 'NETWORK' || inCondition === 'BOTH');
  const gpsAvailable = inOffice && (inCondition === 'GPS' || inCondition === 'BOTH');
  return {
    observedBssid: networkClaimed ? bssidForSource(networkSource) : undefined,
    gpsDistance: gpsAvailable ? gpsDistance : undefined,
    gpsAccuracy: gpsAvailable ? gpsAccuracy : undefined,
  };
}