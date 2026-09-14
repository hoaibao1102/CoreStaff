import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
	@ApiProperty({
		description: 'Single-use token from the reset email (FR-AUTH-05). Hashed at rest, expires after 15 minutes.',
	})
	@IsString()
	@IsNotEmpty()
	token: string;

	@ApiProperty({ example: 'N3wSecurePass!', minLength: 8 })
	@IsString()
	@MinLength(8)
	@Matches(/(?=.*[a-zA-Z])(?=.*\d)/, { message: 'At least 8 characters, one letter and one number required.' })
	newPassword: string;
}
