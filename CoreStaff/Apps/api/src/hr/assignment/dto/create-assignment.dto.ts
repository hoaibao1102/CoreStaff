import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
    @ApiProperty({ description: 'User ID to assign' })
    @IsMongoId()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty({ description: 'Department ID' })
    @IsMongoId()
    @IsNotEmpty()
    departmentId!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsMongoId()
    workplaceId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    effectiveFrom?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    effectiveTo?: string;
}