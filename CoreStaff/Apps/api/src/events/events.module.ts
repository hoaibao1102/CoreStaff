import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsGateway } from './events.gateway';
import { UserSchema } from '../database/schemas/user.schema';
import { UserSessionSchema } from '../database/schemas/user-session.schema';
import { ManagerAssignmentSchema } from '../database/schemas/manager-assignment.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'UserSession', schema: UserSessionSchema },
      { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
    ]),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
