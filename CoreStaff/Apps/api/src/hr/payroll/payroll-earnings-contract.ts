export const NO_KPI_EARNINGS_CONTRACT = 'NO_KPI_V2' as const;
export const LEGACY_KPI_EARNINGS_CONTRACT = 'LEGACY_KPI_V1' as const;

export function earningsKpiBonus(snapshot: {
  earningsContract?: string;
  kpiBonus?: number;
}): number {
  if (snapshot.earningsContract === NO_KPI_EARNINGS_CONTRACT) return 0;
  return snapshot.kpiBonus ?? 0;
}
