import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePositionDto {
	@ApiProperty({ example: 'SWE2', description: 'Unique within the organization.' })
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
