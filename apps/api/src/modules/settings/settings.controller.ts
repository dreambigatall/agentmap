import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { createNamedItemSchema, namedItemSchema } from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { SettingsService } from './settings.service';

export class NamedItemInputDto extends createZodDto(createNamedItemSchema) {}
export class NamedItemDto extends createZodDto(namedItemSchema) {}

/** Roles: the human jobs that can do a step. Everyone reads them; admins change them. */
@ApiTags('settings')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/roles')
export class RolesController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ZodResponse({ type: [NamedItemDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.settings.list(access, 'role');
  }

  @Post()
  @MinLevel('admin')
  @ZodResponse({ status: 201, type: NamedItemDto })
  create(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @Body() body: NamedItemInputDto) {
    return this.settings.create(access, 'role', body);
  }

  @Patch(':roleId')
  @MinLevel('admin')
  @ZodResponse({ type: NamedItemDto })
  rename(
    @Param('workspaceId') _id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: NamedItemInputDto,
  ) {
    return this.settings.rename(access, 'role', roleId, body);
  }

  @Delete(':roleId')
  @MinLevel('admin')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Param('workspaceId') _id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.settings.remove(access, 'role', roleId);
  }
}

/** Channels: where the agent talks to people. Everyone reads them; admins change them. */
@ApiTags('settings')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/channels')
export class ChannelsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ZodResponse({ type: [NamedItemDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.settings.list(access, 'channel');
  }

  @Post()
  @MinLevel('admin')
  @ZodResponse({ status: 201, type: NamedItemDto })
  create(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @Body() body: NamedItemInputDto) {
    return this.settings.create(access, 'channel', body);
  }

  @Patch(':channelId')
  @MinLevel('admin')
  @ZodResponse({ type: NamedItemDto })
  rename(
    @Param('workspaceId') _id: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: NamedItemInputDto,
  ) {
    return this.settings.rename(access, 'channel', channelId, body);
  }

  @Delete(':channelId')
  @MinLevel('admin')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Param('workspaceId') _id: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.settings.remove(access, 'channel', channelId);
  }
}
