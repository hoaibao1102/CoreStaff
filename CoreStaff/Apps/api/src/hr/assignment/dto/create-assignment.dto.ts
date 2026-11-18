import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsISO8601, IsArray, ArrayMinSize } from 'class-validator';

export class CreateAssignmentDto {
    @ApiProperty({ description: 'List of user IDs to assign (supports 1 or many users)' })
    @IsOptional()
    @IsArray({ message: 'Danh sách nhân viên (userIds) phải là một mảng.' })
    @IsMongoId({ each: true, message: 'Mã nhân viên (userIds) không hợp lệ.' })
    @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một nhân viên để phân công.' })
    userIds!: string[];

    /** Backward-compatible alias for clients that assign one employee. */
    @ApiProperty({ required: false, description: 'Legacy alias for userIds when assigning one user' })
    @IsOptional()
    @IsMongoId({ message: 'Mã nhân viên (userId) không hợp lệ.' })
    userId?: string;

    @ApiProperty({ description: 'Department ID' })
    @IsMongoId({ message: 'Mã phòng ban (departmentId) không hợp lệ.' })
    @IsNotEmpty({ message: 'Vui lòng chọn phòng ban.' })
    departmentId!: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsMongoId({ message: 'Mã nơi làm việc (workplaceId) không hợp lệ.' })
    workplaceId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsISO8601({ strict: true }, { message: 'Ngày bắt đầu (effectiveFrom) phải đúng định dạng YYYY-MM-DD.' })
    effectiveFrom?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsISO8601({ strict: true }, { message: 'Ngày kết thúc (effectiveTo) phải đúng định dạng YYYY-MM-DD.' })
    effectiveTo?: string;
}
