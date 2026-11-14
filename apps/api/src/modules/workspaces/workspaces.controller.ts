import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import {
  CreateWorkspaceDto,
  RenameWorkspaceDto,
  WorkspaceDto,
  WorkspaceSummaryDto,
} from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

/** Workspaces of the signed-in person. Not tied to one workspace, so no WorkspaceGuard. */
@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ZodResponse({ status: 201, type: WorkspaceSummaryDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, body);
  }

  @Get()
  @ZodResponse({ type: [WorkspaceSummaryDto] })
  listMine(@CurrentUser() user: AuthUser) {
    return this.workspaces.listMine(user.id);
  }
}

/** One workspace. Everything under /w/:workspaceId passes the WorkspaceGuard. */
@ApiTags('workspaces')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ZodResponse({ type: WorkspaceDto })
  get(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.workspaces.get(access.workspaceId);
  }

  @Patch()
  @MinLevel('admin')
  @ZodResponse({ type: WorkspaceDto })
  rename(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: RenameWorkspaceDto,
  ) {
    return this.workspaces.rename(access.workspaceId, body);
  }
}
