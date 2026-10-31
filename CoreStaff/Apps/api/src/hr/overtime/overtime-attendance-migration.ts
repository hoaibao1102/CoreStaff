/** Pure offline export inspector; no schemas, clients, environment loading or mutation imports. */
type Row = Record<string, any>;
export interface MigrationSnapshot {
  attendanceDays?: Row[]; attendanceEvents?: Row[]; periods?: Row[];
  summaries?: Row[]; payrollSnapshots?: Row[]; overtimeResults?: Row[]; managerRequests?: Row[];
}
type Source = 'OBSERVED' | 'MANUAL_ADJUSTMENT' | 'CONFIRMED_SCHEDULE' | 'LEGACY_UNKNOWN';
export interface EndpointInspection { dayId: string; endpoint: string; source: Source; reason: string; eventId?: string; requestId?: string; }
function rows(value: unknown): Row[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('INVALID_SNAPSHOT: expected arrays of exported documents');
  return value;
}
function id(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '$oid' in value) return String(value.$oid);
  return '';
}
function time(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && '$date' in value) return time(value.$date);
  return typeof value === 'string' ? Date.parse(value) : NaN;
}
function key(...values: unknown[]): string { return JSON.stringify(values); }
function groups(items: Row[], getKey: (row: Row) => string): Map<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const item of items) { const k = getKey(item); result.set(k, [...(result.get(k) ?? []), item]); }
  return result;
}

export function inspectOvertimeAttendanceV2(snapshot: MigrationSnapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('INVALID_SNAPSHOT: expected an offline export object');
  const periods = rows(snapshot.periods);
  const summaries = rows(snapshot.summaries);
  const payrollSnapshots = rows(snapshot.payrollSnapshots);
  const results = rows(snapshot.overtimeResults);
  const requests = rows(snapshot.managerRequests);
  const explicitContracts: Record<string, number> = Object.create(null);
  for (const result of results) {
    if (typeof result.calculationContract === 'string') explicitContracts[result.calculationContract] = (explicitContracts[result.calculationContract] ?? 0) + 1;
  }
  const days = rows(snapshot.attendanceDays);
  const events = rows(snapshot.attendanceEvents);
  const dayKey = (d: Row) => key(id(d.organizationId), id(d.employeeId), d.workDate);
  const eventKey = (e: Row) => key(id(e.organizationId), id(e.attendanceDayId), e.eventType);
  const dayGroups = groups(days, dayKey);
  const eventGroups = groups(events, eventKey);
  const duplicateGroups = [...dayGroups.values(), ...eventGroups.values()].filter(g => g.length > 1);
  const endpoints: EndpointInspection[] = [];
  let conflicts = 0;
  for (const day of days) {
    for (const [field, endpoint, provenanceField] of [['checkInAt', 'CHECK_IN', 'checkInProvenance'], ['checkOutAt', 'CHECK_OUT', 'checkOutProvenance']]) {
      if (day[field] === undefined || day[field] === null) continue;
      const item: EndpointInspection = { dayId: id(day._id), endpoint, source: 'LEGACY_UNKNOWN', reason: 'NO_MATCHING_VERIFIED_EVENT' };
      const candidates = eventGroups.get(key(id(day.organizationId), id(day._id), endpoint)) ?? [];
      if ((dayGroups.get(dayKey(day))?.length ?? 0) > 1 || candidates.length > 1) {
        item.reason = 'DUPLICATE_KEY_CONFLICT'; conflicts++;
      } else if (id(day._id) && id(day.organizationId) && id(day.employeeId) && candidates.length === 1) {
        const event = candidates[0];
        if (id(event._id) && id(event.employeeId) === id(day.employeeId) && Number.isFinite(time(day[field])) && time(day[field]) === time(event.recordedAt) && ['APPROVED', 'NOT_REQUIRED'].includes(event.approvalStatus) && event.validationStatus === 'VALID') {
          const explicit = event.provenance;
          if (event.method === 'MANUAL') {
            if (explicit?.source === 'CONFIRMED_SCHEDULE' && id(explicit.requestId)) { item.source = 'CONFIRMED_SCHEDULE'; item.requestId = id(explicit.requestId); }
            else if (!explicit || explicit.source === 'MANUAL_ADJUSTMENT') item.source = 'MANUAL_ADJUSTMENT';
          } else if (['GPS', 'NETWORK', 'SELFIE'].includes(event.method) && (!explicit || explicit.source === 'OBSERVED')) item.source = 'OBSERVED';
          if (item.source !== 'LEGACY_UNKNOWN') { item.eventId = id(event._id); item.reason = 'MATCHED_VERIFIED_EVENT'; }
          if (explicit?.eventId && id(explicit.eventId) !== id(event._id)) {
            item.source = 'LEGACY_UNKNOWN'; item.reason = 'EVENT_PROVENANCE_CONFLICT';
            delete item.eventId; delete item.requestId; conflicts++;
          }
          const existing = day[provenanceField];
          if (existing && (existing.source !== item.source || id(existing.eventId) !== item.eventId || id(existing.requestId) !== (item.requestId ?? ''))) {
            item.source = 'LEGACY_UNKNOWN'; item.reason = 'EXISTING_PROVENANCE_CONFLICT'; delete item.eventId; delete item.requestId; conflicts++;
          }
        }
      }
      endpoints.push(item);
    }
  }
  return {
    mode: 'inspect', readOnly: true, databaseConnected: false, writesPerformed: 0,
    inspected: snapshot.attendanceDays !== undefined, rolloutReady: false,
    scope: 'SUPPLIED_OFFLINE_EXPORT_ONLY_NOT_DATABASE_VERIFICATION',
    counts: { attendanceDays: days.length, attendanceEvents: events.length, endpoints: endpoints.length,
      observed: endpoints.filter(e => e.source === 'OBSERVED').length, unknown: endpoints.filter(e => e.source === 'LEGACY_UNKNOWN').length,
      manualAdjustment: endpoints.filter(e => e.source === 'MANUAL_ADJUSTMENT').length, confirmedSchedule: endpoints.filter(e => e.source === 'CONFIRMED_SCHEDULE').length,
      conflicts, duplicates: duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0) },
    endpoints,
    protection: {
      closedPeriods: periods.filter(p => p.status === 'CLOSED').length,
      payrollClaimedPeriods: periods.filter(p => p.payrollRunId).length,
      summaries: summaries.length, payrollSnapshots: payrollSnapshots.length,
      finalOvertimeResults: results.filter(r => r.classificationStatus === 'FINAL').length,
      allArtifactsUnchanged: true,
      rule: 'INSPECTION_ONLY_NO_PATCHES_FOR_ANY_ARTIFACT_INCLUDING_CLOSED_OR_PAYROLL_CLAIMED',
    },
    contracts: {
      legacyV1: results.filter(r => r.calculationContract === undefined || r.calculationContract === 'LEGACY_V1').length,
      explicitContracts,
      legacyAttendanceRequests: requests.filter(r => r.type === 'ATTENDANCE' && r.source !== 'ATTENDANCE_CONFIRMATION').length,
    },
    rollback: ['DISABLE_NEW_V2_CREATION_ONLY_AFTER_SEPARATE_APPROVAL', 'KEEP_V2_READERS', 'NO_DOWNGRADE_TO_V1_ONLY_BINARY', 'NEVER_REWRITE_CLOSED_ARTIFACTS', 'NO_AUTOMATIC_DATA_ROLLBACK'],
    remainingTasks: ['HR_PRODUCT_APPROVAL', 'REPLICA_SET_RACE_TESTS', 'APPROVED_MIGRATION_IMPLEMENTATION', 'APPROVED_BACKUP_AND_OFFLINE_EXPORT', 'LIVE_INDEX_VERIFICATION', 'POLICY_CONFIGURATION_REVIEW', 'CLIENT_COMPATIBILITY_REVIEW', 'EXPLICIT_TENANT_CUTOVER_APPROVAL'],
  };
}
