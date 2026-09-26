import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OvertimeType } from '../../hr/policies/policies-domain';
import { CalendarExceptionType, WorkdayType } from './enums';

export type OvertimeResultDocument = HydratedDocument<OvertimeResult>;

/** One contiguous eligible span, kept so a day's OT can be audited minute by minute. */
export interface EligibleInterval {
  from: Date;
  to: Date;
}

export const ClassificationStatus = {
  PROVISIONAL: 'PROVISIONAL',
  FINAL: 'FINAL',
} as const;
export type ClassificationStatus = (typeof ClassificationStatus)[keyof typeof ClassificationStatus];

/**
 * TASK-068/069 / SRS §15.11 — the system's verdict on one approved overtime
 * request: how the day classified, and the four minute figures.
 *
 * Minutes only, never money (SRS FR-OT-03:1009, D01): converting eligible
 * minutes to OTPay is Payroll's job via `OvertimePayPolicy`.
 *
 * The request itself stays in `manager_requests` with `type:'OVERTIME'` — see
 * DOCS_DECISION_LOG D38 for that naming deviation from §15.11. `overtimeRequestId`
 * is kept as the field name so a later split into a dedicated collection is a
 * `$ref` change rather than a rename across every reader.
 */
@Schema({ collection: 'overtime_results', timestamps: true })
export class OvertimeResult {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true }) organizationId: string;

  /** The `ManagerRequest` (`type:'OVERTIME'`) this result was computed from. */
  @Prop({ type: 'ObjectId', ref: 'ManagerRequest', required: true }) overtimeRequestId: string;

  @Prop({ type: 'ObjectId', ref: 'AttendanceDay', required: false }) attendanceDayId?: string;

  /**
   * `User` id, matching `AttendanceDay.employeeId` — NOT the EmployeeProfile id
   * that `ManagerRequest.employeeId` holds. Punches are looked up by this field,
   * so writing the profile id here yields silently empty attendance and 0 minutes.
   */
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true }) employeeId: string;

  @Prop({ type: 'ObjectId', ref: 'Department', required: true, index: true }) departmentId: string;

  /** 'YYYY-MM-DD' — the civil VN date the OT belongs to. */
  @Prop({ required: true, index: true }) workDate: string;

  /** 'YYYY-MM' / 'YYYY', stored rather than derived by aggregation ($substr) so the period buckets are indexable for Sprint 6's TimesheetSummary and §30B.2's month/year caps. */
  @Prop({ required: true }) periodKey: string;
  @Prop({ required: true }) yearKey: string;

  @Prop({ required: true, enum: Object.values(OvertimeType) }) overtimeType: OvertimeType;

  /** §7.7: PROVISIONAL on approval, recomputed to FINAL when the period closes (Sprint 6). */
  @Prop({ required: true, enum: Object.values(ClassificationStatus), default: ClassificationStatus.PROVISIONAL })
  classificationStatus: ClassificationStatus;

  @Prop({ required: true, min: 0 }) requestedMinutes: number;
  @Prop({ required: true, min: 0 }) approvedMinutes: number;
  @Prop({ required: true, min: 0 }) actualMinutes: number;
  /** BR-OT-03/AC-OT-04: `approved ∩ actual − scheduled`, never above approvedMinutes. */
  @Prop({ required: true, min: 0 }) eligibleMinutes: number;

  @Prop({ type: [{ from: Date, to: Date }], default: [] }) eligibleIntervals: EligibleInterval[];

  /** Scheduled working minutes of the day, for the combined-daily limit audit trail. */
  @Prop({ required: true, min: 0, default: 0 }) scheduledMinutes: number;

  /** §15.11 — what the calendar said at calculation time, frozen (§AC-HIST-01: old periods must not drift). */
  @Prop({ type: Object, required: false })
  calendarSnapshot?: {
    date: string;
    type?: CalendarExceptionType;
    name?: string;
    overrideType?: WorkdayType;
  };

  /** §15.11 — the shift the scheduled interval was cut from. */
  @Prop({ type: Object, required: false })
  scheduleSnapshot?: {
    shiftTemplateId?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
  };

  /**
   * §30B.2:2627 — "mọi kết quả lưu policyVersion và legalReference đã dùng".
   * Beyond the §15.11 field list, and required by the enforcement rule.
   */
  @Prop({ required: true, min: 1 }) policyVersion: number;
  @Prop({ required: true }) legalReference: string;

  /** Fingerprint of every input. A mismatch on read means "recompute me" (AC-OT-05) without a document fan-out. */
  @Prop({ required: true }) inputHash: string;

  @Prop({ required: false, maxlength: 500 }) calculationNote?: string;
  @Prop({ required: true }) calculatedAt: Date;

  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const OvertimeResultSchema = SchemaFactory.createForClass(OvertimeResult);

/** One current result per request. A recompute upserts; history lives in AuditLog. */
OvertimeResultSchema.index({ organizationId: 1, overtimeRequestId: 1 }, { unique: true });
OvertimeResultSchema.index({ organizationId: 1, employeeId: 1, workDate: 1 });
/** Per-period totals by type — Sprint 6's TimesheetSummary and the month/year cap reads. */
OvertimeResultSchema.index({ organizationId: 1, periodKey: 1, overtimeType: 1 });
OvertimeResultSchema.index({ organizationId: 1, departmentId: 1, workDate: 1 });
