import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, IsArray, ArrayMinSize } from 'class-validator';

export class CreateAssignmentDto {
    @ApiProperty({ description: 'List of user IDs to assign (supports 1 or many users)' })
    @IsArray()
    @IsMongoId({ each: true })
    @ArrayMinSize(1)
    userIds!: string[];

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