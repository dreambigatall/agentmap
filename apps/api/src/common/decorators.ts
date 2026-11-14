import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import type { Level } from '@skillflow/shared';
import type { AppRequest, AuthUser, WorkspaceAccess } from './request';

export const IS_PUBLIC = 'isPublic';
/** The route needs no sign-in. Everything else does. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const MIN_LEVEL_KEY = 'minLevel';
/** The lowest workspace level allowed to call the route. Defaults to reviewer. */
export const MinLevel = (level: Level) => SetMetadata(MIN_LEVEL_KEY, level);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AppRequest>().user;
  if (!user) throw new InternalServerErrorException('CurrentUser used on a public route');
  return user;
});

export const CurrentWorkspace = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): WorkspaceAccess => {
    const access = ctx.switchToHttp().getRequest<AppRequest>().workspace;
    if (!access) throw new InternalServerErrorException('CurrentWorkspace used without WorkspaceGuard');
    return access;
  },
);
