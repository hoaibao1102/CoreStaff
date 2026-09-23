import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

type JsonExample = Record<string, unknown> | unknown[] | string | number | boolean | null;

const ERROR_EXAMPLE = {
	success: false,
	error: {
		code: 'VALIDATION_FAILED',
		message: 'Bad Request',
		details: ['property email should not exist'],
	},
};

function successEnvelope(data?: JsonExample): Record<string, unknown> {
	return data === undefined ? { success: true } : { success: true, data };
}

function successSchema(data?: JsonExample): Record<string, unknown> {
	const properties: Record<string, unknown> = {
		success: { type: 'boolean', example: true },
	};
	if (data !== undefined) {
		properties.data = { example: data };
	}
	return {
		type: 'object',
		required: data === undefined ? ['success'] : ['success', 'data'],
		properties,
	};
}

export function ApiSuccess(description: string, data?: JsonExample, status = HttpStatus.OK): MethodDecorator {
	return ApiResponse({
		status,
		description,
		schema: successSchema(data),
		example: successEnvelope(data),
	});
}

export function ApiCreatedSuccess(description: string, data?: JsonExample): MethodDecorator {
	return ApiSuccess(description, data, HttpStatus.CREATED);
}

export function ApiErrorExamples(): MethodDecorator {
	return applyDecorators(
		ApiResponse({
			status: HttpStatus.BAD_REQUEST,
			description: 'Validation failed or request is invalid.',
			schema: {
				type: 'object',
				required: ['success', 'error'],
				properties: {
					success: { type: 'boolean', example: false },
					error: {
						type: 'object',
						required: ['code', 'message', 'details'],
						properties: {
							code: { type: 'string', example: 'VALIDATION_FAILED' },
							message: { type: 'string', example: 'Bad Request' },
							details: { example: ['property email should not exist'] },
						},
					},
				},
			},
			example: ERROR_EXAMPLE,
		}),
		ApiResponse({
			status: HttpStatus.UNAUTHORIZED,
			description: 'Authentication failed or session expired.',
			example: {
				success: false,
				error: { code: 'AUTH_SESSION_EXPIRED', message: 'AUTH_SESSION_EXPIRED', details: null },
			},
		}),
		ApiResponse({
			status: HttpStatus.FORBIDDEN,
			description: 'Authenticated user does not have permission.',
			example: {
				success: false,
				error: { code: 'FORBIDDEN', message: 'Forbidden', details: null },
			},
		}),
		ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Requested resource was not found.',
			example: {
				success: false,
				error: { code: 'NOT_FOUND', message: 'NOT_FOUND', details: null },
			},
		}),
		ApiResponse({
			status: HttpStatus.CONFLICT,
			description: 'Request conflicts with current data.',
			example: {
				success: false,
				error: { code: 'EMPLOYEE_CODE_TAKEN', message: 'EMPLOYEE_CODE_TAKEN', details: null },
			},
		}),
	);
}

export const userExample = {
	_id: '66f1b2c3d4e5f60718293a4b',
	organizationId: '66f1b2c3d4e5f60718293a40',
	email: 'hr-a@tvs.local',
	emailN: 'hr-a@tvs.local',
	employeeCode: 'HR-A',
	fullName: 'HR A',
	role: 'HR',
	status: 'ACTIVE',
	mustChangePassword: false,
	failedLoginCount: 0,
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

export const departmentExample = {
	_id: '66f1b2c3d4e5f60718293b01',
	organizationId: '66f1b2c3d4e5f60718293a40',
	code: 'ENG',
	name: 'Engineering',
	active: true,
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

export const positionExample = {
	_id: '66f1b2c3d4e5f60718293c01',
	organizationId: '66f1b2c3d4e5f60718293a40',
	code: 'SWE',
	name: 'Software Engineer',
	active: true,
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

export const employeeExample = {
	_id: '66f1b2c3d4e5f60718293d01',
	organizationId: '66f1b2c3d4e5f60718293a40',
	userId: '66f1b2c3d4e5f60718293a4b',
	employeeCode: 'TVS-0248',
	employmentType: 'FULL_TIME',
	employmentStatus: 'PROBATION',
	joinDate: '2026-09-16T00:00:00.000Z',
	email: 'employee@tvs.local',
	phone: '0900000000',
	departmentId: '66f1b2c3d4e5f60718293b01',
	positionId: '66f1b2c3d4e5f60718293c01',
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

/** Read endpoints retain reference IDs and add nullable display names. */
export const employeeReadExample = {
    ...employeeExample,
    fullName: 'Nguyen Van An',
    departmentName: 'Engineering',
    positionName: 'Developer',
    managerName: null,
};

export const employmentHistoryExample = {
	_id: '66f1b2c3d4e5f60718293e01',
	organizationId: '66f1b2c3d4e5f60718293a40',
	employeeProfileId: '66f1b2c3d4e5f60718293d01',
	previousStatus: 'PROBATION',
	newStatus: 'ACTIVE',
	effectiveDate: '2026-09-16T00:00:00.000Z',
	reason: 'Probation completed',
	changedBy: '66f1b2c3d4e5f60718293a4b',
	createdAt: '2026-09-15T03:20:00.000Z',
};

export const contractExample = {
	_id: '66f1b2c3d4e5f60718293f01',
	organizationId: '66f1b2c3d4e5f60718293a40',
	employeeProfileId: '66f1b2c3d4e5f60718293d01',
	contractType: 'FIXED_TERM',
	status: 'ACTIVE',
	effectiveDate: '2026-01-01T00:00:00.000Z',
	expiryDate: '2026-12-31T00:00:00.000Z',
	endDate: null,
	statusReason: 'Ky hop dong chinh thuc sau thu viec.',
	statusChangedAt: '2026-09-15T03:20:00.000Z',
	note: 'Xác định thời hạn 12 tháng.',
	createdAt: '2026-09-15T03:20:00.000Z',
	updatedAt: '2026-09-15T03:20:00.000Z',
};

/** Read endpoints add resolved owner names + the derived expiry warning. */
export const contractReadExample = {
	...contractExample,
	employeeFullName: 'Nguyen Van An',
	employeeCode: 'TVS-0248',
	isExpiringSoon: true,
	isExpired: false,
	expiryWarningDays: 15,
};

export const employeeDocumentExample = {
	_id: '66f1b2c3d4e5f60718293f02',
	organizationId: '66f1b2c3d4e5f60718293a40',
	employeeProfileId: '66f1b2c3d4e5f60718293d01',
	contractId: '66f1b2c3d4e5f60718293f01',
	originalName: 'HDLD_2026.pdf',
	mimeType: 'application/pdf',
	sizeBytes: 245760,
	uploadedBy: '66f1b2c3d4e5f60718293a4b',
	createdAt: '2026-09-15T03:20:00.000Z',
};

/** TASK-038 — field shape is an engineering proposal, see insurance-profile.schema.ts. */
export const insuranceProfileExample = {
	_id: '66f1b2c3d4e5f60718293f03',
	organizationId: '66f1b2c3d4e5f60718293a40',
	employeeId: '66f1b2c3d4e5f60718293d01',
	effectiveFrom: '2026-09-25T00:00:00.000Z',
	participatesSocialInsurance: true,
	participatesHealthInsurance: true,
	participatesUnemploymentInsurance: true,
	version: 1,
	createdAt: '2026-09-22T03:20:00.000Z',
	updatedAt: '2026-09-22T03:20:00.000Z',
};

/** TASK-039 — SRS §30D.3. Rate/cap shapes are an engineering proposal, see insurance-policy.schema.ts. */
export const insurancePolicyExample = {
	_id: '66f1b2c3d4e5f60718293f04',
	organizationId: '66f1b2c3d4e5f60718293a40',
	effectiveFrom: '2026-09-25T00:00:00.000Z',
	legalReference: 'Luật BHXH 41/2024/QH15',
	socialInsuranceEmployeeRate: 0.08,
	healthInsuranceEmployeeRate: 0.015,
	unemploymentInsuranceEmployeeRate: 0.01,
	salaryBaseRules: [
		{ type: 'SOCIAL_INSURANCE', floorAmount: null },
		{ type: 'HEALTH_INSURANCE', floorAmount: null },
		{ type: 'UNEMPLOYMENT_INSURANCE', floorAmount: null },
	],
	capRules: [
		{ type: 'SOCIAL_INSURANCE', capAmount: null },
		{ type: 'HEALTH_INSURANCE', capAmount: null },
		{ type: 'UNEMPLOYMENT_INSURANCE', capAmount: null },
	],
	// Illustrative only — no employer rate is documented anywhere in Docs/ (confirmed by the
	// 2026-09-22 audit); real values must come from HR/legal before this policy is used for real.
	employerContributionRates: [
		{ type: 'SOCIAL_INSURANCE', rate: 0.1 },
		{ type: 'HEALTH_INSURANCE', rate: 0.1 },
		{ type: 'UNEMPLOYMENT_INSURANCE', rate: 0.1 },
	],
	version: 1,
	createdAt: '2026-09-22T03:20:00.000Z',
	updatedAt: '2026-09-22T03:20:00.000Z',
};
