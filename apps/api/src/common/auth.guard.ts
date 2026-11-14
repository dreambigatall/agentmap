import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_COOKIE } from './cookies';
import { IS_PUBLIC } from './decorators';
import type { AppRequest } from './request';

/**
 * Runs on every route. Reads the short-lived access token from its cookie and
 * puts the user id on the request. Routes marked @Public() skip the check.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AppRequest>();
    const token: unknown = request.cookies?.[ACCESS_COOKIE];

    if (typeof token === 'string' && token.length > 0) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        request.user = { id: payload.sub };
      } catch {
        // Expired or tampered. Public routes carry on without a user.
      }
    }

    if (isPublic) return true;
    if (!request.user) throw new UnauthorizedException('Sign in to continue');
    return true;
  }
}
