import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePositionDto {
	@ApiProperty({ example: '66f1b2c3d4e5f60718293b01', description: 'Owning department (must exist in the tenant).' })
	@IsMongoId()
	departmentId: string;

	@ApiProperty({ example: 'SWE2', description: 'Unique within the department.' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(32)
	code: string;

	@ApiProperty({ example: 'Software Engineer II' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(128)
	name: string;
}
