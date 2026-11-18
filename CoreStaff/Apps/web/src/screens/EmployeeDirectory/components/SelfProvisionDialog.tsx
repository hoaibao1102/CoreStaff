import { useCallback } from 'react';
import type { Department, Position } from '../../../services/hrService';
import { getDepartments, getPositions } from '../../../services/hrService';
import { useHrResource } from '../../../lib/useHrResource';
import { EmployeeCreateDialog } from './EmployeeCreateDialog';
import type { SelfProvisionDialogProps } from '../types';

/**
 * Phase C — wrapper that opens the shared create form in `me` mode for the
 * caller's own profile. Needs department/position options the directory screen
 * would normally pass, so it fetches them itself only while open (cheap,
 * cacheable, and keeps the profile screen dependency-free).
 */
export function SelfProvisionDialog({
    apiBase,
    open,
    user,
    onOpenChange,
    onCreated,
}: SelfProvisionDialogProps) {
    const loader = useCallback(async () => {
        const [departments, positions] = await Promise.all([
            getDepartments(apiBase, true),
            getPositions(apiBase, { activeOnly: true }),
        ]);
        return {
            departments: departments.filter((d: Department) => d.organizationId === user.organizationId),
            positions: positions.filter((p: Position) => p.organizationId === user.organizationId),
        };
    }, [apiBase, user.organizationId]);

    const refs = useHrResource(open && apiBase ? loader : null);
    const departments = refs.data?.departments ?? [];
    const positions = refs.data?.positions ?? [];

    return (
        <EmployeeCreateDialog
            apiBase={apiBase}
            open={open}
            meMode
            user={user}
            departments={departments}
            positions={positions}
            accounts={[]}
            onOpenChange={onOpenChange}
            onCreated={onCreated}
        />
    );
}
