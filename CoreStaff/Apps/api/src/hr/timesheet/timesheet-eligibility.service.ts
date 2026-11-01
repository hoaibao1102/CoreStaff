import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';

export const TIMESHEET_ELIGIBILITY_VERSION = 'TIMESHEET_ELIGIBILITY_V1' as const;

export interface EligibilityPeriod {
  startDate: string;
  endDate: string;
}

export interface EligibilityAssignment {
  id: string;
  departmentId: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  active: boolean;
}

export interface EligibilityCandidate {
  employeeProfileId: string;
  userId: string;
  organizationId: string;
  employmentStatus: string;
  employmentType: string;
  joinDate: string | Date;
  endDate?: string | Date;
  assignments: EligibilityAssignment[];
  scheduledObligationDates: string[];
  fullPeriodLeave?: boolean;
  identityRoles?: string[];
}

export interface EligibilityDecision {
  eligible: boolean;
  reason: 'ELIGIBLE' | 'OUTSIDE_EMPLOYMENT' | 'INELIGIBLE_EMPLOYMENT_STATUS' | 'UNSUPPORTED_PAY_BASIS' | 'NO_EFFECTIVE_ASSIGNMENT' | 'NO_SCHEDULED_OBLIGATION';
  departmentIds: string[];
  assignmentIds: string[];
}

export interface EligibleEmployee extends EligibilityDecision {
  employeeProfileId: string;
  userId: string;
}

export interface EligibilityCandidateSource {
  loadCandidates(organizationId: string, period: EligibilityPeriod, session?: ClientSession): Promise<EligibilityCandidate[]>;
}

function dateOnly(value: string | Date): string {
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function overlaps(from: string, to: string | undefined, period: EligibilityPeriod): boolean {
  return from <= period.endDate && (!to || to >= period.startDate);
}

export function determineTimesheetEligibility(candidate: EligibilityCandidate, period: EligibilityPeriod): EligibilityDecision {
  const joinDate = dateOnly(candidate.joinDate);
  const endDate = candidate.endDate ? dateOnly(candidate.endDate) : undefined;
  const workingStatuses = new Set(['PROBATION', 'ACTIVE', 'ON_LEAVE']);
  const terminalStatuses = new Set(['RESIGNED', 'TERMINATED']);
  if (terminalStatuses.has(candidate.employmentStatus) && !endDate) {
    return { eligible: false, reason: 'OUTSIDE_EMPLOYMENT', departmentIds: [], assignmentIds: [] };
  }
  if (!workingStatuses.has(candidate.employmentStatus) && !terminalStatuses.has(candidate.employmentStatus)) {
    return { eligible: false, reason: 'INELIGIBLE_EMPLOYMENT_STATUS', departmentIds: [], assignmentIds: [] };
  }
  if (!overlaps(joinDate, endDate, period)) {
    return { eligible: false, reason: 'OUTSIDE_EMPLOYMENT', departmentIds: [], assignmentIds: [] };
  }
  if (candidate.employmentType !== 'FULL_TIME') {
    return { eligible: false, reason: 'UNSUPPORTED_PAY_BASIS', departmentIds: [], assignmentIds: [] };
  }
  const effectiveAssignments = candidate.assignments.filter(assignment => assignment.active && overlaps(
    assignment.effectiveFrom ?? joinDate,
    assignment.effectiveTo,
    period,
  ));
  if (!effectiveAssignments.length) {
    return { eligible: false, reason: 'NO_EFFECTIVE_ASSIGNMENT', departmentIds: [], assignmentIds: [] };
  }
  const obligationDates = candidate.scheduledObligationDates.filter(date => date >= period.startDate && date <= period.endDate);
  if (!obligationDates.length) {
    return { eligible: false, reason: 'NO_SCHEDULED_OBLIGATION', departmentIds: [], assignmentIds: [] };
  }
  return {
    eligible: true,
    reason: 'ELIGIBLE',
    departmentIds: [...new Set(effectiveAssignments.map(assignment => assignment.departmentId))].sort(),
    assignmentIds: effectiveAssignments.map(assignment => assignment.id).sort(),
  };
}

@Injectable()
export class TimesheetEligibilityService {
  constructor(private readonly source: EligibilityCandidateSource) {}

  async resolvePeriod(organizationId: string, period: EligibilityPeriod, session?: ClientSession) {
    const candidates = await this.source.loadCandidates(organizationId, period, session);
    const employees: EligibleEmployee[] = candidates
      .filter(candidate => candidate.organizationId === organizationId)
      .map(candidate => ({
        employeeProfileId: candidate.employeeProfileId,
        userId: candidate.userId,
        ...determineTimesheetEligibility(candidate, period),
      }))
      .filter(employee => employee.eligible)
      .sort((left, right) => left.employeeProfileId.localeCompare(right.employeeProfileId));
    return { version: TIMESHEET_ELIGIBILITY_VERSION, period: { ...period }, employees };
  }
}
