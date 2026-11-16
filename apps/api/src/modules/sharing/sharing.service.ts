import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SKILL_EXPORT_FORMAT,
  type AgentColor,
  type PublicAgent,
  type ShareLink,
  type SkillExport,
} from '@skillflow/shared';
import { randomToken } from '../../common/crypto';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';
import { DETAIL_INCLUDE, toDetail } from '../skills/skills.service';

const LIVE = { archivedAt: null } as const;
/** How often a view updates "last viewed", so a busy link does not write on every visit. */
const VIEW_WRITE_EVERY_MS = 5 * 60_000;

@Injectable()
export class SharingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(access: WorkspaceAccess, agentId: string): Promise<ShareLink[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.agentMustExist(access, agentId);
    const links = await db.shareLink.findMany({
      where: { agentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    return links.map((l) => ({
      id: l.id,
      token: l.token,
      createdBy: l.createdBy.name,
      createdAt: l.createdAt.toISOString(),
      lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
    }));
  }

  async create(access: WorkspaceAccess, user: AuthUser, agentId: string): Promise<ShareLink> {
    await this.agentMustExist(access, agentId);
    const db = this.prisma.forWorkspace(access.workspaceId);
    const link = await db.shareLink.create({
      data: { workspaceId: access.workspaceId, agentId, token: randomToken(), createdById: user.id },
      include: { createdBy: { select: { name: true } } },
    });
    return {
      id: link.id,
      token: link.token,
      createdBy: link.createdBy.name,
      createdAt: link.createdAt.toISOString(),
      lastViewedAt: null,
    };
  }

  async revoke(access: WorkspaceAccess, shareId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const { count } = await db.shareLink.updateMany({
      where: { id: shareId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('Share link not found');
  }

  /** The public page. A missing, turned-off or archived link all look the same: not found. */
  async view(token: string): Promise<PublicAgent> {
    const link = await this.prisma.shareLink.findUnique({ where: { token } });
    if (!link || link.revokedAt) throw new NotFoundException('This link is not available');

    const db = this.prisma.forWorkspace(link.workspaceId);
    const agent = await db.agent.findFirst({
      where: { id: link.agentId, ...LIVE },
      include: {
        workspace: { select: { name: true } },
        capabilities: {
          where: LIVE,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            skills: { where: LIVE, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: DETAIL_INCLUDE },
          },
        },
      },
    });
    if (!agent) throw new NotFoundException('This link is not available');

    const [roles, channels] = await Promise.all([
      db.role.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
      db.channel.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    ]);

    if (!link.lastViewedAt || Date.now() - link.lastViewedAt.getTime() > VIEW_WRITE_EVERY_MS) {
      await db.shareLink.updateMany({ where: { id: link.id }, data: { lastViewedAt: new Date() } });
    }

    return {
      workspaceName: agent.workspace.name,
      agent: {
        id: agent.id,
        shortName: agent.shortName,
        fullName: agent.fullName,
        description: agent.description,
        color: agent.color as AgentColor,
      },
      roles,
      channels,
      capabilities: agent.capabilities.map((c) => ({
        id: c.id,
        name: c.name,
        // Who saved what stays inside the workspace.
        skills: c.skills.map((s) => ({ ...toDetail(s), updatedBy: null })),
      })),
    };
  }

  /** One skill as a file that reads on its own: role and channel ids become names. */
  async exportSkill(access: WorkspaceAccess, skillId: string): Promise<SkillExport> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const skill = await db.skill.findFirst({
      where: { id: skillId, ...LIVE, capability: { ...LIVE, agent: LIVE } },
      include: { ...DETAIL_INCLUDE, capability: { select: { name: true, agentId: true, agent: true } } },
    });
    if (!skill) throw new NotFoundException('Skill not found');

    const [roles, channels] = await Promise.all([
      db.role.findMany({ select: { id: true, name: true } }),
      db.channel.findMany({ select: { id: true, name: true } }),
    ]);
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const channelName = new Map(channels.map((c) => [c.id, c.name]));
    const agentName = skill.capability.agent.shortName;
    const who = (roleId: string | null) => (roleId ? roleName.get(roleId) ?? 'Unknown role' : agentName);

    return {
      format: SKILL_EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      skill: {
        name: skill.name,
        agent: `${agentName} · ${skill.capability.agent.fullName}`,
        capability: skill.capability.name,
        status: skill.status,
        version: skill.version,
        startedBy: who(skill.startedByRoleId),
        trigger: skill.trigger,
        steps: skill.steps.map((s) => ({
          doneBy: who(s.roleId),
          text: s.text,
          isApproval: s.isApproval,
          ifNo: s.ifNo,
        })),
        inputs: skill.inputs.map((i) => ({ label: i.label, need: i.need })),
        channels: skill.channels.map((c) => ({ name: channelName.get(c.channelId) ?? 'Unknown channel', usage: c.usage })),
        deliverable: skill.deliverable,
        humanControl: skill.humanControl,
        runsAlongside: skill.runsAlongside,
      },
    };
  }

  private async agentMustExist(access: WorkspaceAccess, agentId: string): Promise<void> {
    const found = await this.prisma
      .forWorkspace(access.workspaceId)
      .agent.findFirst({ where: { id: agentId, ...LIVE }, select: { id: true } });
    if (!found) throw new NotFoundException('Agent not found');
  }
}
