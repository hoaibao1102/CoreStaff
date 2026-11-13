import { SalaryProfilesScreen } from './SalaryProfilesScreen';
import { AllowancesScreen } from './AllowancesScreen';
import { BonusPoliciesScreen } from './BonusPoliciesScreen';

type Kind = 'salary-profiles' | 'organization-allowances' | 'attendance-bonus-policies';

export function CompensationScreen({
  apiBase,
  kind,
}: {
  apiBase: string | null;
  kind: Kind;

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


  return null;
}
