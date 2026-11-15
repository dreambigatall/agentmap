import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  skillReadiness,
  type AgentDetail,
  type AgentInput,
  type AgentSummary,
  type CapabilityFlow,
  type CapabilityInput,
  type ReorderInput,
  type SkillSummary,
  type UpdateAgentInput,
} from '@skillflow/shared';
import type { WorkspaceAccess } from '../../common/request';
import { PrismaService, TX_OPTIONS } from '../../prisma/prisma.service';

/** Every new agent starts with one capability, so skills can be added straight away. */
const FIRST_CAPABILITY = 'General';

const LIVE = { archivedAt: null } as const;

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(access: WorkspaceAccess): Promise<AgentSummary[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const agents = await db.agent.findMany({
      where: LIVE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { capabilities: { where: LIVE, include: { _count: { select: { skills: { where: LIVE } } } } } },
    });
    return agents.map((a) => ({
      id: a.id,
      shortName: a.shortName,
      fullName: a.fullName,
      description: a.description,
      color: a.color as AgentSummary['color'],
      skillCount: a.capabilities.reduce((sum, c) => sum + c._count.skills, 0),
    }));
  }

  async create(access: WorkspaceAccess, input: AgentInput): Promise<AgentDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const last = await db.agent.aggregate({ _max: { sortOrder: true } });
    const agent = await db.$transaction(async (tx) => {
      const created = await tx.agent.create({
        data: {
          workspaceId: access.workspaceId,
          shortName: input.shortName,
          fullName: input.fullName,
          description: input.description,
          color: input.color,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      await tx.capability.create({
        data: { workspaceId: access.workspaceId, agentId: created.id, name: FIRST_CAPABILITY },
      });
      return created;
    }, TX_OPTIONS);
    return this.get(access, agent.id);
  }

  async get(access: WorkspaceAccess, agentId: string): Promise<AgentDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const agent = await db.agent.findFirst({
      where: { id: agentId, ...LIVE },
      include: {
        capabilities: {
          where: LIVE,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            skills: {
              where: LIVE,
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: { steps: { select: { roleId: true, isApproval: true, text: true } }, _count: { select: { inputs: true } } },
            },
          },
        },
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    return {
      id: agent.id,
      shortName: agent.shortName,
      fullName: agent.fullName,
      description: agent.description,
      color: agent.color as AgentDetail['color'],
      capabilities: agent.capabilities.map((c) => ({
        id: c.id,
        name: c.name,
        skills: c.skills.map(
          (s): SkillSummary => ({
            id: s.id,
            name: s.name,
            status: s.status,
            runsAlongside: s.runsAlongside,
            stepCount: s.steps.length,
            checksPassed: skillReadiness({
              trigger: s.trigger,
              steps: s.steps,
              inputs: Array.from({ length: s._count.inputs }),
              deliverable: s.deliverable,
              humanControl: s.humanControl,
            }).filter((check) => check.ok).length,
            updatedAt: s.updatedAt.toISOString(),
          }),
        ),
      })),
    };
  }

  async update(access: WorkspaceAccess, agentId: string, input: UpdateAgentInput): Promise<AgentDetail> {
    await this.mustExist(access, agentId);
    await this.prisma.forWorkspace(access.workspaceId).agent.update({ where: { id: agentId }, data: input });
    return this.get(access, agentId);
  }

  /** Archiving hides the agent and keeps everything in it. */
  async archive(access: WorkspaceAccess, agentId: string): Promise<void> {
    await this.mustExist(access, agentId);
    await this.prisma.forWorkspace(access.workspaceId).agent.update({
      where: { id: agentId },
      data: { archivedAt: new Date() },
    });
  }

  async addCapability(access: WorkspaceAccess, agentId: string, input: CapabilityInput): Promise<AgentDetail> {
    await this.mustExist(access, agentId);
    const db = this.prisma.forWorkspace(access.workspaceId);
    const last = await db.capability.aggregate({ where: { agentId }, _max: { sortOrder: true } });
    await db.capability.create({
      data: {
        workspaceId: access.workspaceId,
        agentId,
        name: input.name,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    return this.get(access, agentId);
  }

  async renameCapability(access: WorkspaceAccess, capabilityId: string, input: CapabilityInput): Promise<AgentDetail> {
    const capability = await this.findCapability(access, capabilityId);
    await this.prisma.forWorkspace(access.workspaceId).capability.update({
      where: { id: capabilityId },
      data: { name: input.name },
    });
    return this.get(access, capability.agentId);
  }

  async archiveCapability(access: WorkspaceAccess, capabilityId: string): Promise<AgentDetail> {
    const capability = await this.findCapability(access, capabilityId);
    const db = this.prisma.forWorkspace(access.workspaceId);
    const remaining = await db.capability.count({ where: { agentId: capability.agentId, ...LIVE } });
    if (remaining <= 1) {
      throw new BadRequestException('An agent needs at least one capability. Add another before removing this one.');
    }
    await db.capability.update({ where: { id: capabilityId }, data: { archivedAt: new Date() } });
    return this.get(access, capability.agentId);
  }

  async reorderCapabilities(access: WorkspaceAccess, agentId: string, input: ReorderInput): Promise<AgentDetail> {
    await this.mustExist(access, agentId);
    const db = this.prisma.forWorkspace(access.workspaceId);
    const existing = await db.capability.findMany({ where: { agentId, ...LIVE }, select: { id: true } });
    assertSameSet(existing.map((c) => c.id), input.ids, 'capabilities');
    await db.$transaction(
      input.ids.map((id, sortOrder) => db.capability.update({ where: { id }, data: { sortOrder } })),
    );
    return this.get(access, agentId);
  }

  async reorderSkills(access: WorkspaceAccess, capabilityId: string, input: ReorderInput): Promise<AgentDetail> {
    const capability = await this.findCapability(access, capabilityId);
    const db = this.prisma.forWorkspace(access.workspaceId);
    const existing = await db.skill.findMany({ where: { capabilityId, ...LIVE }, select: { id: true } });
    assertSameSet(existing.map((s) => s.id), input.ids, 'skills');
    await db.$transaction(input.ids.map((id, sortOrder) => db.skill.update({ where: { id }, data: { sortOrder } })));
    return this.get(access, capability.agentId);
  }

  /** Every skill of a capability with its steps, in order: what the full flow draws. */
  async flow(access: WorkspaceAccess, capabilityId: string): Promise<CapabilityFlow> {
    const capability = await this.findCapability(access, capabilityId);
    const skills = await this.prisma.forWorkspace(access.workspaceId).skill.findMany({
      where: { capabilityId, ...LIVE },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startedByRoleId: s.startedByRoleId,
        trigger: s.trigger,
        runsAlongside: s.runsAlongside,
        steps: s.steps.map((step) => ({
          id: step.id,
          roleId: step.roleId,
          text: step.text,
          isApproval: step.isApproval,
        })),
      })),
    };
  }

  private async mustExist(access: WorkspaceAccess, agentId: string): Promise<void> {
    const found = await this.prisma
      .forWorkspace(access.workspaceId)
      .agent.findFirst({ where: { id: agentId, ...LIVE }, select: { id: true } });
    if (!found) throw new NotFoundException('Agent not found');
  }

  private async findCapability(access: WorkspaceAccess, capabilityId: string) {
    const found = await this.prisma
      .forWorkspace(access.workspaceId)
      .capability.findFirst({ where: { id: capabilityId, ...LIVE, agent: LIVE } });
    if (!found) throw new NotFoundException('Capability not found');
    return found;
  }
}

/** A reorder must name exactly the current items, each once. */
function assertSameSet(current: string[], proposed: string[], what: string): void {
  const same =
    current.length === proposed.length &&
    new Set(proposed).size === proposed.length &&
    proposed.every((id) => current.includes(id));
  if (!same) throw new BadRequestException(`The new order must list every one of the ${what}, each once. Reload and try again.`);
}
