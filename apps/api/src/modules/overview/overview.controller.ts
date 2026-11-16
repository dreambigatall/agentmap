import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { dashboardQuerySchema, dashboardSchema, searchQuerySchema, searchResultsSchema } from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { OverviewService } from './overview.service';

export class DashboardQueryDto extends createZodDto(dashboardQuerySchema) {}
export class DashboardDto extends createZodDto(dashboardSchema) {}
export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
export class SearchResultsDto extends createZodDto(searchResultsSchema) {}

@ApiTags('overview')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('dashboard')
  @ZodResponse({ type: DashboardDto })
  dashboard(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.overview.dashboard(access, user, query);
  }

  @Get('search')
  @ZodResponse({ type: SearchResultsDto })
  async search(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Query() query: SearchQueryDto,
  ) {
    return { results: await this.overview.search(access, query.q) };
  }
}
