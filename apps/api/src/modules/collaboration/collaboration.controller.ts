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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  commentSchema,
  createCommentSchema,
  decideSignoffSchema,
  editCommentSchema,
  listCommentsQuerySchema,
  requestSignoffSchema,
  signoffSchema,
} from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace, MinLevel } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { CommentsService } from './comments.service';
import { SignoffsService } from './signoffs.service';

export class CommentDto extends createZodDto(commentSchema) {}
export class CreateCommentDto extends createZodDto(createCommentSchema) {}
export class EditCommentDto extends createZodDto(editCommentSchema) {}
export class ListCommentsQueryDto extends createZodDto(listCommentsQuerySchema) {}
export class SignoffDto extends createZodDto(signoffSchema) {}
export class RequestSignoffDto extends createZodDto(requestSignoffSchema) {}
export class DecideSignoffDto extends createZodDto(decideSignoffSchema) {}

/** Comments: every member may read and write them. */
@ApiTags('comments')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ZodResponse({ type: [CommentDto] })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @Query() query: ListCommentsQueryDto) {
    return this.comments.list(access, query);
  }

  @Post()
  @ZodResponse({ status: 201, type: CommentDto })
  create(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: CreateCommentDto,
  ) {
    return this.comments.create(access, user, body);
  }

  @Patch(':commentId')
  @ZodResponse({ type: CommentDto })
  edit(
    @Param('workspaceId') _id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: EditCommentDto,
  ) {
    return this.comments.edit(access, user, commentId, body);
  }

  @Delete(':commentId')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @Param('workspaceId') _id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.comments.remove(access, user, commentId);
  }

  @Post(':commentId/resolve')
  @ZodResponse({ status: 200, type: CommentDto })
  resolve(
    @Param('workspaceId') _id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setResolved(access, user, commentId, true);
  }

  @Post(':commentId/reopen')
  @ZodResponse({ status: 200, type: CommentDto })
  reopen(
    @Param('workspaceId') _id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setResolved(access, user, commentId, false);
  }
}

@ApiTags('signoffs')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId')
export class SignoffsController {
  constructor(private readonly signoffs: SignoffsService) {}

  @Get('skills/:skillId/signoffs')
  @ZodResponse({ type: [SignoffDto] })
  list(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
  ) {
    return this.signoffs.list(access, skillId);
  }

  @Post('skills/:skillId/signoffs')
  @MinLevel('editor')
  @ZodResponse({ status: 201, type: SignoffDto })
  request(
    @Param('workspaceId') _id: string,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: RequestSignoffDto,
  ) {
    return this.signoffs.request(access, user, skillId, body);
  }

  /** Any level may decide, but only as the named business owner. Checked in the service. */
  @Post('signoffs/:signoffId/decide')
  @ZodResponse({ status: 200, type: SignoffDto })
  decide(
    @Param('workspaceId') _id: string,
    @Param('signoffId', ParseUUIDPipe) signoffId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: DecideSignoffDto,
  ) {
    return this.signoffs.decide(access, user, signoffId, body);
  }

  @Post('signoffs/:signoffId/cancel')
  @ZodResponse({ status: 200, type: SignoffDto })
  cancel(
    @Param('workspaceId') _id: string,
    @Param('signoffId', ParseUUIDPipe) signoffId: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
  ) {
    return this.signoffs.cancel(access, user, signoffId);
  }
}
