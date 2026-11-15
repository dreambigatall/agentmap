import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateNamedItemInput, NamedItem } from '@skillflow/shared';
import { isUniqueViolation } from '../../common/prisma-errors';
import type { WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';

export type ListKind = 'role' | 'channel';

const WORDS: Record<ListKind, { one: string; Title: string }> = {
  role: { one: 'role', Title: 'Role' },
  channel: { one: 'channel', Title: 'Channel' },
};

/**
 * The workspace's own lists: roles (who can do a step) and channels (where the agent
 * talks to people). Both behave the same way, so one service handles both.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(access: WorkspaceAccess, kind: ListKind): Promise<NamedItem[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    if (kind === 'role') {
      const rows = await db.role.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { steps: { where: { skill: { archivedAt: null } } }, startsSkills: { where: { archivedAt: null } } } } },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, usedBy: r._count.steps + r._count.startsSkills }));
    }
    const rows = await db.channel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { skills: { where: { skill: { archivedAt: null } } } } } },
    });
    return rows.map((c) => ({ id: c.id, name: c.name, usedBy: c._count.skills }));
  }

  async create(access: WorkspaceAccess, kind: ListKind, input: CreateNamedItemInput): Promise<NamedItem> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    try {
      if (kind === 'role') {
        const last = await db.role.aggregate({ _max: { sortOrder: true } });
        const row = await db.role.create({
          data: { workspaceId: access.workspaceId, name: input.name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
        });
        return { id: row.id, name: row.name, usedBy: 0 };
      }
      const last = await db.channel.aggregate({ _max: { sortOrder: true } });
      const row = await db.channel.create({
        data: { workspaceId: access.workspaceId, name: input.name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
      return { id: row.id, name: row.name, usedBy: 0 };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(`There is already a ${WORDS[kind].one} called "${input.name}"`);
      throw error;
    }
  }

  async rename(access: WorkspaceAccess, kind: ListKind, id: string, input: CreateNamedItemInput): Promise<NamedItem> {
    await this.mustExist(access, kind, id);
    const db = this.prisma.forWorkspace(access.workspaceId);
    try {
      if (kind === 'role') await db.role.update({ where: { id }, data: { name: input.name } });
      else await db.channel.update({ where: { id }, data: { name: input.name } });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(`There is already a ${WORDS[kind].one} called "${input.name}"`);
      throw error;
    }
    const all = await this.list(access, kind);
    return all.find((item) => item.id === id)!;
  }

  /** Deleting something a skill uses would break that skill, so it is refused. */
  async remove(access: WorkspaceAccess, kind: ListKind, id: string): Promise<void> {
    const item = (await this.list(access, kind)).find((entry) => entry.id === id);
    if (!item) throw new NotFoundException(`${WORDS[kind].Title} not found`);
    if (item.usedBy > 0) {
      throw new ConflictException(
        `"${item.name}" is used in ${item.usedBy} ${item.usedBy === 1 ? 'place' : 'places'} in your skills. Change those first.`,
      );
    }
    const db = this.prisma.forWorkspace(access.workspaceId);
    if (kind === 'role') {
      // Archived skills may still point at it; detach them so history stays readable.
      await db.skill.updateMany({ where: { startedByRoleId: id }, data: { startedByRoleId: null } });
      await db.role.delete({ where: { id } });
    } else {
      await db.channel.delete({ where: { id } });
    }
  }

  private async mustExist(access: WorkspaceAccess, kind: ListKind, id: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const found =
      kind === 'role' ? await db.role.findUnique({ where: { id } }) : await db.channel.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`${WORDS[kind].Title} not found`);
  }
}
