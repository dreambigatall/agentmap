import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  agentDetailSchema,
  agentInputSchema,
  agentSummarySchema,
  capabilityFlowSchema,
  capabilityInputSchema,
  reorderSchema,
  updateAgentSchema,
} from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { AgentsService } from './agents.service';

export class AgentInputDto extends createZodDto(agentInputSchema) {}
export class UpdateAgentDto extends createZodDto(updateAgentSchema) {}
export class AgentSummaryDto extends createZodDto(agentSummarySchema) {}
export class AgentDetailDto extends createZodDto(agentDetailSchema) {}
export class CapabilityInputDto extends createZodDto(capabilityInputSchema) {}
export class ReorderDto extends createZodDto(reorderSchema) {}
export class CapabilityFlowDto extends createZodDto(capabilityFlowSchema) {}

@ApiTags('agents')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('agents')
  @ZodResponse({ type: [AgentSummaryDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.agents.list(access);
  }

  @Post('agents')
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: AgentDetailDto })
  create(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @Body() body: AgentInputDto) {
    return this.agents.create(access, body);
  }

  @Get('agents/:agentId')
  @ZodResponse({ type: AgentDetailDto })
  get(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.agents.get(access, agentId);
  }

  @Patch('agents/:agentId')
  @MinLevel('editor')
  @ZodResponse({ type: AgentDetailDto })
  update(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agents.update(access, agentId, body);
  }

  @Delete('agents/:agentId')
  @MinLevel('editor')
  @HttpCode(204)
  @ApiNoContentResponse()
  archive(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.agents.archive(access, agentId);
  }

  @Post('agents/:agentId/capabilities')
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: AgentDetailDto })
  addCapability(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: CapabilityInputDto,
  ) {
    return this.agents.addCapability(access, agentId, body);
  }

  @Put('agents/:agentId/capabilities/order')
  @MinLevel('editor')
  @ZodResponse({ type: AgentDetailDto })
  reorderCapabilities(
    @Param('workspaceId') _id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: ReorderDto,
  ) {
    return this.agents.reorderCapabilities(access, agentId, body);
  }

  @Get('capabilities/:capabilityId/flow')
  @ZodResponse({ type: CapabilityFlowDto })
  flow(
    @Param('workspaceId') _id: string,
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.agents.flow(access, capabilityId);
  }

  @Patch('capabilities/:capabilityId')
  @MinLevel('editor')
  @ZodResponse({ type: AgentDetailDto })
  renameCapability(
    @Param('workspaceId') _id: string,
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: CapabilityInputDto,
  ) {
    return this.agents.renameCapability(access, capabilityId, body);
  }

  @Delete('capabilities/:capabilityId')
  @MinLevel('editor')
  @ZodResponse({ type: AgentDetailDto })
  archiveCapability(
    @Param('workspaceId') _id: string,
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.agents.archiveCapability(access, capabilityId);
  }

  @Put('capabilities/:capabilityId/skills/order')
  @MinLevel('editor')
  @ZodResponse({ type: AgentDetailDto })
  reorderSkills(
    @Param('workspaceId') _id: string,
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: ReorderDto,
  ) {
    return this.agents.reorderSkills(access, capabilityId, body);
  }
}
