import { BadRequestException } from '@nestjs/common';

/**
 * QC 3.1 — Bộ luật Lao động 2019 Điều 143: general minimum working age is 15
 * (13–15 only for light work under Điều 145, which this product does not model).
 * Calendar-day comparison so the birthday counts from local midnight.
 */
export const MINIMUM_WORKING_AGE = 15;

export function isWorkingAge(dateOfBirth: string | Date | undefined | null, today = new Date()): boolean {
  if (!dateOfBirth) return true; // optional field
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return true; // format is validated by the DTO
  const cutoff = new Date(dob.getUTCFullYear() + MINIMUM_WORKING_AGE, dob.getUTCMonth(), dob.getUTCDate());
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return cutoff.getTime() <= todayUtc.getTime();
}

export function assertWorkingAge(dateOfBirth: string | Date | undefined | null, today = new Date()): void {
  if (!isWorkingAge(dateOfBirth, today)) {
    throw new BadRequestException('DOB_MINIMUM_AGE');
  }
}
