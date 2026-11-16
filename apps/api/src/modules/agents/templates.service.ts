import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { findTemplate, templateChannels, templateRoles, type AgentDetail, type SkillDetail } from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService, TX_OPTIONS } from '../../prisma/prisma.service';
import { AgentsService } from './agents.service';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
  ) {}

  /**
   * Adds a starter template's agent to the workspace: any roles and channels it names that
   * the workspace lacks, then the agent, its capabilities and its skills as Drafts with a
   * first version each. Applying the same template twice makes a second, separate agent.
   */
  async apply(access: WorkspaceAccess, user: AuthUser, key: string): Promise<AgentDetail> {
    const template = findTemplate(key);
    if (!template) throw new BadRequestException('That template does not exist.');
    const { workspaceId } = access;
    const db = this.prisma.forWorkspace(workspaceId);

    const roleIds = await this.ensureNamed('role', workspaceId, templateRoles(template));
    const channelIds = await this.ensureNamed('channel', workspaceId, templateChannels(template));
    const roleId = (name: string | null) => (name ? (roleIds.get(name.toLowerCase()) ?? null) : null);
    const last = await db.agent.aggregate({ _max: { sortOrder: true } });

    // Ids are made here so the whole agent goes in as a handful of bulk inserts:
    // one round trip per table instead of several per skill.
    const now = new Date();
    const agentId = randomUUID();
    const capabilities: Prisma.CapabilityCreateManyInput[] = [];
    const skills: Prisma.SkillCreateManyInput[] = [];
    const steps: Prisma.SkillStepCreateManyInput[] = [];
    const inputs: Prisma.SkillInputCreateManyInput[] = [];
    const channels: Prisma.SkillChannelCreateManyInput[] = [];
    const versions: Prisma.SkillVersionCreateManyInput[] = [];

    for (const [capabilityOrder, capability] of template.capabilities.entries()) {
      const capabilityId = randomUUID();
      capabilities.push({ id: capabilityId, workspaceId, agentId, name: capability.name, sortOrder: capabilityOrder });
      for (const [skillOrder, skill] of capability.skills.entries()) {
        const skillId = randomUUID();
        const detail: SkillDetail = {
          id: skillId,
          capabilityId,
          capabilityName: capability.name,
          agentId,
          name: skill.name,
          status: 'draft',
          version: 1,
          startedByRoleId: roleId(skill.startedBy),
          trigger: skill.trigger,
          deliverable: skill.deliverable,
          humanControl: skill.humanControl,
          runsAlongside: skill.runsAlongside ?? false,
          steps: skill.steps.map((step) => ({
            id: randomUUID(),
            roleId: roleId(step.by),
            text: step.text,
            isApproval: step.isApproval ?? false,
            ifNo: step.isApproval ? (step.ifNo ?? '') : '',
          })),
          inputs: skill.inputs.map((input) => ({ id: randomUUID(), label: input.label, need: input.need })),
          channels: skill.channels.map((channel) => ({
            channelId: channelIds.get(channel.name.toLowerCase())!,
            usage: channel.usage,
          })),
          updatedAt: now.toISOString(),
          updatedBy: null,
        };
        skills.push({
          id: skillId,
          workspaceId,
          capabilityId,
          name: detail.name,
          sortOrder: skillOrder,
          startedByRoleId: detail.startedByRoleId,
          trigger: detail.trigger,
          deliverable: detail.deliverable,
          humanControl: detail.humanControl,
          runsAlongside: detail.runsAlongside,
          createdAt: now,
          updatedAt: now,
        });
        detail.steps.forEach((step, position) => steps.push({ ...step, workspaceId, skillId, position }));
        detail.inputs.forEach((input, position) => inputs.push({ ...input, workspaceId, skillId, position }));
        detail.channels.forEach((channel) => channels.push({ ...channel, workspaceId, skillId }));
        versions.push({
          workspaceId,
          skillId,
          number: 1,
          snapshot: detail as unknown as Prisma.InputJsonValue,
          note: `Created from the ${template.name} template`,
          authorId: user.id,
          createdAt: now,
        });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.agent.create({
        data: {
          id: agentId,
          workspaceId,
          shortName: template.agent.shortName,
          fullName: template.agent.fullName,
          description: template.agent.description,
          color: template.agent.color,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      await tx.capability.createMany({ data: capabilities });
      await tx.skill.createMany({ data: skills });
      await tx.skillStep.createMany({ data: steps });
      await tx.skillInput.createMany({ data: inputs });
      await tx.skillChannel.createMany({ data: channels });
      await tx.skillVersion.createMany({ data: versions });
    }, TX_OPTIONS);

    return this.agents.get(access, agentId);
  }

  /** Finds roles or channels by name (ignoring case), creating the missing ones at the end of the list. */
  private async ensureNamed(kind: 'role' | 'channel', workspaceId: string, names: string[]): Promise<Map<string, string>> {
    const db = this.prisma.forWorkspace(workspaceId);
    const model = kind === 'role' ? db.role : db.channel;
    const read = async () =>
      // Both models have the same shape; the cast only picks one call signature.
      (await (model as typeof db.role).findMany({ select: { id: true, name: true, sortOrder: true } }));

    let existing = await read();
    const have = new Set(existing.map((r) => r.name.toLowerCase()));
    const missing = names.filter((name) => !have.has(name.toLowerCase()));
    if (missing.length > 0) {
      const start = Math.max(-1, ...existing.map((r) => r.sortOrder)) + 1;
      await (model as typeof db.role).createMany({
        data: missing.map((name, i) => ({ workspaceId, name, sortOrder: start + i })),
        skipDuplicates: true,
      });
      existing = await read();
    }
    return new Map(existing.map((r) => [r.name.toLowerCase(), r.id]));
  }
}
