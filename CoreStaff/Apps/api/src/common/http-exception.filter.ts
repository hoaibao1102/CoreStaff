import {
	ArgumentsHost,
	Catch,
	HttpException,
	HttpStatus,
	ExceptionFilter,
} from '@nestjs/common';

/** Machine-readable code used when no explicit SRS §17 code is supplied. */
const STATUS_DEFAULT_CODE: Record<number, string> = {
	[HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
	[HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
	[HttpStatus.FORBIDDEN]: 'FORBIDDEN',
	[HttpStatus.NOT_FOUND]: 'NOT_FOUND',
	[HttpStatus.LOCKED]: 'LOCKED',
};

/** §16.1 error envelope. */
interface ErrorEnvelope {
	success: false;
	error: { code: string; message: string; details: unknown };
}

function looksLikeCode(s: string): boolean {
	return /^[A-Z][A-Z0-9_]*$/.test(s);
}

/**
 * Global filter enforcing the SRS §16.1 unified error shape:
 * `{ success:false, error:{ code, message, details } }`.
 *
 * Services throw typed exceptions whose string message is the SRS §17 code
 * (e.g. `new LockedException('AUTH_ACCOUNT_LOCKED')`). ValidationPipe rejects
 * arrive with a string[] message → `VALIDATION_FAILED` with the list in details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const res = ctx.getResponse();

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let envelope: ErrorEnvelope;

		if (exception instanceof HttpException) {
			status = exception.getStatus();
			const body = exception.getResponse();

			if (typeof body === 'string') {
				envelope = { success: false, error: { code: codeFromBody(body, status), message: body, details: null } };
			} else {
				const obj = body as { code?: string; message?: string | string[]; error?: string; details?: unknown };
				if (Array.isArray(obj.message)) {
					envelope = { success: false, error: { code: STATUS_DEFAULT_CODE[status] ?? 'VALIDATION_FAILED', message: obj.error ?? 'Invalid request.', details: obj.message } };
				} else {
					const msg = typeof obj.message === 'string' ? obj.message : (obj.error ?? 'Request failed.');
					envelope = { success: false, error: { code: typeof obj.code === 'string' && looksLikeCode(obj.code) ? obj.code : codeFromBody(msg, status), message: msg, details: obj.details ?? null } };
				}
			}
		} else {
			envelope = { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error.', details: null } };
		}

		res.status(status).json(envelope);
	}
}

function codeFromBody(msg: string, status: number): string {
	return looksLikeCode(msg) ? msg : (STATUS_DEFAULT_CODE[status] ?? 'ERROR');
}
