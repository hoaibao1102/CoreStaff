import { ClientSession, Connection, isValidObjectId, Types } from 'mongoose';
import { ContractStatus, LeaveRequestStatus } from '../../database/schemas/enums';

/**
 * Offboarding cascade (RESIGNED / TERMINATED). Runs inside the caller's
 * transaction so profile, contract, assignments, manager role and sessions
 * change as one unit.
 *
 * Timesheet rule (TIMESHEET_ELIGIBILITY_V1): the employee still owes/earns
 * work up to and including `endDate`, so assignments are clipped to `endDate`
 * rather than deactivated; only windows starting after it are deactivated.
 */
export interface OffboardingImpact {
	contractsTerminated: number;
	assignmentsClipped: number;
	assignmentsDeactivated: number;
	managerAssignmentsClosed: number;
	userDemoted: boolean;
	sessionsRevoked: number;
	leaveRequestsCancelled: number;
	/** Earliest date whose timesheet must be recomputed (day after endDate). */
	invalidateFrom?: Date;
}

export async function runOffboarding(
	connection: Connection,
	session: ClientSession,
	args: { organizationId: string; employeeProfileId: string; userId: string; endDate: string; reason?: string },
): Promise<OffboardingImpact> {
	const { organizationId, employeeProfileId, userId, endDate } = args;
	const end = endDate.slice(0, 10);
	const endAt = new Date(`${end}T00:00:00.000Z`);
	const now = new Date();
	const m = (name: string) => connection.model(name);

	const orgFilter = isValidObjectId(organizationId) ? { $in: [organizationId, new Types.ObjectId(organizationId)] } : organizationId;
	const userFilter = isValidObjectId(userId) ? { $in: [userId, new Types.ObjectId(userId)] } : userId;
	const profileFilter = isValidObjectId(employeeProfileId) ? { $in: [employeeProfileId, new Types.ObjectId(employeeProfileId)] } : employeeProfileId;

	// 1. Contracts: ACTIVE/DRAFT → TERMINATED (ACTIVE gets endDate; DRAFT never started).
	const reason = args.reason?.trim() || `Chấm dứt theo quyết định nghỉ việc ngày ${end}`;
	const contracts = await m('EmploymentContract').updateMany(
		{ organizationId: orgFilter, employeeProfileId: profileFilter, status: { $in: [ContractStatus.ACTIVE, ContractStatus.DRAFT] } },
		{ $set: { status: ContractStatus.TERMINATED, endDate: endAt, statusReason: reason.slice(0, 500), statusChangedAt: now } },
		{ session },
	);

	// 2. Employee assignments (string dates YYYY-MM-DD).
	const deactivated = await m('Assignment').updateMany(
		{ organizationId: orgFilter, userId: userFilter, active: true, effectiveFrom: { $gt: end } },
		{ $set: { active: false } },
		{ session },
	);
	const clipped = await m('Assignment').updateMany(
		{
			organizationId: orgFilter, userId: userFilter, active: true,
			$and: [
				{ $or: [{ effectiveFrom: { $exists: false } }, { effectiveFrom: null }, { effectiveFrom: { $lte: end } }] },
				{ $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: '' }, { effectiveTo: { $gt: end } }] },
			],
		},
		{ $set: { effectiveTo: end } },
		{ session },
	);

	// 3. Manager assignments: de-assign manager immediately upon resignation so department is freed
	const mgrClosed = await m('ManagerAssignment').updateMany(
		{ organizationId: orgFilter, managerUserId: userFilter, active: true },
		{ $set: { active: false, effectiveTo: endAt } },
		{ session },
	);
	const demote = await m('User').updateOne(
		{ _id: userFilter, role: 'DEPARTMENT_MANAGER' },
		{ $set: { role: 'EMPLOYEE' } },
		{ session },
	);

	// 4. Account: only disable login and revoke sessions if resignation is effective today or in the past.
	// If effective date is in the future, the employee is still working until endDate.
	const isPastOrToday = end <= new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
	let sessionsRevoked = 0;
	if (isPastOrToday) {
		const sessions = await m('UserSession').updateMany(
			{ userId: userFilter, revokedAt: { $exists: false } },
			{ $set: { revokedAt: now } },
			{ session },
		);
		sessionsRevoked = sessions.modifiedCount;
		await m('User').updateOne({ _id: userFilter }, { $set: { status: 'DISABLED' } }, { session });
	}

	// 5. Leave requests starting after the last working day are void.
	const leaves = await m('LeaveRequest').updateMany(
		{
			organizationId: orgFilter, employeeId: userFilter, startDate: { $gt: end },
			status: { $in: [LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.APPROVED] },
		},
		{ $set: { status: LeaveRequestStatus.CANCELLED, reviewComment: 'Tự động huỷ do nhân viên nghỉ việc', reviewedAt: now } },
		{ session },
	);

	return {
		contractsTerminated: contracts.modifiedCount,
		assignmentsClipped: clipped.modifiedCount,
		assignmentsDeactivated: deactivated.modifiedCount,
		managerAssignmentsClosed: mgrClosed.modifiedCount,
		userDemoted: demote.modifiedCount > 0,
		sessionsRevoked,
		leaveRequestsCancelled: leaves.modifiedCount,
		invalidateFrom: new Date(endAt.getTime() + 86400000),
	};
}
