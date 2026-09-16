import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_PATTERN, PASSWORD_POLICY_MESSAGE } from '../strategies/password-policy';

export class ChangePasswordDto {
	@ApiProperty({ example: 'CurrentP4ss!' })
	@IsString()
	@IsNotEmpty()
	currentPassword: string;

	@ApiProperty({
		example: 'N3wSecurePass!',
		minLength: PASSWORD_MIN_LENGTH,
		description: 'At least 8 characters, one letter and one number (SRS §4.3).',
	})
	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@Matches(PASSWORD_POLICY_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
	newPassword: string;

	@ApiProperty({ example: 'N3wSecurePass!' })
	@IsString()
	@IsNotEmpty()
	confirmPassword: string;
}
