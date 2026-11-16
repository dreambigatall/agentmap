import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SkillStatus } from '@prisma/client';
import {
  isReady,
  statusChange,
  STATUS_LABEL,
  type ChangeStatusInput,
  type CreateSkillInput,
  type SaveSkillInput,
  type RestoreSkillInput,
  type SkillDetail,
  type SkillVersion,
  type SkillVersionSummary,
} from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService, type WorkspaceDb, TX_OPTIONS } from '../../prisma/prisma.service';

const LIVE = { archivedAt: null } as const;

export const DETAIL_INCLUDE = {
  capability: { select: { name: true, agentId: true } },
  steps: { orderBy: { position: 'asc' } },
  inputs: { orderBy: { position: 'asc' } },
  channels: { orderBy: { channel: { sortOrder: 'asc' } } },
  versions: { orderBy: { number: 'desc' }, take: 1, include: { author: { select: { name: true } } } },
} satisfies Prisma.SkillInclude;

type SkillRow = Prisma.SkillGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(access: WorkspaceAccess, user: AuthUser, input: CreateSkillInput): Promise<SkillDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const capability = await db.capability.findFirst({
      where: { id: input.capabilityId, ...LIVE, agent: LIVE },
    });
    if (!capability) throw new BadRequestException('That capability does not exist any more. Reload and try again.');

    const last = await db.skill.aggregate({ where: { capabilityId: capability.id }, _max: { sortOrder: true } });
    const skill = await db.$transaction(async (tx) => {
      const created = await tx.skill.create({
        data: {
          workspaceId: access.workspaceId,
          capabilityId: capability.id,
          name: input.name,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
        include: DETAIL_INCLUDE,
      });
      await tx.skillVersion.create({
        data: {
          workspaceId: access.workspaceId,
          skillId: created.id,
          number: 1,
          snapshot: toDetail(created) as unknown as Prisma.InputJsonValue,
          note: 'Created',
          authorId: user.id,
        },
      });
      return created;
    }, TX_OPTIONS);
    return this.get(access, skill.id);
  }

  async get(access: WorkspaceAccess, skillId: string): Promise<SkillDetail> {
    return toDetail(await this.load(this.prisma.forWorkspace(access.workspaceId), skillId));
  }

  /**
   * Saves the whole skill as one change: fields, steps, inputs and channels, a new
   * version number and a snapshot. Refused when someone saved since the editor loaded.
   */
  async save(
    access: WorkspaceAccess,
    user: AuthUser,
    skillId: string,
    input: SaveSkillInput,
    /** Replaces the automatic "Changed ..." note, e.g. for a restore. */
    note?: string,
  ): Promise<SkillDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const before = await this.load(db, skillId);
    await this.checkReferences(db, before, input);

    const nextVersion = input.expectedVersion + 1;
    const ready = isReady(input);
    const status = statusAfterEdit(before.status, ready);

    await db.$transaction(async (tx) => {
      // Claim the version first. If someone else saved in between, nothing matches.
      const claimed = await tx.skill.updateMany({
        where: { id: skillId, version: input.expectedVersion, ...LIVE },
        data: { version: nextVersion },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          'Someone else saved this skill after you opened it. Reload to see their changes, then make yours again.',
        );
      }

      await tx.skill.update({
        where: { id: skillId },
        data: {
          capabilityId: input.capabilityId,
          name: input.name,
          startedByRoleId: input.startedByRoleId,
          trigger: input.trigger,
          deliverable: input.deliverable,
          humanControl: input.humanControl,
          runsAlongside: input.runsAlongside,
          status,
        },
      });

      // Any sign-off asked for or given on an earlier version no longer counts.
      await tx.signoff.updateMany({
        where: { skillId, status: { in: ['pending', 'approved'] } },
        data: { status: 'outdated' },
      });

      await syncSteps(tx, access.workspaceId, skillId, before, input);
      await syncInputs(tx, access.workspaceId, skillId, before, input);

      await tx.skillChannel.deleteMany({ where: { skillId } });
      if (input.channels.length > 0) {
        await tx.skillChannel.createMany({
          data: input.channels.map((c) => ({
            workspaceId: access.workspaceId,
            skillId,
            channelId: c.channelId,
            usage: c.usage,
          })),
        });
      }

      const after = await tx.skill.findUniqueOrThrow({ where: { id: skillId }, include: DETAIL_INCLUDE });
      const statusNote =
        status !== before.status ? `Status back to ${STATUS_LABEL[status]}: the readiness checklist is no longer complete` : null;
      await tx.skillVersion.create({
        data: {
          workspaceId: access.workspaceId,
          skillId,
          number: nextVersion,
          snapshot: toDetail(after) as unknown as Prisma.InputJsonValue,
          note: [note ?? describeChanges(toDetail(before), input), statusNote].filter(Boolean).join('. '),
          authorId: user.id,
        },
      });
    }, TX_OPTIONS);

    return this.get(access, skillId);
  }

  /** Moves a skill between Draft, Defined, In build and Live, following the shared rules. */
  async changeStatus(access: WorkspaceAccess, skillId: string, input: ChangeStatusInput): Promise<SkillDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const skill = toDetail(await this.load(db, skillId));
    if (skill.status === input.status) return skill;

    // In build and Live need a business owner's approval of exactly this version.
    const signedOff =
      (await db.signoff.count({ where: { skillId, skillVersion: skill.version, status: 'approved' } })) > 0;
    const verdict = statusChange(input.status, { ready: isReady(skill), signedOff });
    if (!verdict.allowed) throw new BadRequestException(verdict.reason);

    await db.skill.update({ where: { id: skillId }, data: { status: input.status } });
    return this.get(access, skillId);
  }

  /** Archiving hides the skill; its versions stay. */
  async archive(access: WorkspaceAccess, skillId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.load(db, skillId);
    await db.skill.update({ where: { id: skillId }, data: { archivedAt: new Date() } });
  }

  /** Every saved version, newest first. */
  async versions(access: WorkspaceAccess, skillId: string): Promise<SkillVersionSummary[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.load(db, skillId);
    const rows = await db.skillVersion.findMany({
      where: { skillId },
      orderBy: { number: 'desc' },
      include: { author: { select: { name: true } } },
    });
    return rows.map((v) => ({
      number: v.number,
      note: v.note,
      author: v.author?.name ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async version(access: WorkspaceAccess, skillId: string, number: number): Promise<SkillVersion> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    await this.load(db, skillId);
    const row = await db.skillVersion.findFirst({
      where: { skillId, number },
      include: { author: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException(`Version ${number} not found`);
    return {
      number: row.number,
      note: row.note,
      author: row.author?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      skill: row.snapshot as unknown as SkillDetail,
    };
  }

  /**
   * Brings back an earlier version as a new version: history only grows, nothing is
   * deleted. Steps that still exist keep their ids (and so their comments). Roles or
   * channels deleted since then are left out, and the note says so.
   */
  async restore(
    access: WorkspaceAccess,
    user: AuthUser,
    skillId: string,
    input: RestoreSkillInput,
  ): Promise<SkillDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const current = await this.load(db, skillId);
    const old = (await this.version(access, skillId, input.number)).skill;

    const [roles, channels, capability] = await Promise.all([
      db.role.findMany({ select: { id: true } }),
      db.channel.findMany({ select: { id: true } }),
      db.capability.findFirst({ where: { id: old.capabilityId, ...LIVE, agent: LIVE }, select: { id: true } }),
    ]);
    const roleIds = new Set(roles.map((r) => r.id));
    const channelIds = new Set(channels.map((c) => c.id));
    const stepIds = new Set(current.steps.map((s) => s.id));
    const inputIds = new Set(current.inputs.map((i) => i.id));

    let lostRoles = 0;
    const keepRole = (roleId: string | null) => {
      if (roleId === null || roleIds.has(roleId)) return roleId;
      lostRoles += 1;
      return null;
    };
    const keptChannels = old.channels.filter((c) => channelIds.has(c.channelId));

    const body: SaveSkillInput = {
      capabilityId: capability ? old.capabilityId : current.capabilityId,
      name: old.name,
      startedByRoleId: keepRole(old.startedByRoleId),
      trigger: old.trigger,
      steps: old.steps.map((s) => ({
        id: stepIds.has(s.id) ? s.id : undefined,
        roleId: keepRole(s.roleId),
        text: s.text,
        isApproval: s.isApproval,
        ifNo: s.ifNo,
      })),
      inputs: old.inputs.map((i) => ({ id: inputIds.has(i.id) ? i.id : undefined, label: i.label, need: i.need })),
      channels: keptChannels,
      deliverable: old.deliverable,
      humanControl: old.humanControl,
      runsAlongside: old.runsAlongside,
      expectedVersion: input.expectedVersion,
    };

    const lost = [
      lostRoles > 0 &&
        `${lostRoles} ${lostRoles === 1 ? 'role was' : 'roles were'} deleted since, so the agent does those steps`,
      old.channels.length > keptChannels.length && 'a channel deleted since was left out',
      !capability && 'its old capability was removed, so it stays where it is',
    ].filter(Boolean);
    const note = `Restored version ${input.number}${lost.length ? ` (${lost.join('; ')})` : ''}`;
    return this.save(access, user, skillId, body, note);
  }

  private async load(db: WorkspaceDb, skillId: string): Promise<SkillRow> {
    const skill = await db.skill.findFirst({
      where: { id: skillId, ...LIVE, capability: { ...LIVE, agent: LIVE } },
      include: DETAIL_INCLUDE,
    });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill as SkillRow;
  }

  /** Every id in a save must belong to this workspace, and step ids to this skill. */
  private async checkReferences(db: WorkspaceDb, before: SkillRow, input: SaveSkillInput): Promise<void> {
    const capability = await db.capability.findFirst({
      where: { id: input.capabilityId, ...LIVE, agent: LIVE },
      select: { id: true },
    });
    if (!capability) throw new BadRequestException('That capability does not exist any more.');

    const roleIds = unique([input.startedByRoleId, ...input.steps.map((s) => s.roleId)]);
    if (roleIds.length > 0 && (await db.role.count({ where: { id: { in: roleIds } } })) !== roleIds.length) {
      throw new BadRequestException('One of the roles does not exist any more. Reload and try again.');
    }

    const channelIds = input.channels.map((c) => c.channelId);
    if (channelIds.length > 0 && (await db.channel.count({ where: { id: { in: channelIds } } })) !== channelIds.length) {
      throw new BadRequestException('One of the channels does not exist any more. Reload and try again.');
    }

    const ownSteps = new Set(before.steps.map((s) => s.id));
    const ownInputs = new Set(before.inputs.map((i) => i.id));
    const stepIds = input.steps.map((s) => s.id).filter(Boolean) as string[];
    const inputIds = input.inputs.map((i) => i.id).filter(Boolean) as string[];
    if (stepIds.some((id) => !ownSteps.has(id)) || new Set(stepIds).size !== stepIds.length) {
      throw new BadRequestException('The steps do not match this skill. Reload and try again.');
    }
    if (inputIds.some((id) => !ownInputs.has(id)) || new Set(inputIds).size !== inputIds.length) {
      throw new BadRequestException('The information list does not match this skill. Reload and try again.');
    }
  }
}

/** Editing a skill that is past Draft keeps its place only while it is still complete. */
export function statusAfterEdit(current: SkillStatus, ready: boolean): SkillStatus {
  if (!ready) return 'draft';
  // A signed-off version changed, so it needs signing off again.
  if (current === 'in_build' || current === 'live') return 'defined';
  return current;
}

type Tx = Parameters<Parameters<WorkspaceDb['$transaction']>[0]>[0];

async function syncSteps(tx: Tx, workspaceId: string, skillId: string, before: SkillRow, input: SaveSkillInput) {
  const keep = new Set(input.steps.map((s) => s.id).filter(Boolean));
  await tx.skillStep.deleteMany({ where: { skillId, id: { notIn: [...keep] as string[] } } });
  for (const [position, step] of input.steps.entries()) {
    const data = { position, roleId: step.roleId, text: step.text, isApproval: step.isApproval, ifNo: step.isApproval ? step.ifNo : '' };
    if (step.id) await tx.skillStep.update({ where: { id: step.id }, data });
    else await tx.skillStep.create({ data: { ...data, workspaceId, skillId } });
  }
  void before;
}

async function syncInputs(tx: Tx, workspaceId: string, skillId: string, before: SkillRow, input: SaveSkillInput) {
  const keep = new Set(input.inputs.map((i) => i.id).filter(Boolean));
  await tx.skillInput.deleteMany({ where: { skillId, id: { notIn: [...keep] as string[] } } });
  for (const [position, item] of input.inputs.entries()) {
    const data = { position, label: item.label, need: item.need };
    if (item.id) await tx.skillInput.update({ where: { id: item.id }, data });
    else await tx.skillInput.create({ data: { ...data, workspaceId, skillId } });
  }
  void before;
}

function unique(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function toDetail(skill: SkillRow): SkillDetail {
  return {
    id: skill.id,
    capabilityId: skill.capabilityId,
    capabilityName: skill.capability.name,
    agentId: skill.capability.agentId,
    name: skill.name,
    status: skill.status,
    version: skill.version,
    startedByRoleId: skill.startedByRoleId,
    trigger: skill.trigger,
    deliverable: skill.deliverable,
    humanControl: skill.humanControl,
    runsAlongside: skill.runsAlongside,
    steps: skill.steps.map((s) => ({ id: s.id, roleId: s.roleId, text: s.text, isApproval: s.isApproval, ifNo: s.ifNo })),
    inputs: skill.inputs.map((i) => ({ id: i.id, label: i.label, need: i.need })),
    channels: skill.channels.map((c) => ({ channelId: c.channelId, usage: c.usage })),
    updatedAt: skill.updatedAt.toISOString(),
    updatedBy: skill.versions[0]?.author?.name ?? null,
  };
}

/** A short sentence saying what a save changed, kept with the version. */
export function describeChanges(before: SkillDetail, after: SaveSkillInput): string {
  const parts: string[] = [];
  const field = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) parts.push(label);
  };
  field('name', before.name, after.name);
  field('what starts it', [before.startedByRoleId, before.trigger], [after.startedByRoleId, after.trigger]);

  const beforeIds = new Set(before.steps.map((s) => s.id));
  const added = after.steps.filter((s) => !s.id).length;
  const removed = before.steps.filter((s) => !after.steps.some((n) => n.id === s.id)).length;
  const edited = after.steps.filter((s) => {
    if (!s.id || !beforeIds.has(s.id)) return false;
    const old = before.steps.find((o) => o.id === s.id)!;
    return old.text !== s.text || old.roleId !== s.roleId || old.isApproval !== s.isApproval || old.ifNo !== s.ifNo;
  }).length;
  const reordered =
    added === 0 &&
    removed === 0 &&
    after.steps.map((s) => s.id).join() !== before.steps.map((s) => s.id).join();
  const stepWords = [
    added && `${added} added`,
    removed && `${removed} removed`,
    edited && `${edited} edited`,
    reordered && 'reordered',
  ].filter(Boolean);
  if (stepWords.length) parts.push(`steps (${stepWords.join(', ')})`);

  field('information needed', before.inputs.map(({ label, need }) => [label, need]), after.inputs.map(({ label, need }) => [label, need]));
  field('channels', before.channels, after.channels);
  field('what it delivers', before.deliverable, after.deliverable);
  field('human control', before.humanControl, after.humanControl);
  field('runs alongside', before.runsAlongside, after.runsAlongside);
  field('capability', before.capabilityId, after.capabilityId);

  return parts.length ? `Changed ${parts.join(', ')}` : 'Saved without changes';
}
