import * as mongoose from 'mongoose';
import { hasMongoUri, resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

const COMPANY_WEEKDAYS = [1, 2, 3, 4, 5];

function isWeekend(workDate: unknown): boolean {
  if (typeof workDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;
  const weekday = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

async function main() {
  const env = resolveEnv();
  if (!hasMongoUri(env)) throw new Error('MONGODB_URI is not configured.');

  const apply = process.argv.includes('--apply');
  const connection = mongoose.createConnection(env.mongodbUri, { serverSelectionTimeoutMS: 15_000 });

  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Mongo database unavailable.');

    const shifts = db.collection('shift_templates');
    const attendanceDays = db.collection('attendance_days');

    const shiftRows = await shifts.find({}).project({ weekdays: 1 }).toArray();
    const shiftChanges = shiftRows
      .map((row) => ({
        id: row._id,
        before: Array.isArray(row.weekdays) ? row.weekdays : [],
        after: COMPANY_WEEKDAYS,
      }))
      .filter(({ before, after }) => before.length !== after.length || before.some((day, index) => day !== after[index]));

    const attendanceRows = await attendanceDays
      .find({}, { projection: { workDate: 1, workdayType: 1, attendanceStatus: 1 } })
      .toArray();
    const weekendChanges = attendanceRows.filter((row) => isWeekend(row.workDate) && row.workdayType !== 'WEEKLY_OFF');

    console.log(
      `[normalize-company-weekends] mode=${apply ? 'apply' : 'dry-run'} ` +
      `shiftTemplates=${shiftRows.length} shiftsToUpdate=${shiftChanges.length} ` +
      `attendanceDays=${attendanceRows.length} weekendDaysToUpdate=${weekendChanges.length}`,
    );

    if (!apply) return;

    if (shiftChanges.length) {
      await shifts.bulkWrite(shiftChanges.map(({ id }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { weekdays: COMPANY_WEEKDAYS } } },
      })));
    }

    if (weekendChanges.length) {
      await attendanceDays.bulkWrite(weekendChanges.map(({ _id }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              workdayType: 'WEEKLY_OFF',
              // A weekend can still contain real punches/approved OT. Preserve its
              // attendance status and all event data; only correct the schedule type.
            },
          },
        },
      })));
    }

    console.log('[normalize-company-weekends] applied successfully');
  } finally {
    await closeConnection(connection);
  }
}

void main().catch((error) => {
  console.error('[normalize-company-weekends] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
