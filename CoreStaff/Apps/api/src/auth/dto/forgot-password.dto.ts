import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
	@ApiProperty({ example: 'hr-a@tvs.local' })
	@IsEmail()
	@IsNotEmpty()
	email: string;
}
