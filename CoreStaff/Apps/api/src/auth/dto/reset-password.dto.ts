import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';

export class ResetPasswordDto {
	@IsString()
	@IsNotEmpty()
	token: string;

	@IsString()
	@MinLength(8)
	@Matches(/(?=.*[a-zA-Z])(?=.*\d)/, { message: 'At least 8 characters, one letter and one number required.' })
	newPassword: string;
}
