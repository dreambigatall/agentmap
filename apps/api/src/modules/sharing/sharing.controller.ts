import { Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  exportFileName,
  publicAgentSchema,
  shareLinkSchema,
  shareTokenSchema,
  skillExportSchema,
} from '@skillflow/shared';
import type { Response } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace, MinLevel, Public } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { SharingService } from './sharing.service';

export class ShareLinkDto extends createZodDto(shareLinkSchema) {}
export class PublicAgentDto extends createZodDto(publicAgentSchema) {}
export class SkillExportDto extends createZodDto(skillExportSchema) {}

@ApiTags('sharing')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class SharingController {
  constructor(private readonly sharing: SharingService) {}

  @Get('agents/:agentId/shares')
  @MinLevel('editor')
  @ZodResponse({ type: [ShareLinkDto] })
  list(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.sharing.list(access, agentId);
  }

  @Post('agents/:agentId/shares')
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: ShareLinkDto })
  create(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sharing.create(access, user, agentId);
  }

  @Delete('shares/:shareId')
  @MinLevel('editor')
  @HttpCode(204)
  @ApiNoContentResponse()
  async revoke(
    @Param('workspaceId') _id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    await this.sharing.revoke(access, shareId);
  }

  @Get('skills/:skillId/export')
  @ZodResponse({ type: SkillExportDto })
  async export(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.sharing.exportSkill(access, skillId);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(file.skill.name)}"`);
    return file;
  }
}

/** The public share page's data. No sign-in, a tight rate limit, never cached or indexed. */
@ApiTags('sharing')
@Controller('share')
export class PublicShareController {
  constructor(private readonly sharing: SharingService) {}

  @Get(':token')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ZodResponse({ type: PublicAgentDto })
  view(@Param('token') token: string) {
    if (!shareTokenSchema.safeParse(token).success) throw new NotFoundException('This link is not available');
    return this.sharing.view(token);
  }
}
