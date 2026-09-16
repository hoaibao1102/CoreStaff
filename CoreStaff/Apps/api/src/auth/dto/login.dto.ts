import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
	@ApiProperty({ example: 'hr-a@tvs.local', description: 'Email or employee code (case-insensitive).' })
	@IsString()
	@IsNotEmpty()
	identifier: string;

	@ApiProperty({ example: 'N3wSecurePass!', format: 'password' })
	@IsString()
	@IsNotEmpty()
	password: string;
}
