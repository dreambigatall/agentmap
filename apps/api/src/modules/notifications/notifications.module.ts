import { Body, Controller, Get, Global, HttpCode, Module, Param, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { markReadSchema, notificationListSchema } from '@skillflow/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, CurrentWorkspace } from '../../common/decorators';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { WorkspaceGuard } from '../../common/workspace.guard';
import { NotificationsService } from './notifications.service';

export class NotificationListDto extends createZodDto(notificationListSchema) {}
export class MarkReadDto extends createZodDto(markReadSchema) {}

/** The signed-in person's own notifications in this workspace. */
@ApiTags('notifications')
@UseGuards(WorkspaceGuard)
@Controller('w/:workspaceId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ZodResponse({ type: NotificationListDto })
  list(@Param('workspaceId') _id: string, @CurrentWorkspace() access: WorkspaceAccess, @CurrentUser() user: AuthUser) {
    return this.notifications.list(access, user);
  }

  @Post('read')
  @HttpCode(204)
  @ApiNoContentResponse()
  markRead(
    @Param('workspaceId') _id: string,
    @CurrentWorkspace() access: WorkspaceAccess,
    @CurrentUser() user: AuthUser,
    @Body() body: MarkReadDto,
  ): Promise<void> {
    return this.notifications.markRead(access, user, body);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
