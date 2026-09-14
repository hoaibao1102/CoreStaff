/**
 * useAdmin.ts — App-core hook for SYSTEM_ADMIN platform state. Wraps
 * adminService so components never call the API layer directly.
 */
import { useCallback, useState } from 'react';
import { AuditLog, Organization, PlatformUserAccount, Workplace } from '../types';
import * as adminService from '../services/adminService';
import type { NewWorkplaceInput, WorkplacePatch } from '../services/adminService';

export function useAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [accounts, setAccounts] = useState<PlatformUserAccount[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    const [orgs, logs] = await Promise.all([adminService.fetchOrganizations(), adminService.fetchPlatformAudit()]);
    setOrganizations(orgs);
    setAudit(logs);
  }, []);

  const loadAccounts = useCallback(async (orgId: string) => {
    setAccounts(await adminService.fetchOrgAccounts(orgId));
  }, []);

  /** Workplaces are scoped to the org open in the detail view (like accounts). */
  const loadWorkplaces = useCallback(async (orgId: string) => {
    setWorkplaces(await adminService.fetchWorkplaces(orgId));
  }, []);

  const createOrganization = useCallback(
    async (input: { name: string; code: string; workplace: NewWorkplaceInput }) => {
      const { organizations: orgs } = await adminService.createOrganization(input);
      // No workplace state here: S02 always loads by orgId, and prev may hold
      // a different tenant's list.
      setOrganizations(orgs);
      setAudit(await adminService.fetchPlatformAudit());
      return orgs;
    },
    [],
  );

  /** First workplace for a tenant that was created without one (S02 empty state). */
  const addWorkplace = useCallback(async (orgId: string, workplace: NewWorkplaceInput) => {
    const list = await adminService.addWorkplace(orgId, workplace);
    setWorkplaces(list);
    setAudit(await adminService.fetchPlatformAudit());
    return list;
  }, []);

  const updateWorkplace = useCallback(async (orgId: string, wpId: string, patch: WorkplacePatch) => {
    const list = await adminService.updateWorkplace(orgId, wpId, patch);
    setWorkplaces(list);
    setAudit(await adminService.fetchPlatformAudit());
    return list;
  }, []);

  const setOrganizationStatus = useCallback(async (orgId: string, status: Organization['status']) => {
    const orgs = await adminService.setOrganizationStatus(orgId, status);
    setOrganizations(orgs);
    setAudit(await adminService.fetchPlatformAudit());
    return orgs;
  }, []);

  const provisionFirstHr = useCallback(async (orgId: string, fullName: string, email: string, employeeCode: string) => {
    const result = await adminService.provisionFirstHr(orgId, fullName, email, employeeCode);
    setAccounts(await adminService.fetchOrgAccounts(orgId));
    setOrganizations(await adminService.fetchOrganizations());
    setAudit(await adminService.fetchPlatformAudit());
    return result;
  }, []);

  const resetPassword = useCallback(async (accountId: string) => {
    const result = await adminService.resetPassword(accountId);
    if (result.account) setAccounts(await adminService.fetchOrgAccounts(result.account.organizationId));
    setAudit(await adminService.fetchPlatformAudit());
    return result;
  }, []);

  const setAccountStatus = useCallback(async (accountId: string, status: PlatformUserAccount['status']) => {
    const list = await adminService.setAccountStatus(accountId, status);
    // stay scoped to the org currently open in the detail view
    setAccounts((prev) => (prev.length ? list.filter((a) => a.organizationId === prev[0].organizationId) : list));
    setAudit(await adminService.fetchPlatformAudit());
    return list;
  }, []);

  const reset = useCallback(() => {
    adminService.resetAdminStore();
    setAccounts([]);
    setWorkplaces([]);
    void load();
  }, [load]);

  return {
    organizations,
    accounts,
    workplaces,
    audit,
    load,
    loadAccounts,
    loadWorkplaces,
    createOrganization,
    addWorkplace,
    updateWorkplace,
    setOrganizationStatus,
    provisionFirstHr,
    resetPassword,
    setAccountStatus,
    reset,
  };
}
