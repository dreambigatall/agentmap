import {
  forgotPasswordSchema,
  meSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  tokenSchema,
} from '@skillflow/shared';
import { createZodDto } from 'nestjs-zod';

export class SignUpDto extends createZodDto(signUpSchema) {}
export class SignInDto extends createZodDto(signInSchema) {}
export class TokenDto extends createZodDto(tokenSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class MeDto extends createZodDto(meSchema) {}
