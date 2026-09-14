import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { DepartmentSchema } from '../../database/schemas/department.schema';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'Department', schema: DepartmentSchema }])],
	controllers: [DepartmentController],
	providers: [DepartmentService, RolesGuard],
	exports: [DepartmentService],
})
export class DepartmentModule {}
