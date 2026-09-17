/**
 * Collects ALL validation errors instead of throwing one-by-one.
 * Use this in create/update methods to return ALL errors at once.
 */
import { BadRequestException } from '@nestjs/common';

export interface ValidationError {
    field: string;
    message: string;
}

export class BatchValidator {
    private readonly errors: ValidationError[] = [];

    /** Record an error without throwing. Call throwIfAny() at the end. */
    add(field: string, message: string): void {
        this.errors.push({ field, message });
    }

    /** Check if a document exists and record error if not. */
    checkExists(doc: any | undefined, field: string, message: string): void {
        if (!doc) {
            this.add(field, message);
        }
    }

    /** Check a boolean condition and record error if false. */
    check(condition: boolean, field: string, message: string): void {
        if (!condition) {
            this.add(field, message);
        }
    }

    /** Throw a combined BadRequestException if any were collected. */
    throwIfAny(): void {
        if (this.errors.length > 0) {
            const details = this.errors.map(e => `${e.field}: ${e.message}`).join('; ');
            // Sanitize: remove any control characters, newlines, etc.
            const sanitized = details.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
            throw new BadRequestException({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: sanitized,
                },
            });
        }
    }

    /** Get collected errors as array. */
    getErrors(): ValidationError[] {
        return this.errors;
    }
}
