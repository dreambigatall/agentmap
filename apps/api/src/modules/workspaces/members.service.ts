import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChangeLevelInput, Member } from '@skillflow/shared';
import type { WorkspaceAccess } from '../../common/request';
import { PrismaService, TX_OPTIONS } from '../../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(access: WorkspaceAccess): Promise<Member[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const rows = await db.membership.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMember);
  }

  async changeLevel(access: WorkspaceAccess, membershipId: string, input: ChangeLevelInput): Promise<Member> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const target = await this.find(access, membershipId);
    if (target.level === 'owner') {
      throw new BadRequestException('The owner keeps full access. Transfer ownership first.');
    }
    if (target.id === access.membershipId) {
      throw new BadRequestException('You cannot change your own access. Ask another admin.');
    }
    const updated = await db.membership.update({
      where: { id: target.id },
      data: { level: input.level },
      include: { user: { select: { name: true, email: true } } },
    });
    return toMember(updated);
  }

  /** Admins remove others; anyone except the owner may remove themselves (leave). */
  async remove(access: WorkspaceAccess, membershipId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const target = await this.find(access, membershipId);
    const leaving = target.id === access.membershipId;

    if (target.level === 'owner') {
      throw new BadRequestException('The owner cannot be removed. Transfer ownership first.');
    }
    if (!leaving && access.level !== 'admin' && access.level !== 'owner') {
      throw new ForbiddenException('This needs admin access or higher');
    }
    // Removing the membership ends access. Everything they wrote stays in the workspace.
    await db.membership.delete({ where: { id: target.id } });
  }

  /** The owner hands ownership to an admin and becomes an admin themselves. */
  async transferOwnership(access: WorkspaceAccess, membershipId: string): Promise<void> {
    const target = await this.find(access, membershipId);
    if (target.id === access.membershipId) {
      throw new BadRequestException('You already own this workspace');
    }
    if (target.level !== 'admin') {
      throw new BadRequestException('Ownership can only go to an admin. Make them an admin first.');
    }
    await this.prisma.$transaction(async (tx) => {
      // Demote first: the database allows only one owner per workspace at any moment.
      await tx.membership.update({ where: { id: access.membershipId }, data: { level: 'admin' } });
      await tx.membership.update({ where: { id: target.id }, data: { level: 'owner' } });
    }, TX_OPTIONS);
  }

  private async find(access: WorkspaceAccess, membershipId: string) {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const membership = await db.membership.findUnique({ where: { id: membershipId } });
    if (!membership) throw new NotFoundException('Member not found');
    return membership;
  }
}

function toMember(m: {
  id: string;
  userId: string;
  level: Member['level'];
  createdAt: Date;
  lastSeenAt: Date | null;
  user: { name: string; email: string };
}): Member {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    level: m.level,
    addedAt: m.createdAt.toISOString(),
    lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
  };
}
