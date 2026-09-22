import { PartialType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional } from 'class-validator';
import { CreateAssignmentDto } from './create-assignment.dto';

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {
    // PATCH targets a single assignment, so it accepts a single userId
    // (CreateAssignmentDto assigns many users via userIds).
    @IsOptional()
    @IsMongoId()
    userId?: string;
}
