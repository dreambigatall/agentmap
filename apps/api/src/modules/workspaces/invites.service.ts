import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateInviteInput, Invite } from '@skillflow/shared';
import { randomToken, sha256 } from '../../common/crypto';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Invites still waiting for an answer. */
  async listPending(access: WorkspaceAccess): Promise<Invite[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const rows = await db.invite.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toInvite);
  }

  async create(access: WorkspaceAccess, user: AuthUser, input: CreateInviteInput): Promise<Invite> {
    const db = this.prisma.forWorkspace(access.workspaceId);

    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!inviter.emailVerifiedAt) {
      throw new ForbiddenException('Confirm your own email address before inviting others.');
    }

    const alreadyMember = await db.membership.findFirst({ where: { user: { email: input.email } } });
    if (alreadyMember) throw new ConflictException(`${input.email} is already in this workspace`);

    // A new invite to the same address replaces any earlier one.
    await db.invite.updateMany({
      where: { email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = randomToken();
    const invite = await db.invite.create({
      data: {
        workspaceId: access.workspaceId,
        email: input.email,
        level: input.level,
        tokenHash: sha256(token),
        invitedById: user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      include: { invitedBy: { select: { name: true } }, workspace: { select: { name: true } } },
    });

    await this.sendEmail(invite.email, invite.invitedBy.name, invite.workspace.name, token);
    return toInvite(invite);
  }

  /** Sends a fresh link with a new 7-day window. The old link stops working. */
  async resend(access: WorkspaceAccess, inviteId: string): Promise<Invite> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const existing = await db.invite.findUnique({ where: { id: inviteId } });
    if (!existing || existing.acceptedAt || existing.revokedAt) {
      throw new NotFoundException('Invite not found');
    }

    const token = randomToken();
    const invite = await db.invite.update({
      where: { id: existing.id },
      data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      include: { invitedBy: { select: { name: true } }, workspace: { select: { name: true } } },
    });
    await this.sendEmail(invite.email, invite.invitedBy.name, invite.workspace.name, token);
    return toInvite(invite);
  }

  async revoke(access: WorkspaceAccess, inviteId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const result = await db.invite.updateMany({
      where: { id: inviteId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Invite not found');
  }

  private async sendEmail(to: string, inviter: string, workspace: string, token: string) {
    const link = this.mail.link(`/invite/${token}`);
    await this.mail.send({
      to,
      subject: `${inviter} invited you to ${workspace} on Agentmap`,
      text: `${inviter} invited you to join "${workspace}" on Agentmap, where your team designs and signs off the workflows of its AI agents.\n\nAccept the invite:\n${link}\n\nThe link works for 7 days.`,
      link,
    });
  }
}

function toInvite(i: {
  id: string;
  email: string;
  level: Invite['level'];
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { name: string };
}): Invite {
  return {
    id: i.id,
    email: i.email,
    level: i.level,
    invitedBy: i.invitedBy.name,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}
