import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { atLeast, type DecideSignoffInput, type RequestSignoffInput, type Signoff } from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const INCLUDE = {
  requestedBy: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  skill: { select: { name: true, version: true, status: true } },
} satisfies Prisma.SignoffInclude;

type SignoffRow = Prisma.SignoffGetPayload<{ include: typeof INCLUDE }>;

function toSignoff(s: SignoffRow): Signoff {
  return {
    id: s.id,
    skillId: s.skillId,
    skillVersion: s.skillVersion,
    status: s.status,
    requestedBy: s.requestedBy,
    owner: s.owner,
    note: s.note,
    decidedAt: s.decidedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * A business owner's approval of one exact version of a skill. Approval unlocks
 * In build and Live; any later save marks it outdated (see SkillsService.save).
 */
@Injectable()
export class SignoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(access: WorkspaceAccess, skillId: string): Promise<Signoff[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.skill(access, skillId);
    const rows = await db.signoff.findMany({ where: { skillId }, orderBy: { createdAt: 'desc' }, include: INCLUDE });
    return rows.map(toSignoff);
  }

  async request(access: WorkspaceAccess, user: AuthUser, skillId: string, input: RequestSignoffInput): Promise<Signoff> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const skill = await this.skill(access, skillId);
    if (skill.status !== 'defined') {
      throw new BadRequestException('Only a Defined skill can be signed off. Finish the readiness checklist first.');
    }
    if (input.ownerId === user.id) {
      throw new BadRequestException('Ask someone else to sign off. A sign-off is a second person agreeing.');
    }
    const owner = await db.membership.findFirst({
      where: { userId: input.ownerId },
      select: { user: { select: { name: true } } },
    });
    if (!owner) throw new BadRequestException('The business owner must be a member of this workspace.');
    const open = await db.signoff.findFirst({ where: { skillId, status: 'pending' } });
    if (open) throw new ConflictException('A sign-off is already waiting. Cancel it first to ask someone else.');

    const created = await db.signoff.create({
      data: {
        workspaceId: access.workspaceId,
        skillId,
        skillVersion: skill.version,
        requestedById: user.id,
        ownerId: input.ownerId,
      },
      include: INCLUDE,
    });

    await this.notifications.notify({
      workspaceId: access.workspaceId,
      userIds: [input.ownerId],
      actorId: user.id,
      kind: 'signoff_requested',
      text: `${created.requestedBy.name} asks you to sign off ${skill.name} (version ${skill.version})`,
      path: `skills/${skillId}`,
      email: {
        subject: `Please sign off: ${skill.name}`,
        body: `${created.requestedBy.name} asks you, as business owner, to approve version ${skill.version} of "${skill.name}" before it is built. Read it, then approve it or ask for changes.`,
      },
    });
    return toSignoff(created);
  }

  /** Only the named business owner decides, and only on the version they were asked about. */
  async decide(access: WorkspaceAccess, user: AuthUser, signoffId: string, input: DecideSignoffInput): Promise<Signoff> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const signoff = await this.find(access, signoffId);
    if (signoff.ownerId !== user.id) throw new ForbiddenException('Only the business owner who was asked can decide');
    if (signoff.status !== 'pending') throw new ConflictException('This sign-off was already decided or cancelled.');
    if (signoff.skill.version !== signoff.skillVersion) {
      await db.signoff.update({ where: { id: signoffId }, data: { status: 'outdated' } });
      throw new ConflictException('The skill changed after you were asked. A new sign-off is needed for the new version.');
    }

    const approved = input.decision === 'approve';
    const decided = await db.signoff.update({
      where: { id: signoffId },
      data: { status: approved ? 'approved' : 'changes_asked', note: input.note, decidedAt: new Date() },
      include: INCLUDE,
    });

    await this.notifications.notify({
      workspaceId: access.workspaceId,
      userIds: [signoff.requestedById],
      actorId: user.id,
      kind: 'signoff_decided',
      text: approved
        ? `${decided.owner.name} signed off ${signoff.skill.name}`
        : `${decided.owner.name} asked for changes to ${signoff.skill.name}`,
      path: `skills/${signoff.skillId}`,
      email: {
        subject: approved ? `Signed off: ${signoff.skill.name}` : `Changes asked: ${signoff.skill.name}`,
        body: approved
          ? `${decided.owner.name} approved version ${signoff.skillVersion} of "${signoff.skill.name}". It can now move to In build.`
          : `${decided.owner.name} asked for changes to "${signoff.skill.name}":\n\n"${input.note}"`,
      },
    });
    return toSignoff(decided);
  }

  /** The person who asked, or an editor, withdraws an open request. */
  async cancel(access: WorkspaceAccess, user: AuthUser, signoffId: string): Promise<Signoff> {
    const signoff = await this.find(access, signoffId);
    if (signoff.requestedById !== user.id && !atLeast(access.level, 'editor')) {
      throw new ForbiddenException('Only the person who asked or an editor can cancel');
    }
    if (signoff.status !== 'pending') throw new ConflictException('Only a waiting sign-off can be cancelled.');
    const cancelled = await this.prisma
      .forWorkspace(access.workspaceId)
      .signoff.update({ where: { id: signoffId }, data: { status: 'cancelled' }, include: INCLUDE });
    return toSignoff(cancelled);
  }

  private async skill(access: WorkspaceAccess, skillId: string) {
    const skill = await this.prisma.forWorkspace(access.workspaceId).skill.findFirst({
      where: { id: skillId, archivedAt: null },
      select: { name: true, version: true, status: true },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  private async find(access: WorkspaceAccess, signoffId: string): Promise<SignoffRow> {
    const signoff = await this.prisma
      .forWorkspace(access.workspaceId)
      .signoff.findFirst({ where: { id: signoffId, skill: { archivedAt: null } }, include: INCLUDE });
    if (!signoff) throw new NotFoundException('Sign-off not found');
    return signoff;
  }
}
