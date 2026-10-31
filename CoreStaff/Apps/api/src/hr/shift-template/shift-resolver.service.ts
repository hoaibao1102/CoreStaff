import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model } from 'mongoose';
import { EmployeeProfileDocument } from '../../database/schemas/employee-profile.schema';
import { ShiftTemplateDocument } from '../../database/schemas/shift-template.schema';
import { ShiftScope } from '../../database/schemas/enums';

function withSession<T>(query: any, session?: ClientSession): T {
  return session ? query.session(session) : query;
}

@Injectable()
export class ShiftResolverService {
  constructor(
    @InjectModel('ShiftTemplate') private readonly shifts: Model<ShiftTemplateDocument>,
    @InjectModel('EmployeeProfile') private readonly employees: Model<EmployeeProfileDocument>,
  ) {}

  async resolveForEmployeeDate(
    organizationId: string,
    employeeId: string,
    date: string,
    session?: ClientSession,
  ) {
    const profileQuery = this.employees.findOne({ organizationId, userId: employeeId }).select('departmentId');
    const profile = await withSession<any>(profileQuery, session).lean();
    const common = {
      organizationId,
      active: true,
      weekdays: isoWeekday(date),
      effectiveFrom: { $lte: date },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: date } }],
    };
    const scopes: any[] = [{ scope: ShiftScope.ORGANIZATION }];
    if (profile?.departmentId) scopes.push({ scope: ShiftScope.DEPARTMENT, departmentId: profile.departmentId });
    const shiftQuery = this.shifts.find({ ...common, $and: [{ $or: common.$or }, { $or: scopes }] }).sort({ scope: 1, effectiveFrom: -1, _id: 1 });
    const rows = await withSession<any>(shiftQuery, session).lean();
    const department = rows.filter((row: any) => row.scope === ShiftScope.DEPARTMENT);
    const organization = rows.filter((row: any) => row.scope === ShiftScope.ORGANIZATION);
    const preferred = department.length ? department : organization;
    if (preferred.length > 1) throw new Error('OVERLAPPING_EFFECTIVE_SHIFTS');
    return preferred[0] ?? null;
  }
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}
