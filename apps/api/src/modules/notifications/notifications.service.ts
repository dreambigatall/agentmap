import { Injectable, Logger } from '@nestjs/common';
import type { MarkReadInput, NotificationKind, NotificationList } from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export interface NotifyInput {
  workspaceId: string;
  userIds: string[];
  /** Who caused it. Never notified about their own action. */
  actorId?: string;
  kind: NotificationKind;
  text: string;
  /** Path inside the workspace, e.g. "skills/<id>". Becomes /w/<slug>/<path>. */
  path: string;
  /** Also email it. Used for things someone has to act on. */
  email?: { subject: string; body: string };
}

const KEEP = 50;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Records a notification for each person and emails them when asked. Failures are
   * logged, never thrown: a lost notification must not undo the action that caused it.
   */
  async notify(input: NotifyInput): Promise<void> {
    const recipients = [...new Set(input.userIds)].filter((id) => id !== input.actorId);
    if (recipients.length === 0) return;
    try {
      const workspace = await this.prisma.workspace.findUniqueOrThrow({
        where: { id: input.workspaceId },
        select: { slug: true, name: true },
      });
      // Only people who are still members get anything.
      const members = await this.prisma.membership.findMany({
        where: { workspaceId: input.workspaceId, userId: { in: recipients } },
        select: { user: { select: { id: true, email: true, name: true } } },
      });
      if (members.length === 0) return;

      const link = `/w/${workspace.slug}/${input.path}`;
      await this.prisma.notification.createMany({
        data: members.map((m) => ({
          workspaceId: input.workspaceId,
          userId: m.user.id,
          actorId: input.actorId ?? null,
          kind: input.kind,
          text: input.text,
          link,
        })),
      });

      if (input.email) {
        const url = this.mail.link(link);
        for (const { user } of members) {
          void this.mail.send({
            to: user.email,
            subject: input.email.subject,
            text: `Hi ${user.name},\n\n${input.email.body}\n\nOpen it in ${workspace.name}:\n${url}`,
            link: url,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Could not notify about ${input.kind}: ${(error as Error).message}`);
    }
  }

  /** People in the workspace at or above a level, for "tell the editors". */
  async membersAtLeastEditor(workspaceId: string): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { workspaceId, level: { in: ['editor', 'admin', 'owner'] } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async list(access: WorkspaceAccess, user: AuthUser): Promise<NotificationList> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: KEEP,
        include: { actor: { select: { name: true } } },
      }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        kind: n.kind,
        text: n.text,
        link: n.link,
        actor: n.actor?.name ?? null,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markRead(access: WorkspaceAccess, user: AuthUser, input: MarkReadInput): Promise<void> {
    await this.prisma.forWorkspace(access.workspaceId).notification.updateMany({
      where: { userId: user.id, readAt: null, ...(input.ids ? { id: { in: input.ids } } : {}) },
      data: { readAt: new Date() },
    });
  }
}
