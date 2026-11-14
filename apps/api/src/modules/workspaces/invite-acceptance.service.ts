import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { InviteLookup } from '@skillflow/shared';
import { sha256 } from '../../common/crypto';
import { PrismaService } from '../../prisma/prisma.service';

const NOT_VALID = 'This invite link is not valid any more. Ask for a new invite.';

/**
 * Everything that starts from an invite link rather than from inside a workspace:
 * showing the invite to its holder and turning it into a membership.
 */
@Injectable()
export class InviteAcceptance {
  constructor(private readonly prisma: PrismaService) {}

  /** The invite behind a token if it can still be used, optionally only for one email. */
  async findUsable(token: string, email?: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: sha256(token) },
      include: { workspace: true, invitedBy: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
    if (email && invite.email !== email) return null;
    return invite;
  }

  async lookup(token: string): Promise<InviteLookup> {
    const invite = await this.findUsable(token);
    if (!invite) throw new NotFoundException(NOT_VALID);
    const account = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });
    return {
      workspaceName: invite.workspace.name,
      email: invite.email,
      level: invite.level,
      invitedBy: invite.invitedBy.name,
      hasAccount: account !== null,
    };
  }

  /** Adds the signed-in user to the invite's workspace and returns its slug. */
  async accept(userId: string, userEmail: string, token: string): Promise<{ workspaceSlug: string }> {
    const invite = await this.findUsable(token);
    if (!invite) throw new NotFoundException(NOT_VALID);
    if (invite.email !== userEmail) {
      throw new ForbiddenException(
        `This invite was sent to ${invite.email}. Sign in with that address to accept it.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      });
      // Already a member: keep the current level rather than lowering it.
      if (!existing) {
        await tx.membership.create({
          data: { workspaceId: invite.workspaceId, userId, level: invite.level },
        });
      }
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      // The invite reached their inbox, so the address is confirmed.
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
    });

    return { workspaceSlug: invite.workspace.slug };
  }
}
