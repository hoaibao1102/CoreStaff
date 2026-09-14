import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
	@ApiProperty({ example: 'ENG', description: 'Unique within the organization.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(32)
	code: string;

	@ApiProperty({ example: 'Engineering' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(128)
	name: string;
}
