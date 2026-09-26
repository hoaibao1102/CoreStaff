import { Injectable } from '@nestjs/common';
import { vnTimeToUtc } from '../../common/vietnam-time';

export interface ShiftInfo {
  startTime: string; // "08:30"
  endTime: string;   // "17:30"
  breakMinutes: number; // e.g. 60
  gracePeriodMinutes: number; // e.g. 15
}

export interface CalculationResult {
  lateMinutes: number;
  earlyMinutes: number;
  workingMinutes: number | null;
}

@Injectable()
export class AttendanceCalculatorService {
  /**
   * Tính toán đi trễ, về sớm và tổng số phút làm việc thực tế theo SRS §6.4.
   */
  calculate(
    workDate: string, // YYYY-MM-DD
    checkInAt: Date,
    checkOutAt: Date | undefined,
    shift: ShiftInfo,
  ): CalculationResult {
    const scheduleStart = this.parseDateTime(workDate, shift.startTime);
    const scheduleEnd = this.parseDateTime(workDate, shift.endTime);

    // Tính lateMinutes: trễ sau khi đã cộng thời gian ân hạn
    const allowedCheckInTime = new Date(scheduleStart.getTime() + (shift.gracePeriodMinutes || 0) * 60000);
    let lateMinutes = 0;
    if (checkInAt.getTime() > allowedCheckInTime.getTime()) {
      lateMinutes = Math.floor((checkInAt.getTime() - allowedCheckInTime.getTime()) / 60000);
    }

    let earlyMinutes = 0;
    let workingMinutes: number | null = null;

    if (checkOutAt) {
      // Tính earlyMinutes: về trước giờ kết thúc ca
      if (checkOutAt.getTime() < scheduleEnd.getTime()) {
        earlyMinutes = Math.floor((scheduleEnd.getTime() - checkOutAt.getTime()) / 60000);
      }

      // Tính workingMinutes = (checkOutAt - checkInAt) - breakMinutes
      const totalSpanMinutes = Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / 60000);
      const breakMins = shift.breakMinutes || 0;
      workingMinutes = totalSpanMinutes >= breakMins ? totalSpanMinutes - breakMins : totalSpanMinutes;
    }

    return {
      lateMinutes,
      earlyMinutes,
      workingMinutes,
    };
  }

  /**
   * Chuyển đổi workDate (YYYY-MM-DD) và time (HH:mm) thành Date object
   */
  private parseDateTime(workDate: string, timeStr: string): Date {
    return new Date(vnTimeToUtc(workDate, timeStr));
  }
}
