import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
	@IsString()
	@IsNotEmpty()
	currentPassword: string;

	@IsString()
	@MinLength(8)
	@Matches(/(?=.*[a-zA-Z])(?=.*\d)/, { message: 'At least 8 characters, one letter and one number required.' })
	newPassword: string;

	@IsString()
	@IsNotEmpty()
	confirmPassword: string;
}
