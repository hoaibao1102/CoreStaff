import { SalaryProfilesScreen } from './SalaryProfilesScreen';
import { AllowancesScreen } from './AllowancesScreen';
import { BonusPoliciesScreen } from './BonusPoliciesScreen';
import { KpiInputsScreen } from './KpiInputsScreen';

type Kind = 'salary-profiles' | 'organization-allowances' | 'attendance-bonus-policies' | 'kpi-inputs';

export function CompensationScreen({
  apiBase,
  kind,
  userRole,
}: {
  apiBase: string | null;
  kind: Kind;
  userRole?: string;
}) {
  if (kind === 'salary-profiles') {
    return <SalaryProfilesScreen apiBase={apiBase} />;
  }

  if (kind === 'organization-allowances') {
    return <AllowancesScreen apiBase={apiBase} />;
  }

  if (kind === 'attendance-bonus-policies') {
    return <BonusPoliciesScreen apiBase={apiBase} />;
  }

  if (kind === 'kpi-inputs') {
    return <KpiInputsScreen apiBase={apiBase} userRole={userRole} />;
  }

  return null;
}
