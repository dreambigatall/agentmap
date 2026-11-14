import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '../../common/cookies';
import { CurrentUser, Public } from '../../common/decorators';
import type { AppRequest, AuthUser } from '../../common/request';
import { ENV, type Env } from '../../config/env';
import {
  ForgotPasswordDto,
  MeDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  TokenDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/** Ten tries a minute per address for anything that checks a secret or sends an email. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get secureCookies(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  @Public()
  @Throttle(STRICT)
  @Post('sign-up')
  @ZodResponse({ status: 201, type: MeDto })
  async signUp(
    @Body() body: SignUpDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, tokens } = await this.auth.signUp(body, req.get('user-agent'));
    setSessionCookies(res, tokens, this.secureCookies);
    return this.auth.me(userId);
  }

  @Public()
  @Throttle(STRICT)
  @Post('sign-in')
  @ZodResponse({ status: 200, type: MeDto })
  async signIn(
    @Body() body: SignInDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, tokens } = await this.auth.signIn(body, req.get('user-agent'));
    setSessionCookies(res, tokens, this.secureCookies);
    return this.auth.me(userId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(204)
  @ApiNoContentResponse()
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      const tokens = await this.sessions.rotate(req.cookies?.[REFRESH_COOKIE], req.get('user-agent'));
      setSessionCookies(res, tokens, this.secureCookies);
    } catch (error) {
      clearSessionCookies(res, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @Post('sign-out')
  @HttpCode(204)
  @ApiNoContentResponse()
  async signOut(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.end(req.cookies?.[REFRESH_COOKIE]);
    clearSessionCookies(res, this.secureCookies);
  }

  @Get('me')
  @ZodResponse({ type: MeDto })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Throttle(STRICT)
  @Post('resend-verification')
  @HttpCode(204)
  @ApiNoContentResponse()
  resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.sendVerification(user.id);
  }

  @Public()
  @Throttle(STRICT)
  @Post('verify-email')
  @HttpCode(204)
  @ApiNoContentResponse()
  verifyEmail(@Body() body: TokenDto): Promise<void> {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @Throttle(STRICT)
  @Post('forgot-password')
  @HttpCode(204)
  @ApiNoContentResponse()
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(body);
  }

  @Public()
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(204)
  @ApiNoContentResponse()
  resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(body);
  }
}
