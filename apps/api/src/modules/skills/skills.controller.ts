import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  changeStatusSchema,
  createSkillSchema,
  restoreSkillSchema,
  saveSkillSchema,
  skillDetailSchema,
  skillVersionSchema,
  skillVersionSummarySchema,
} from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { SkillsService } from './skills.service';

export class CreateSkillDto extends createZodDto(createSkillSchema) {}
export class SaveSkillDto extends createZodDto(saveSkillSchema) {}
export class ChangeStatusDto extends createZodDto(changeStatusSchema) {}
export class SkillDetailDto extends createZodDto(skillDetailSchema) {}
export class RestoreSkillDto extends createZodDto(restoreSkillSchema) {}
export class SkillVersionSummaryDto extends createZodDto(skillVersionSummarySchema) {}
export class SkillVersionDto extends createZodDto(skillVersionSchema) {}

@ApiTags('skills')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Post()
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: SkillDetailDto })
  create(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateSkillDto,
  ) {
    return this.skills.create(access, user, body);
  }

  @Get(':skillId')
  @ZodResponse({ type: SkillDetailDto })
  get(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.skills.get(access, skillId);
  }

  @Put(':skillId')
  @MinLevel('editor')
  @ZodResponse({ type: SkillDetailDto })
  save(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: SaveSkillDto,
  ) {
    return this.skills.save(access, user, skillId, body);
  }

  @Post(':skillId/status')
  @MinLevel('editor')
  @ZodResponse({ status: 200, type: SkillDetailDto })
  changeStatus(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: ChangeStatusDto,
  ) {
    return this.skills.changeStatus(access, skillId, body);
  }

  @Get(':skillId/versions')
  @ZodResponse({ type: [SkillVersionSummaryDto] })
  versions(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.skills.versions(access, skillId);
  }

  @Get(':skillId/versions/:number')
  @ZodResponse({ type: SkillVersionDto })
  version(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.skills.version(access, skillId, number);
  }

  @Post(':skillId/restore')
  @MinLevel('editor')
  @ZodResponse({ status: 200, type: SkillDetailDto })
  restore(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: RestoreSkillDto,
  ) {
    return this.skills.restore(access, user, skillId, body);
  }

  @Delete(':skillId')
  @MinLevel('editor')
  @HttpCode(204)
  @ApiNoContentResponse()
  archive(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.skills.archive(access, skillId);
  }
}
