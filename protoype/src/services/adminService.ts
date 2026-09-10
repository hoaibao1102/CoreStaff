/**
 * adminService.ts — Mock API layer for SYSTEM_ADMIN (platform-level).
 *
 * SWAP POINT for a real backend: keep signatures, replace bodies with HTTP
 * calls to the platform APIs (/platform/organizations, /platform/accounts).
 *
 * Scope per SRS §3/§8/§4.7/§4.8: create & lock Organizations, provision the
 * first HR account of a tenant (temp password + mustChangePassword), reset
 * passwords (revokes sessions), manually lock/unlock accounts. The platform
 * admin has NO business authority — no approval, no period close.
 *
 * Accounts live in their own store: authService.MOCK_ACCOUNTS is the static
 * demo-login list and cannot hold mutable lock/reset state.
 */
import { AuditLog, Organization, PlatformUserAccount, Workplace } from '../types';
import { MOCK_ORGANIZATIONS, MOCK_PLATFORM_ACCOUNTS, MOCK_WORKPLACES, TENANT_ORG_ID } from '../data/mockData';

// Bumped to v2: store gained `workplaces`. Stale v1 blobs lack the field.
const STORAGE_KEY = 'tvs-timekeeping-mock-admin-v2';
const LEGACY_KEY = 'tvs-timekeeping-mock-admin-v1';
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** BSSID = router MAC address, colon-separated hex. */
const BSSID_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

interface AdminStore {
  organizations: Organization[];
  accounts: PlatformUserAccount[];
  workplaces: Workplace[];
  audit: AuditLog[];
}

export class AdminError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AdminError';
  }
}

function seedStore(): AdminStore {
  return {
    organizations: MOCK_ORGANIZATIONS.map((o) => clone(o)),
    accounts: MOCK_PLATFORM_ACCOUNTS.map((a) => clone(a)),
    workplaces: MOCK_WORKPLACES.map((w) => clone(w)),
    audit: [
      { id: 'adm-seed', timestamp: '21/08/2026 07:00', actor: 'Trần Minh Anh (System Admin)', action: 'Khởi tạo dữ liệu nền tảng.' },
    ],
  };
}

function loadStore(): AdminStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminStore;
      // A persisted store from before this field existed parses without it.
      return { ...parsed, workplaces: parsed.workplaces ?? [] };
    }
  } catch {
    /* ignore */
  }
  const seeded = seedStore();
  try {
    localStorage.removeItem(LEGACY_KEY); // don't leave the pre-v2 blob orphaned
  } catch {
    /* ignore */
  }
  return seeded;
}

function persist(store: AdminStore): AdminStore {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  return clone(store);
}

const simulateLatency = (ms: number) => new Promise((res) => setTimeout(res, ms));

const nowDisplay = () =>
  new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ADMIN_ACTOR = 'Trần Minh Anh (System Admin)';

function addAudit(store: AdminStore, action: string, details?: string) {
  store.audit.unshift({ id: `adm-${Date.now()}-${store.audit.length}`, timestamp: 'Vừa xong', actor: ADMIN_ACTOR, action, details });
}

function withUserCounts(store: AdminStore): AdminStore {
  store.organizations.forEach((org) => {
    org.userCount = store.accounts.filter((a) => a.organizationId === org.id).length;
  });
  return store;
}

/** GET /api/platform/organizations */
export async function fetchOrganizations(): Promise<Organization[]> {
  await simulateLatency(400);
  return clone(withUserCounts(loadStore()).organizations);
}

/** GET /api/platform/audit */
export async function fetchPlatformAudit(): Promise<AuditLog[]> {
  await simulateLatency(200);
  return clone(loadStore().audit);
}

/** Shape the admin form submits for a new tenant's HQ + router signature. */
export interface NewWorkplaceInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  maximumAccuracyMeters: number;
  bssid: string;
  ssid?: string;
}

/** Shared geofence + BSSID validation (SRS defaults: lat ±90, lng ±180). */
function validateWorkplace(wp: NewWorkplaceInput): void {
  if (!wp.name.trim() || !wp.address.trim()) {
    throw new AdminError('WORKPLACE_REQUIRED', 'Tên và địa chỉ văn phòng là bắt buộc.');
  }
  if (
    Number.isNaN(wp.latitude) || wp.latitude < -90 || wp.latitude > 90 ||
    Number.isNaN(wp.longitude) || wp.longitude < -180 || wp.longitude > 180
  ) {
    throw new AdminError('WORKPLACE_GEO_INVALID', 'Tọa độ không hợp lệ (vĩ độ [-90,90], kinh độ [-180,180]).');
  }
  if (wp.allowedRadiusMeters < 10) {
    throw new AdminError('WORKPLACE_GEO_INVALID', 'Bán kính cho phép tối thiểu 10m.');
  }
  if (!BSSID_RE.test(wp.bssid.trim())) {
    throw new AdminError('BSSID_INVALID', 'BSSID không hợp lệ — định dạng AA:BB:CC:DD:EE:FF.');
  }
}

function buildWorkplace(orgId: string, orgCode: string, wp: NewWorkplaceInput, sequence = 1): Workplace {
  return {
    id: `wp-${orgId}-${Date.now()}`,
    organizationId: orgId,
    code: `${orgCode}-${sequence === 1 ? 'HQ' : `W${sequence}`}`,
    name: wp.name.trim(),
    address: wp.address.trim(),
    latitude: wp.latitude,
    longitude: wp.longitude,
    allowedRadiusMeters: wp.allowedRadiusMeters,
    maximumAccuracyMeters: wp.maximumAccuracyMeters,
    allowNetworkAttendance: true,
    allowGpsAttendance: true,
    allowSelfieFallback: true,
    networks: [{
      id: `net-${orgId}-${Date.now()}`,
      name: 'Mạng văn phòng',
      ssid: wp.ssid?.trim() || undefined,
      bssid: wp.bssid.trim().toUpperCase(),
      active: true,
    }],
    active: true,
    createdAt: nowDisplay(),
  };
}

/** Add a Workplace to an existing tenant (org created without one). */
export async function addWorkplace(orgId: string, wp: NewWorkplaceInput): Promise<Workplace[]> {
  await simulateLatency(250);
  validateWorkplace(wp);
  const store = loadStore();
  const org = store.organizations.find((o) => o.id === orgId);
  if (!org) throw new AdminError('ORG_NOT_FOUND', 'Không tìm thấy Organization.');
  const created = buildWorkplace(orgId, org.code, wp, store.workplaces.filter((w) => w.organizationId === orgId).length + 1);
  store.workplaces.push(created);
  addAudit(store, `Thêm vị trí "${created.name}" cho ${org.name} (${org.code}).`, `Chữ ký mạng: ${created.networks[0].bssid}`);
  return clone(persist(store).workplaces.filter((w) => w.organizationId === orgId));
}

/**
 * FR-SYS-01: create Organization + its HQ Workplace (location & router
 * signature) in one step — SYSTEM_ADMIN owns this config for the prototype
 * (deviation from FR-HRCFG-03 which assigns Workplace to HR).
 */
export async function createOrganization(
  input: { name: string; code: string; workplace: NewWorkplaceInput },
): Promise<{ organizations: Organization[]; workplace: Workplace }> {
  await simulateLatency(250);
  const trimmed = input.code.trim().toUpperCase();
  if (!input.name.trim() || !trimmed) throw new AdminError('ORG_REQUIRED', 'Tên và mã Organization là bắt buộc.');
  validateWorkplace(input.workplace);
  const store = loadStore();
  if (store.organizations.some((o) => o.code === trimmed)) {
    throw new AdminError('ORG_CODE_EXISTS', `Mã "${trimmed}" đã tồn tại trên nền tảng.`);
  }
  const orgId = `org-${trimmed.toLowerCase()}`;
  store.organizations.push({
    id: orgId,
    name: input.name.trim(),
    code: trimmed,
    status: 'ACTIVE',
    createdAt: nowDisplay(),
    userCount: 0,
  });
  const workplace = buildWorkplace(orgId, trimmed, input.workplace);
  store.workplaces.push(workplace);
  addAudit(store, `Tạo Organization ${input.name.trim()} (${trimmed}) kèm vị trí "${workplace.name}".`, `Chữ ký mạng: ${workplace.networks[0].bssid}`);
  const organizations = persist(withUserCounts(store)).organizations;
  return { organizations, workplace: clone(workplace) };
}

/** FR-SYS-01: lock/unlock — locked org's business sessions are refused. */
export async function setOrganizationStatus(orgId: string, status: Organization['status']): Promise<Organization[]> {
  await simulateLatency(200);
  const store = loadStore();
  const org = store.organizations.find((o) => o.id === orgId);
  if (!org) throw new AdminError('ORG_NOT_FOUND', 'Không tìm thấy Organization.');
  org.status = status;
  addAudit(store, `${status === 'LOCKED' ? 'Khóa' : 'Mở khóa'} Organization ${org.name} (${org.code}).`);
  return persist(withUserCounts(store)).organizations;
}

/** GET /api/platform/organizations/:id/accounts */
export async function fetchOrgAccounts(orgId: string): Promise<PlatformUserAccount[]> {
  await simulateLatency(300);
  return clone(loadStore().accounts.filter((a) => a.organizationId === orgId));
}

/** GET /api/platform/organizations/:id/workplaces */
export async function fetchWorkplaces(orgId: string): Promise<Workplace[]> {
  await simulateLatency(200);
  return clone(loadStore().workplaces.filter((w) => w.organizationId === orgId));
}

/**
 * Sync read for the check-in loop: the tenant's first active Workplace, or
 * undefined when none is configured. Absence is real absence — an unconfigured
 * tenant must NOT inherit another tenant's geofence/router, so resolveMethod
 * falls through to SELFIE (cf. SRS NETWORK_NOT_CONFIGURED → selfie evidence).
 *
 * ponytail: the store is re-read per call so an admin edit is reflected without
 * a subscription; upgrade path is a useWorkplace(orgId) hook backed by the API.
 */
export function loadActiveWorkplace(orgId: string = TENANT_ORG_ID): Workplace | undefined {
  const found = loadStore().workplaces.find((w) => w.organizationId === orgId && w.active);
  return found ? clone(found) : undefined; // clone() chokes on undefined
}

/** Editable fields of a Workplace (S02 form). Networks replaced wholesale. */
export interface WorkplacePatch {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  allowedRadiusMeters?: number;
  maximumAccuracyMeters?: number;
  allowNetworkAttendance?: boolean;
  allowGpsAttendance?: boolean;
  allowSelfieFallback?: boolean;
  networks?: Workplace['networks'];
}

/**
 * PATCH /api/platform/workplaces/:id — admin edits the tenant's location &
 * router signature. Same validation as create; drives the check-in loop.
 */
export async function updateWorkplace(orgId: string, wpId: string, patch: WorkplacePatch): Promise<Workplace[]> {
  await simulateLatency(250);
  const store = loadStore();
  const wp = store.workplaces.find((w) => w.id === wpId && w.organizationId === orgId);
  if (!wp) throw new AdminError('WORKPLACE_NOT_FOUND', 'Không tìm thấy văn phòng của Organization này.');

  if (patch.name !== undefined || patch.address !== undefined || patch.latitude !== undefined || patch.allowedRadiusMeters !== undefined) {
    validateWorkplace({
      name: patch.name ?? wp.name,
      address: patch.address ?? wp.address,
      latitude: patch.latitude ?? wp.latitude,
      longitude: patch.longitude ?? wp.longitude,
      allowedRadiusMeters: patch.allowedRadiusMeters ?? wp.allowedRadiusMeters,
      maximumAccuracyMeters: patch.maximumAccuracyMeters ?? wp.maximumAccuracyMeters,
      bssid: (patch.networks?.[0]?.bssid ?? wp.networks[0]?.bssid ?? ''),
    });
  }
  Object.assign(wp, patch);
  addAudit(store, `Cập nhật vị trí "${wp.name}" (${wp.code}).`, patch.networks ? `Chữ ký mạng: ${patch.networks.map((n) => n.bssid).join(', ')}` : undefined);
  return clone(persist(store).workplaces.filter((w) => w.organizationId === orgId));
}

/**
 * FR-SYS-02: provision the tenant's FIRST HR account. Normal flow forbids the
 * admin from creating Employee/Manager rows for a tenant (HR does that).
 * Returns the one-time temp password for the UI to display.
 */
export async function provisionFirstHr(
  orgId: string,
  fullName: string,
  email: string,
  employeeCode: string,
): Promise<{ account: PlatformUserAccount; tempPassword: string }> {
  await simulateLatency(300);
  const store = loadStore();
  const org = store.organizations.find((o) => o.id === orgId);
  if (!org) throw new AdminError('ORG_NOT_FOUND', 'Không tìm thấy Organization.');
  if (org.status === 'LOCKED') throw new AdminError('ORG_LOCKED', 'Organization đang bị khóa — không thể cấp tài khoản.');
  if (store.accounts.some((a) => a.organizationId === orgId && a.role === 'HR')) {
    throw new AdminError('HR_EXISTS', 'Tenant đã có tài khoản HR.');
  }
  if (!fullName.trim() || !email.trim() || !employeeCode.trim()) {
    throw new AdminError('HR_REQUIRED', 'Họ tên, email và mã nhân viên là bắt buộc.');
  }

  const tempPassword = `Tmp@${employeeCode.trim().toUpperCase()}`;
  const account: PlatformUserAccount = {
    id: `acct-${Date.now()}`,
    fullName: fullName.trim(),
    email: email.trim(),
    employeeCode: employeeCode.trim().toUpperCase(),
    role: 'HR',
    organizationId: orgId,
    organizationName: org.name,
    status: 'ACTIVE',
    mustChangePassword: true,
  };
  store.accounts.push(account);
  addAudit(store, `Cấp tài khoản HR đầu tiên cho ${org.name}: ${account.fullName} (${account.employeeCode}).`, 'Mật khẩu tạm thời — bắt buộc đổi lần đăng nhập đầu.');
  persist(withUserCounts(store));
  return { account: clone(account), tempPassword };
}

/** FR-AUTH-04 / §4.8: reset password → temp password + mustChangePassword + revoke sessions. */
export async function resetPassword(accountId: string): Promise<{ account: PlatformUserAccount; tempPassword: string }> {
  await simulateLatency(250);
  const store = loadStore();
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) throw new AdminError('ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản.');
  const tempPassword = `Tmp@${account.employeeCode}`;
  account.mustChangePassword = true;
  account.lastLoginAt = undefined; // active sessions revoked
  addAudit(store, `Đặt lại mật khẩu cho ${account.fullName} (${account.employeeCode}).`, 'Mật khẩu tạm thời đã cấp · toàn bộ phiên đang hoạt động bị thu hồi.');
  persist(withUserCounts(store));
  return { account: clone(account), tempPassword };
}

/** §4.7: manual lock/unlock (5 failed logins auto-locks; admin overrides both ways). */
export async function setAccountStatus(accountId: string, status: PlatformUserAccount['status']): Promise<PlatformUserAccount[]> {
  await simulateLatency(200);
  const store = loadStore();
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) throw new AdminError('ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản.');
  account.status = status;
  addAudit(store, `${status === 'ACTIVE' ? 'Mở khóa' : 'Khóa'} tài khoản ${account.fullName} (${account.employeeCode}).`);
  persist(withUserCounts(store));
  return clone(store.accounts);
}

/** Reset the store to seed data (dev/testing convenience). */
export function resetAdminStore(): AdminStore {
  return persist(seedStore());
}
