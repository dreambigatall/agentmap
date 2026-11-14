import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace, MinLevel, Public } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteAcceptance } from './invite-acceptance.service';
import { InvitesService } from './invites.service';
import {
  AcceptInviteDto,
  AcceptInviteResultDto,
  CreateInviteDto,
  InviteDto,
  InviteLookupDto,
} from './workspaces.dto';

@ApiTags('invites')
@UseGuards(WorkspaceGuard)
@MinLevel('admin')
@Controller('w/:workspaceId/invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get()
  @ZodResponse({ type: [InviteDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.invites.listPending(access);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ZodResponse({ status: 201, type: InviteDto })
  create(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInviteDto,
  ) {
    return this.invites.create(access, user, body);
  }

  @Post(':inviteId/resend')
  @ZodResponse({ status: 200, type: InviteDto })
  resend(
    @Param('workspaceId') _id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.invites.resend(access, inviteId);
  }

  @Delete(':inviteId')
  @HttpCode(204)
  @ApiNoContentResponse()
  revoke(
    @Param('workspaceId') _id: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.invites.revoke(access, inviteId);
  }
}

/** Routes for the person holding an invite link, before they are a member. */
@ApiTags('invites')
@Controller('invites')
export class InviteLinkController {
  constructor(
    private readonly acceptance: InviteAcceptance,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  @ZodResponse({ type: InviteLookupDto })
  lookup(@Param('token') token: string) {
    return this.acceptance.lookup(token);
  }

  @Post('accept')
  @ZodResponse({ status: 200, type: AcceptInviteResultDto })
  async accept(@CurrentUser() user: AuthUser, @Body() body: AcceptInviteDto) {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true },
    });
    return this.acceptance.accept(user.id, account.email, body.token);
  }
}
