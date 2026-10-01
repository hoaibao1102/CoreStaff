import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Represents an existing period with date range for overlap validation. */
interface ExistingPeriodRange {
  startDate: Date;
  endDate: Date;
  status: string;
}

export class CreateTimesheetPeriodDto {
  @ApiProperty({ example: '2026-10', description: 'Period key in YYYY-MM format' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Period must be in YYYY-MM format' })
  period: string;

  @ApiProperty({ example: '2026-10-01', description: 'Start date of the period' })
  @IsNotEmpty()
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2026-10-31', description: 'End date of the period' })
  @IsNotEmpty()
  @IsString()
  endDate: string;

  /** Calculate inclusive number of days between two date strings (YYYY-MM-DD). */
  private calculateDayRange(): number {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Validate that the period has between 28 and 31 days (inclusive).
   * This ensures the period covers a valid calendar month range.
   */
  validateDayRange(): void {
    const diffDays = this.calculateDayRange();
    if (diffDays < 28 || diffDays > 31) {
      throw new Error(`PERIOD_DAY_RANGE_INVALID: Period must have between 28 and 31 days (actual: ${diffDays} days)`);
    }
  }

  /**
   * Validate that the period does not start in the past.
   * startDate must be >= today (allow creating periods starting from today).
   */
  validateNotInPast(): void {
    const start = new Date(this.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    if (start < today) {
      throw new Error(`PERIOD_IN_PAST: Period start date (${this.startDate}) cannot be in the past.`);
    }
  }

  /**
   * Validate that the period does not overlap with an existing closed period.
   * New period [newStart, newEnd] must not overlap with any closed period [oldStart, oldEnd].
   * Overlap condition: newStart <= oldEnd && newEnd >= oldStart
   */
  validateNoOverlap(newStartDate: Date, newEndDate: Date, existingPeriods: ExistingPeriodRange[]): void {
    for (const existing of existingPeriods) {
      // Check overlap: newStart <= oldEnd && newEnd >= oldStart
      if (newStartDate <= existing.endDate && newEndDate >= existing.startDate) {
        const existingPeriodStr = existing.startDate.toISOString().substring(0, 10);
        throw new Error(
          `PERIOD_OVERLAP: New period overlaps with existing closed period (${existingPeriodStr}). ` +
          `Please ensure the new period does not overlap with any existing period.`
        );
      }
    }
  }
}
