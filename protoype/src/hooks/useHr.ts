/**
 * useHr.ts — App-core hook for HR period-closing state. Wraps hrService so
 * components never call the API layer directly.
 */
import { useCallback, useState } from 'react';
import { AccountingPeriod, OrganizationStructure, ShiftTemplate } from '../types';
import * as hrService from '../services/hrService';

export function useHr() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [overview, setOverview] = useState<OrganizationStructure | null>(null);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);

  const load = useCallback(async () => {
    const [data, org, shiftList] = await Promise.all([
      hrService.fetchPeriods(),
      hrService.fetchOrgOverview(),
      hrService.fetchShifts(),
    ]);
    setPeriods(data);
    setOverview(org);
    setShifts(shiftList);
  }, []);

  const createShift = useCallback(async (input: hrService.NewShiftInput) => {
    setShifts(await hrService.createShift(input));
  }, []);

  const updateShift = useCallback(async (id: string, patch: Partial<hrService.NewShiftInput> & { active?: boolean }) => {
    setShifts(await hrService.updateShift(id, patch));
  }, []);

  const confirmDepartment = useCallback(async (periodId: string, department: string) => {
    const list = await hrService.confirmDepartment(periodId, department);
    setPeriods(list);
    return list.find((p) => p.id === periodId);
  }, []);

  const closePeriod = useCallback(async (periodId: string) => {
    const list = await hrService.closePeriod(periodId);
    setPeriods(list);
    return list.find((p) => p.id === periodId);
  }, []);

  const reopenPeriod = useCallback(async (periodId: string, reason: string) => {
    const list = await hrService.reopenPeriod(periodId, reason);
    setPeriods(list);
    return list.find((p) => p.id === periodId);
  }, []);

  const exportSnapshot = useCallback(async (periodId: string) => {
    const { period, csv } = await hrService.exportPeriodSnapshot(periodId);
    setPeriods((prev) => prev.map((p) => (p.id === period.id ? period : p)));
    return { period, csv };
  }, []);

  const reset = useCallback(() => {
    setPeriods(hrService.resetHrStore());
    setShifts(hrService.resetShifts());
  }, []);

  return { periods, overview, shifts, load, createShift, updateShift, confirmDepartment, closePeriod, reopenPeriod, exportSnapshot, reset };
}
