import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_PATTERN, PASSWORD_POLICY_MESSAGE } from '../strategies/password-policy';

export class ResetPasswordDto {
	@ApiProperty({
		description: 'Single-use token from the reset email (FR-AUTH-05). Hashed at rest, expires after 15 minutes.',
	})
	@IsString()
	@IsNotEmpty()
	token: string;

	@ApiProperty({ example: 'N3wSecurePass!', minLength: PASSWORD_MIN_LENGTH })
	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@Matches(PASSWORD_POLICY_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
	newPassword: string;
}
