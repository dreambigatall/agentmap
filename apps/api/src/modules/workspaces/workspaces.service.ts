import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  slugify,
  type CreateWorkspaceInput,
  type RenameWorkspaceInput,
  type WorkspaceDetail,
  type WorkspaceSummary,
} from '@skillflow/shared';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a workspace with the caller as its owner. */
  async create(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceSummary> {
    const base = slugify(input.name);
    // Try the plain slug first, then add a short random ending until it is free.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      try {
        const workspace = await this.prisma.workspace.create({
          data: {
            name: input.name,
            slug,
            memberships: { create: { userId, level: 'owner' } },
          },
        });
        return { id: workspace.id, name: workspace.name, slug: workspace.slug, level: 'owner' };
      } catch (error) {
        const slugTaken =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!slugTaken) throw error;
      }
    }
    throw new Error('Could not find a free workspace address');
  }

  async listMine(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      level: m.level,
    }));
  }

  async get(workspaceId: string): Promise<WorkspaceDetail> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return toDetail(workspace);
  }

  async rename(workspaceId: string, input: RenameWorkspaceInput): Promise<WorkspaceDetail> {
    // The address stays the same on rename, so links people saved keep working.
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: input.name },
    });
    return toDetail(workspace);
  }
}

function toDetail(w: { id: string; name: string; slug: string; createdAt: Date }): WorkspaceDetail {
  return { id: w.id, name: w.name, slug: w.slug, createdAt: w.createdAt.toISOString() };
}
