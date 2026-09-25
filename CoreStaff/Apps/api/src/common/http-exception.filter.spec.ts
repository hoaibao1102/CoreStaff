import {
	ArgumentsHost,
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function run(exception: unknown): { status: number; body: Record<string, unknown> } {
	let status = -1;
	let body: Record<string, unknown> = {};
	const res = {
		status(code: number) {
			status = code;
			return this;
		},
		json(b: Record<string, unknown>) {
			body = b;
			return this;
		},
	};
	const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
	new AllExceptionsFilter().catch(exception, host);
	return { status, body };
}

describe('AllExceptionsFilter — SRS §16.1 envelope', () => {
  it('preserves structured policy violation details', () => {
    const details = { usedMinutes: 540, limitMinutes: 480 };
    const result = run(new HttpException({ message: 'SHIFT_DAILY_LABOR_LIMIT_EXCEEDED', details }, 409));
    expect(result.body.error).toEqual({
      code: 'SHIFT_DAILY_LABOR_LIMIT_EXCEEDED',
      message: 'SHIFT_DAILY_LABOR_LIMIT_EXCEEDED',
      details,
    });
  });
	it('maps a coded HttpException (string message) to { success:false, error:{ code } }', () => {
		const r = run(new UnauthorizedException('AUTH_INVALID_CREDENTIALS'));
		expect(r.status).toBe(401);
		expect(r.body).toEqual({
			success: false,
			error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'AUTH_INVALID_CREDENTIALS', details: null },
		});
	});

	it('preserves 423 for LOCKED (custom HttpException)', () => {
		const r = run(new HttpException('AUTH_ACCOUNT_LOCKED', HttpStatus.LOCKED));
		expect(r.status).toBe(423);
		expect((r.body.error as { code: string }).code).toBe('AUTH_ACCOUNT_LOCKED');
	});

	it('maps ForbiddenException default (no code) to FORBIDDEN/403', () => {
		const r = run(new ForbiddenException());
		expect(r.status).toBe(403);
		expect((r.body.error as { code: string }).code).toBe('FORBIDDEN');
	});

	it('maps ValidationPipe array message to VALIDATION_FAILED with details', () => {
		const r = run(new BadRequestException(['email must be an email', 'password too short']));
		expect(r.status).toBe(400);
		const err = r.body.error as { code: string; details: unknown };
		expect(err.code).toBe('VALIDATION_FAILED');
		expect(err.details).toEqual(['email must be an email', 'password too short']);
	});

	it('maps non-HttpException to 500 INTERNAL_ERROR', () => {
		const r = run(new Error('boom'));
		expect(r.status).toBe(500);
		expect((r.body.error as { code: string }).code).toBe('INTERNAL_ERROR');
	});
});
