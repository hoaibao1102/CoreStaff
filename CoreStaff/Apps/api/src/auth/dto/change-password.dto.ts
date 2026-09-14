import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
	@ApiProperty({ example: 'TvsAdmin1!' })
	@IsString()
	@IsNotEmpty()
	currentPassword: string;

	@ApiProperty({
		example: 'N3wSecurePass!',
		minLength: 8,
		description: 'At least 8 characters, one letter and one number (SRS §4.3).',
	})
	@IsString()
	@MinLength(8)
	@Matches(/(?=.*[a-zA-Z])(?=.*\d)/, { message: 'At least 8 characters, one letter and one number required.' })
	newPassword: string;

	@ApiProperty({ example: 'N3wSecurePass!' })
	@IsString()
	@IsNotEmpty()
	confirmPassword: string;
}
