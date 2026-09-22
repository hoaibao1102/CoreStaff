import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { ManagerAssignmentSchema } from '../../database/schemas/manager-assignment.schema';
import { ManagerRequestSchema } from '../../database/schemas/manager-request.schema';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { EmployeeProfileSchema } from '../../database/schemas/employee-profile.schema';
import { UserSchema } from '../../database/schemas/user.schema';
import { UserSessionSchema } from '../../database/schemas/user-session.schema';
import { ManagerController } from './manager.controller';
import { ManagerScopeService } from './manager-scope.service';
import { ManagerAssignmentService } from './manager-assignment.service';
import { ManagerRequestService } from './manager-request.service';

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: 'ManagerAssignment', schema: ManagerAssignmentSchema },
    { name: 'ManagerRequest', schema: ManagerRequestSchema },
    { name: 'Department', schema: DepartmentSchema },
    { name: 'EmployeeProfile', schema: EmployeeProfileSchema },
    { name: 'User', schema: UserSchema },
    { name: 'UserSession', schema: UserSessionSchema },
  ])],
  controllers: [ManagerController],
  providers: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService, RolesGuard],
  exports: [ManagerScopeService, ManagerAssignmentService, ManagerRequestService],
})
export class ManagerModule {}
