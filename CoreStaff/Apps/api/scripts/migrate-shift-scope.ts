import * as mongoose from 'mongoose';
import { hasMongoUri,resolveEnv } from '../src/config/env';
import { closeConnection } from '../src/database/mongo-tools';

async function main(){
 const env=resolveEnv();if(!hasMongoUri(env))throw new Error('MONGODB_URI is not configured.');
 const apply=process.argv.includes('--apply'),connection=mongoose.createConnection(env.mongodbUri,{serverSelectionTimeoutMS:15000});
 try{
  await connection.asPromise();const db=connection.db;if(!db)throw new Error('Mongo database unavailable.');
  const shifts=db.collection('shift_templates'),rules=db.collection('recurring_schedules'),assignments=db.collection('assignments'),profiles=db.collection('employee_profiles');
  const rows=await shifts.find({}).toArray(),recurring=await rules.find({}).toArray(),used=new Set<string>();
  const changes:Array<{id:mongoose.Types.ObjectId;set:Record<string,unknown>;active:boolean}>=[];
  for(const shift of rows){
   const rule=recurring.find(item=>String(item.shiftTemplateId)===String(shift._id));let departmentId:unknown;
   if(rule)departmentId=(await profiles.findOne({organizationId:shift.organizationId,userId:rule.employeeId}))?.departmentId;
   else if(shift.workplaceId)departmentId=(await assignments.findOne({organizationId:shift.organizationId,workplaceId:shift.workplaceId,active:true}))?.departmentId;
   const scope=departmentId?'DEPARTMENT':'ORGANIZATION',weekdays=rule?.weekdays?.length?rule.weekdays:[1,2,3,4,5],effectiveFrom=rule?.effectiveFrom||'2026-01-01';
   const key=[shift.organizationId,scope,departmentId||'',weekdays.join(','),effectiveFrom,rule?.effectiveTo||''].map(String).join('|'),active=shift.active!==false&&!used.has(key);if(active)used.add(key);
   changes.push({id:shift._id,set:{code:shift.code||`LEGACY-${String(shift._id).slice(-6).toUpperCase()}`,name:shift.name||`Ca ${shift.startTime}-${shift.endTime}`,scope,departmentId,weekdays,effectiveFrom,...(rule?.effectiveTo?{effectiveTo:rule.effectiveTo}:{}),active},active});
  }
  console.log(`[migrate:shift-scope] mode=${apply?'apply':'dry-run'} shifts=${rows.length} recurring=${recurring.length} active=${changes.filter(x=>x.active).length} deactivatedDuplicates=${changes.filter(x=>!x.active).length}`);
  if(apply){const indexNames=(await shifts.indexes()).map(index=>index.name);for(const legacy of ['organizationId_1_workplaceId_1','workplaceId_1'])if(indexNames.includes(legacy))await shifts.dropIndex(legacy);for(const change of changes){const set={...change.set};if(!set.departmentId)delete set.departmentId;await shifts.updateOne({_id:change.id},{$set:set,$unset:{workplaceId:1,...(!set.departmentId?{departmentId:1}:{}),...(!('effectiveTo'in set)?{effectiveTo:1}:{})}})}if((await db.listCollections({name:'recurring_schedules'}).toArray()).length)await rules.drop();console.log('[migrate:shift-scope] applied and dropped recurring_schedules')}
 }finally{await closeConnection(connection)}
}
void main().catch(error=>{console.error('[migrate:shift-scope] failed:',error instanceof Error?error.message:error);process.exitCode=1});
