import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../auth/auth.module';
import { RolesGuard } from '../../common/rbac.decorator';
import { PositionSchema } from '../../database/schemas/position.schema';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';

@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'Position', schema: PositionSchema }])],
	controllers: [PositionController],
	providers: [PositionService, RolesGuard],
	exports: [PositionService],
})
export class PositionModule {}
