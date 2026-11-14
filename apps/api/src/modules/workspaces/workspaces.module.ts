import { Module } from '@nestjs/common';
import { InviteAcceptance } from './invite-acceptance.service';
import { InviteLinkController, InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { WorkspaceController, WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [
    WorkspacesController,
    WorkspaceController,
    MembersController,
    InvitesController,
    InviteLinkController,
  ],
  providers: [WorkspacesService, MembersService, InvitesService, InviteAcceptance],
  exports: [InviteAcceptance],
})
export class WorkspacesModule {}
