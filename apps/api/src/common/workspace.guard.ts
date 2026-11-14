import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { atLeast, type Level } from '@skillflow/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UUID_PATTERN } from './crypto';
import { MIN_LEVEL_KEY } from './decorators';
import type { AppRequest } from './request';

const LAST_SEEN_EVERY_MS = 5 * 60 * 1000;

/**
 * Guards every route under /w/:workspaceId.
 * 1. The caller must be a member of that workspace, or the route answers "not found",
 *    so outsiders cannot even learn that the workspace exists.
 * 2. The caller's level must meet the route's @MinLevel (reviewer when not set).
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const workspaceId = request.params.workspaceId;
    const userId = request.user?.id;

    if (!userId || typeof workspaceId !== 'string' || !UUID_PATTERN.test(workspaceId)) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true, level: true, lastSeenAt: true },
    });
    if (!membership) throw new NotFoundException('Workspace not found');

    const required =
      this.reflector.getAllAndOverride<Level>(MIN_LEVEL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'reviewer';
    if (!atLeast(membership.level, required)) {
      throw new ForbiddenException(`This needs ${required} access or higher`);
    }

    request.workspace = { workspaceId, membershipId: membership.id, level: membership.level };

    const stale =
      !membership.lastSeenAt || Date.now() - membership.lastSeenAt.getTime() > LAST_SEEN_EVERY_MS;
    if (stale) {
      // Not awaited: recording a visit must never slow down or fail the request.
      void this.prisma.membership
        .update({ where: { id: membership.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    return true;
  }
}
