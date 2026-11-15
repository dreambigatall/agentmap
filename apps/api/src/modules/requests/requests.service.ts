import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  atLeast,
  canEditRequest,
  REQUEST_STATUS_LABEL,
  type ConvertRequestInput,
  type CreateRequestInput,
  type RequestDetail,
  type RequestStatusChange,
  type RequestSummary,
  type SaveRequestInput,
  type SkillDetail,
} from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService, TX_OPTIONS, type WorkspaceDb } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toDetail as skillToDetail } from '../skills/skills.service';

const LIVE = { archivedAt: null } as const;

const DETAIL_INCLUDE = {
  author: { select: { id: true, name: true } },
  skill: { select: { name: true, archivedAt: true } },
  steps: { orderBy: { position: 'asc' } },
  inputs: { orderBy: { position: 'asc' } },
  files: {
    orderBy: { createdAt: 'asc' },
    // Never load file contents here; only the download route reads `data`.
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      requestInputId: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.RequestInclude;

type RequestRow = Prisma.RequestGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(access: WorkspaceAccess, agentId?: string): Promise<RequestSummary[]> {
    const rows = await this.prisma.forWorkspace(access.workspaceId).request.findMany({
      where: { ...LIVE, ...(agentId ? { agentId } : {}), agent: LIVE },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true } }, _count: { select: { steps: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      agentId: r.agentId,
      author: r.author,
      stepCount: r._count.steps,
      skillId: r.skillId,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** Anyone in the workspace may describe how work is done today. Editors are told. */
  async create(access: WorkspaceAccess, user: AuthUser, input: CreateRequestInput): Promise<RequestDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const agent = await db.agent.findFirst({ where: { id: input.agentId, ...LIVE } });
    if (!agent) throw new BadRequestException('That agent does not exist any more.');

    const request = await db.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: { workspaceId: access.workspaceId, agentId: agent.id, name: input.name, authorId: user.id },
        include: DETAIL_INCLUDE,
      });
      await tx.requestVersion.create({
        data: {
          workspaceId: access.workspaceId,
          requestId: created.id,
          number: 1,
          snapshot: toDetail(created) as unknown as Prisma.InputJsonValue,
          note: 'Submitted',
          authorId: user.id,
        },
      });
      return created;
    }, TX_OPTIONS);

    const editors = await this.notifications.membersAtLeastEditor(access.workspaceId);
    const author = request.author.name;
    await this.notifications.notify({
      workspaceId: access.workspaceId,
      userIds: editors,
      actorId: user.id,
      kind: 'request_submitted',
      text: `${author} submitted a request for ${agent.shortName}: ${request.name}`,
      path: `requests/${request.id}`,
      email: {
        subject: `New request: ${request.name}`,
        body: `${author} described how "${request.name}" is done today, for ${agent.fullName}. Review it when it is ready.`,
      },
    });
    return toDetail(request);
  }

  async get(access: WorkspaceAccess, requestId: string): Promise<RequestDetail> {
    return toDetail(await this.load(this.prisma.forWorkspace(access.workspaceId), requestId));
  }

  /** Saves the whole form as one change. Refused when someone saved since it was loaded. */
  async save(access: WorkspaceAccess, user: AuthUser, requestId: string, input: SaveRequestInput): Promise<RequestDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const before = await this.load(db, requestId);
    this.assertCanEdit(access, user, before);

    const roleIds = [...new Set(input.steps.map((s) => s.roleId).filter((id): id is string => Boolean(id)))];
    if (roleIds.length && (await db.role.count({ where: { id: { in: roleIds } } })) !== roleIds.length) {
      throw new BadRequestException('One of the roles does not exist any more. Reload and try again.');
    }
    const ownSteps = new Set(before.steps.map((s) => s.id));
    const ownInputs = new Set(before.inputs.map((i) => i.id));
    if (input.steps.some((s) => s.id && !ownSteps.has(s.id)) || input.inputs.some((i) => i.id && !ownInputs.has(i.id))) {
      throw new BadRequestException('The form does not match this request. Reload and try again.');
    }

    const next = input.expectedVersion + 1;
    await db.$transaction(async (tx) => {
      const claimed = await tx.request.updateMany({
        where: { id: requestId, version: input.expectedVersion, ...LIVE },
        data: { version: next },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Someone else saved this request after you opened it. Reload to see their changes.');
      }
      await tx.request.update({
        where: { id: requestId },
        data: {
          name: input.name,
          trigger: input.trigger,
          ownerRole: input.ownerRole,
          frequency: input.frequency,
          result: input.result,
          rules: input.rules,
          problems: input.problems,
          keepHuman: input.keepHuman,
        },
      });

      const keepSteps = input.steps.map((s) => s.id).filter(Boolean) as string[];
      await tx.requestStep.deleteMany({ where: { requestId, id: { notIn: keepSteps } } });
      for (const [position, step] of input.steps.entries()) {
        const data = {
          position,
          roleId: step.roleId,
          otherRole: step.roleId ? '' : step.otherRole,
          action: step.action,
          place: step.place,
          isApproval: step.isApproval,
          ifNo: step.isApproval ? step.ifNo : '',
        };
        if (step.id) await tx.requestStep.update({ where: { id: step.id }, data });
        else await tx.requestStep.create({ data: { ...data, workspaceId: access.workspaceId, requestId } });
      }

      const keepInputs = input.inputs.map((i) => i.id).filter(Boolean) as string[];
      await tx.requestInput.deleteMany({ where: { requestId, id: { notIn: keepInputs } } });
      for (const [position, item] of input.inputs.entries()) {
        const data = { position, what: item.what, who: item.who };
        if (item.id) await tx.requestInput.update({ where: { id: item.id }, data });
        else await tx.requestInput.create({ data: { ...data, workspaceId: access.workspaceId, requestId } });
      }

      const after = await tx.request.findUniqueOrThrow({ where: { id: requestId }, include: DETAIL_INCLUDE });
      await tx.requestVersion.create({
        data: {
          workspaceId: access.workspaceId,
          requestId,
          number: next,
          snapshot: toDetail(after) as unknown as Prisma.InputJsonValue,
          note: user.id === before.authorId ? 'Edited by the author' : 'Edited by a reviewer',
          authorId: user.id,
        },
      });
    }, TX_OPTIONS);

    return this.get(access, requestId);
  }

  /** Editors move a request through review. A converted request stays Approved. */
  async changeStatus(access: WorkspaceAccess, user: AuthUser, requestId: string, input: RequestStatusChange): Promise<RequestDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const request = await this.load(db, requestId);
    if (request.status === input.status) return toDetail(request);
    if (request.skillId && input.status !== 'approved') {
      throw new BadRequestException('This request already became a skill, so it stays Approved.');
    }
    await db.request.update({ where: { id: requestId }, data: { status: input.status } });

    if (input.status === 'approved' || input.status === 'declined') {
      await this.notifications.notify({
        workspaceId: access.workspaceId,
        userIds: [request.authorId],
        actorId: user.id,
        kind: 'request_decided',
        text: `Your request "${request.name}" was ${REQUEST_STATUS_LABEL[input.status].toLowerCase()}`,
        path: `requests/${requestId}`,
        email: {
          subject: `Your request was ${REQUEST_STATUS_LABEL[input.status].toLowerCase()}: ${request.name}`,
          body: `Your request "${request.name}" was ${REQUEST_STATUS_LABEL[input.status].toLowerCase()}. Its comments say more.`,
        },
      });
    }
    return this.get(access, requestId);
  }

  /**
   * Turns an approved request into a draft skill in one of its agent's capabilities.
   * Steps keep their actor, text and approval. A "someone else" actor becomes a
   * workspace role, created if it does not exist yet.
   */
  async convert(access: WorkspaceAccess, user: AuthUser, requestId: string, input: ConvertRequestInput): Promise<SkillDetail> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const request = await this.load(db, requestId);
    if (request.status !== 'approved') throw new BadRequestException('Approve the request before turning it into a skill.');
    if (request.skillId && !request.skill?.archivedAt) {
      throw new ConflictException('This request already became a skill.');
    }
    const capability = await db.capability.findFirst({
      where: { id: input.capabilityId, agentId: request.agentId, ...LIVE },
    });
    if (!capability) throw new BadRequestException('Choose a capability of this request’s agent.');

    // Free-text actors become roles, matched by name regardless of case.
    const otherNames = [...new Set(request.steps.filter((s) => !s.roleId && s.otherRole).map((s) => s.otherRole))];
    const roleByName = new Map<string, string>();
    if (otherNames.length) {
      const existing = await db.role.findMany({ select: { id: true, name: true } });
      for (const role of existing) roleByName.set(role.name.toLowerCase(), role.id);
      const last = await db.role.aggregate({ _max: { sortOrder: true } });
      let order = (last._max.sortOrder ?? -1) + 1;
      for (const name of otherNames) {
        if (roleByName.has(name.toLowerCase())) continue;
        const role = await db.role.create({ data: { workspaceId: access.workspaceId, name, sortOrder: order++ } });
        roleByName.set(name.toLowerCase(), role.id);
      }
    }

    const last = await db.skill.aggregate({ where: { capabilityId: capability.id }, _max: { sortOrder: true } });
    const skillId = await db.$transaction(async (tx) => {
      const skill = await tx.skill.create({
        data: {
          workspaceId: access.workspaceId,
          capabilityId: capability.id,
          name: request.name,
          trigger: request.trigger,
          deliverable: request.result,
          humanControl: request.keepHuman,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      if (request.steps.length) {
        await tx.skillStep.createMany({
          data: request.steps.map((s, position) => ({
            workspaceId: access.workspaceId,
            skillId: skill.id,
            position,
            roleId: s.roleId ?? roleByName.get(s.otherRole.toLowerCase()) ?? null,
            text: s.place ? `${s.action} (${s.place})` : s.action,
            isApproval: s.isApproval,
            ifNo: s.ifNo,
          })),
        });
      }
      if (request.inputs.length) {
        await tx.skillInput.createMany({
          data: request.inputs.map((i, position) => ({
            workspaceId: access.workspaceId,
            skillId: skill.id,
            position,
            label: i.who ? `${i.what} (from ${i.who})` : i.what,
            need: 'required' as const,
          })),
        });
      }
      const full = await tx.skill.findUniqueOrThrow({
        where: { id: skill.id },
        include: {
          capability: { select: { name: true, agentId: true } },
          steps: { orderBy: { position: 'asc' } },
          inputs: { orderBy: { position: 'asc' } },
          channels: { orderBy: { channel: { sortOrder: 'asc' } } },
          versions: { orderBy: { number: 'desc' }, take: 1, include: { author: { select: { name: true } } } },
        },
      });
      await tx.skillVersion.create({
        data: {
          workspaceId: access.workspaceId,
          skillId: skill.id,
          number: 1,
          snapshot: skillToDetail(full) as unknown as Prisma.InputJsonValue,
          note: `Created from the request "${request.name}"`,
          authorId: user.id,
        },
      });
      await tx.request.update({ where: { id: requestId }, data: { skillId: skill.id } });
      return skill.id;
    }, TX_OPTIONS);

    await this.notifications.notify({
      workspaceId: access.workspaceId,
      userIds: [request.authorId],
      actorId: user.id,
      kind: 'request_converted',
      text: `Your request "${request.name}" became a skill`,
      path: `skills/${skillId}`,
    });

    const skill = await db.skill.findUniqueOrThrow({
      where: { id: skillId },
      include: {
        capability: { select: { name: true, agentId: true } },
        steps: { orderBy: { position: 'asc' } },
        inputs: { orderBy: { position: 'asc' } },
        channels: { orderBy: { channel: { sortOrder: 'asc' } } },
        versions: { orderBy: { number: 'desc' }, take: 1, include: { author: { select: { name: true } } } },
      },
    });
    return skillToDetail(skill);
  }

  async archive(access: WorkspaceAccess, user: AuthUser, requestId: string): Promise<void> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const request = await this.load(db, requestId);
    if (request.authorId !== user.id && !atLeast(access.level, 'editor')) {
      throw new ForbiddenException('Only the author or an editor can remove this request');
    }
    await db.request.update({ where: { id: requestId }, data: { archivedAt: new Date() } });
  }

  /** For other modules: the request, if it exists in this workspace. */
  async load(db: WorkspaceDb, requestId: string): Promise<RequestRow> {
    const request = await db.request.findFirst({
      where: { id: requestId, ...LIVE, agent: LIVE },
      include: DETAIL_INCLUDE,
    });
    if (!request) throw new NotFoundException('Request not found');
    return request as RequestRow;
  }

  assertCanEdit(access: WorkspaceAccess, user: AuthUser, request: { status: RequestDetail['status']; authorId: string }) {
    if (!canEditRequest(request, { id: user.id, isEditor: atLeast(access.level, 'editor') })) {
      throw new ForbiddenException(
        request.status === 'approved' || request.status === 'declined'
          ? 'This request has been decided. Move it back to In review to change it.'
          : 'Only the author or an editor can change this request',
      );
    }
  }
}

export function toDetail(r: RequestRow): RequestDetail {
  return {
    id: r.id,
    agentId: r.agentId,
    name: r.name,
    status: r.status,
    version: r.version,
    trigger: r.trigger,
    ownerRole: r.ownerRole,
    frequency: r.frequency,
    result: r.result,
    rules: r.rules,
    problems: r.problems,
    keepHuman: r.keepHuman,
    author: r.author,
    skillId: r.skill && !r.skill.archivedAt ? r.skillId : null,
    skillName: r.skill && !r.skill.archivedAt ? r.skill.name : null,
    steps: r.steps.map((s) => ({
      id: s.id,
      roleId: s.roleId,
      otherRole: s.otherRole,
      action: s.action,
      place: s.place,
      isApproval: s.isApproval,
      ifNo: s.ifNo,
    })),
    inputs: r.inputs.map((i) => ({ id: i.id, what: i.what, who: i.who })),
    files: r.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      requestInputId: f.requestInputId,
      uploadedBy: f.uploadedBy.name,
      createdAt: f.createdAt.toISOString(),
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
