import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  atLeast,
  type Comment,
  type CommentTarget,
  type CreateCommentInput,
  type EditCommentInput,
  type ListCommentsQuery,
} from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService, type WorkspaceDb } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface Target {
  name: string;
  path: string;
  stepIds: Set<string>;
  /** Told about every new comment, e.g. a request's author. */
  ownerId: string | null;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(access: WorkspaceAccess, query: ListCommentsQuery): Promise<Comment[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.target(db, query.targetType, query.targetId);
    const rows = await db.comment.findMany({
      where: { targetType: query.targetType, targetId: query.targetId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } }, resolvedBy: { select: { name: true } } },
    });
    const mentioned = [...new Set(rows.flatMap((r) => r.mentionedUserIds))];
    const people = mentioned.length
      ? await this.prisma.user.findMany({ where: { id: { in: mentioned } }, select: { id: true, name: true } })
      : [];
    const names = new Map(people.map((p) => [p.id, p.name]));
    return rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      stepId: r.stepId,
      body: r.body,
      author: r.author,
      mentions: r.mentionedUserIds.filter((id) => names.has(id)).map((id) => ({ id, name: names.get(id)! })),
      resolved: r.resolvedAt !== null,
      resolvedBy: r.resolvedBy?.name ?? null,
      editedAt: r.editedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(access: WorkspaceAccess, user: AuthUser, input: CreateCommentInput): Promise<Comment> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const target = await this.target(db, input.targetType, input.targetId);
    if (input.stepId && !target.stepIds.has(input.stepId)) {
      throw new BadRequestException('That step is not part of this item any more.');
    }
    const mentions = [...new Set(input.mentions)];
    if (mentions.length) {
      const members = await db.membership.count({ where: { userId: { in: mentions } } });
      if (members !== mentions.length) throw new BadRequestException('You can only mention people in this workspace.');
    }

    const comment = await db.comment.create({
      data: {
        workspaceId: access.workspaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        stepId: input.stepId,
        body: input.body,
        mentionedUserIds: mentions,
        authorId: user.id,
      },
      include: { author: { select: { name: true } } },
    });

    const excerpt = input.body.length > 120 ? `${input.body.slice(0, 117)}…` : input.body;
    await this.notifications.notify({
      workspaceId: access.workspaceId,
      userIds: mentions,
      actorId: user.id,
      kind: 'comment_mention',
      text: `${comment.author.name} mentioned you on ${target.name}: "${excerpt}"`,
      path: target.path,
      email: {
        subject: `${comment.author.name} mentioned you on ${target.name}`,
        body: `${comment.author.name} wrote:\n\n"${excerpt}"`,
      },
    });
    if (target.ownerId && !mentions.includes(target.ownerId)) {
      await this.notifications.notify({
        workspaceId: access.workspaceId,
        userIds: [target.ownerId],
        actorId: user.id,
        kind: 'comment_reply',
        text: `${comment.author.name} commented on ${target.name}: "${excerpt}"`,
        path: target.path,
      });
    }

    return (await this.list(access, { targetType: input.targetType, targetId: input.targetId })).find(
      (c) => c.id === comment.id,
    )!;
  }

  /** Only the author changes their words. */
  async edit(access: WorkspaceAccess, user: AuthUser, commentId: string, input: EditCommentInput): Promise<Comment> {
    const comment = await this.find(access, commentId);
    if (comment.authorId !== user.id) throw new ForbiddenException('Only the author can edit a comment');
    await this.prisma
      .forWorkspace(access.workspaceId)
      .comment.update({ where: { id: commentId }, data: { body: input.body, editedAt: new Date() } });
    return this.one(access, comment, commentId);
  }

  async remove(access: WorkspaceAccess, user: AuthUser, commentId: string): Promise<void> {
    const comment = await this.find(access, commentId);
    if (comment.authorId !== user.id) throw new ForbiddenException('Only the author can delete a comment');
    await this.prisma.forWorkspace(access.workspaceId).comment.delete({ where: { id: commentId } });
  }

  /** The author or an editor marks a comment as dealt with, or opens it again. */
  async setResolved(access: WorkspaceAccess, user: AuthUser, commentId: string, resolved: boolean): Promise<Comment> {
    const comment = await this.find(access, commentId);
    if (comment.authorId !== user.id && !atLeast(access.level, 'editor')) {
      throw new ForbiddenException('Only the author or an editor can resolve a comment');
    }
    await this.prisma.forWorkspace(access.workspaceId).comment.update({
      where: { id: commentId },
      data: resolved ? { resolvedAt: new Date(), resolvedById: user.id } : { resolvedAt: null, resolvedById: null },
    });
    return this.one(access, comment, commentId);
  }

  private async one(access: WorkspaceAccess, c: { targetType: CommentTarget; targetId: string }, id: string) {
    return (await this.list(access, { targetType: c.targetType, targetId: c.targetId })).find((x) => x.id === id)!;
  }

  private async find(access: WorkspaceAccess, commentId: string) {
    const comment = await this.prisma.forWorkspace(access.workspaceId).comment.findFirst({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  /** The skill or request a comment belongs to, if it exists in this workspace. */
  private async target(db: WorkspaceDb, type: CommentTarget, id: string): Promise<Target> {
    if (type === 'skill') {
      const skill = await db.skill.findFirst({
        where: { id, archivedAt: null },
        select: { name: true, steps: { select: { id: true } } },
      });
      if (!skill) throw new NotFoundException('Skill not found');
      return { name: skill.name, path: `skills/${id}`, stepIds: new Set(skill.steps.map((s) => s.id)), ownerId: null };
    }
    const request = await db.request.findFirst({
      where: { id, archivedAt: null },
      select: { name: true, authorId: true, steps: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Request not found');
    return {
      name: request.name,
      path: `requests/${id}`,
      stepIds: new Set(request.steps.map((s) => s.id)),
      ownerId: request.authorId,
    };
  }
}
