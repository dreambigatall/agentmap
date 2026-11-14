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
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { MembersService } from './members.service';
import { ChangeLevelDto, MemberDto } from './workspaces.dto';

@ApiTags('members')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ZodResponse({ type: [MemberDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess) {
    return this.members.list(access);
  }

  @Patch(':memberId')
  @MinLevel('admin')
  @ZodResponse({ type: MemberDto })
  changeLevel(
    @Param('workspaceId') _id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @Body() body: ChangeLevelDto,
  ) {
    return this.members.changeLevel(access, memberId, body);
  }

  /** Admins remove others. Any member can call this on themselves to leave. */
  @Delete(':memberId')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Param('workspaceId') _id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.members.remove(access, memberId);
  }

  @Post(':memberId/transfer-ownership')
  @MinLevel('owner')
  @HttpCode(204)
  @ApiNoContentResponse()
  transferOwnership(
    @Param('workspaceId') _id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ): Promise<void> {
    return this.members.transferOwnership(access, memberId);
  }
}
