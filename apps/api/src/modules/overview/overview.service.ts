import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { atLeast, type Dashboard, type DashboardQuery, type SearchResult } from '@skillflow/shared';
import type { AuthUser, WorkspaceAccess } from '../../common/request';
import { PrismaService } from '../../prisma/prisma.service';

const LIVE = { archivedAt: null } as const;
const OPEN = { in: ['new', 'in_review'] } as Prisma.EnumRequestStatusFilter;
const PER_TYPE = 8;
const LIST = 10;

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(access: WorkspaceAccess, user: AuthUser, query: DashboardQuery): Promise<Dashboard> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const agent = query.agentId ? { id: query.agentId, ...LIVE } : LIVE;
    const liveSkill = { ...LIVE, capability: { ...LIVE, agent } } satisfies Prisma.SkillWhereInput;
    const liveRequest = { ...LIVE, agent } satisfies Prisma.RequestWhereInput;
    const requestSelect = {
      id: true,
      name: true,
      agentId: true,
      status: true,
      updatedAt: true,
      author: { select: { name: true } },
    } satisfies Prisma.RequestSelect;

    const [byStatus, waiting, toReview, mine, skillVersions, requestVersions] = await Promise.all([
      db.skill.groupBy({ by: ['status'], where: liveSkill, _count: { _all: true } }),
      db.signoff.findMany({
        where: { ownerId: user.id, status: 'pending', skill: liveSkill },
        orderBy: { createdAt: 'asc' },
        take: LIST,
        include: {
          requestedBy: { select: { name: true } },
          skill: { select: { name: true, capability: { select: { agentId: true } } } },
        },
      }),
      atLeast(access.level, 'editor')
        ? db.request.findMany({
            where: { ...liveRequest, status: OPEN },
            orderBy: { updatedAt: 'desc' },
            take: LIST,
            select: requestSelect,
          })
        : Promise.resolve([]),
      db.request.findMany({
        where: { ...liveRequest, status: OPEN, authorId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: LIST,
        select: requestSelect,
      }),
      db.skillVersion.findMany({
        where: { skill: liveSkill },
        orderBy: { createdAt: 'desc' },
        take: LIST,
        include: {
          author: { select: { name: true } },
          skill: { select: { name: true, capability: { select: { agentId: true } } } },
        },
      }),
      db.requestVersion.findMany({
        where: { request: liveRequest },
        orderBy: { createdAt: 'desc' },
        take: LIST,
        include: { author: { select: { name: true } }, request: { select: { name: true, agentId: true } } },
      }),
    ]);

    const counts = { draft: 0, defined: 0, in_build: 0, live: 0 };
    for (const row of byStatus) counts[row.status] = row._count._all;

    const toRequest = (r: (typeof mine)[number]) => ({
      id: r.id,
      name: r.name,
      agentId: r.agentId,
      status: r.status,
      author: r.author.name,
      updatedAt: r.updatedAt.toISOString(),
    });

    const recent = [
      ...skillVersions.map((v) => ({
        kind: 'skill' as const,
        id: v.skillId,
        agentId: v.skill.capability.agentId,
        title: v.skill.name,
        note: v.note,
        author: v.author?.name ?? null,
        at: v.createdAt,
      })),
      ...requestVersions.map((v) => ({
        kind: 'request' as const,
        id: v.requestId,
        agentId: v.request.agentId,
        title: v.request.name,
        note: v.note,
        author: v.author?.name ?? null,
        at: v.createdAt,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, LIST)
      .map((item) => ({ ...item, at: item.at.toISOString() }));

    return {
      counts,
      waitingOnMe: waiting.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skillName: s.skill.name,
        agentId: s.skill.capability.agentId,
        askedBy: s.requestedBy.name,
        askedAt: s.createdAt.toISOString(),
      })),
      toReview: toReview.map(toRequest),
      myRequests: mine.map(toRequest),
      recent,
    };
  }

  /** Finds agents, capabilities, skills, steps and requests whose text contains the term. */
  async search(access: WorkspaceAccess, term: string): Promise<SearchResult[]> {
    const db = this.prisma.forWorkspace(access.workspaceId);
    const has = { contains: term, mode: 'insensitive' } as const;
    const liveCapability = { ...LIVE, agent: LIVE };
    const liveSkill = { ...LIVE, capability: liveCapability };
    const agentSelect = { select: { id: true, shortName: true } };

    const [agents, capabilities, skills, steps, requests] = await Promise.all([
      db.agent.findMany({
        where: { ...LIVE, OR: [{ shortName: has }, { fullName: has }, { description: has }] },
        take: PER_TYPE,
        orderBy: { sortOrder: 'asc' },
      }),
      db.capability.findMany({
        where: { ...liveCapability, name: has },
        take: PER_TYPE,
        include: { agent: agentSelect },
      }),
      db.skill.findMany({
        where: { ...liveSkill, OR: [{ name: has }, { trigger: has }, { deliverable: has }] },
        take: PER_TYPE,
        orderBy: { updatedAt: 'desc' },
        include: { capability: { select: { name: true, agent: agentSelect } } },
      }),
      db.skillStep.findMany({
        where: { skill: liveSkill, OR: [{ text: has }, { ifNo: has }] },
        take: PER_TYPE,
        include: { skill: { select: { id: true, name: true, capability: { select: { agent: agentSelect } } } } },
      }),
      db.request.findMany({
        where: { ...LIVE, agent: LIVE, OR: [{ name: has }, { trigger: has }, { result: has }] },
        take: PER_TYPE,
        orderBy: { updatedAt: 'desc' },
        include: { agent: agentSelect },
      }),
    ]);

    return [
      ...agents.map((a) => ({
        type: 'agent' as const,
        id: a.id,
        title: `${a.shortName} · ${a.fullName}`,
        context: 'Agent',
        agentId: a.id,
        skillId: null,
      })),
      ...capabilities.map((c) => ({
        type: 'capability' as const,
        id: c.id,
        title: c.name,
        context: `${c.agent.shortName} · Capability`,
        agentId: c.agent.id,
        skillId: null,
      })),
      ...skills.map((s) => ({
        type: 'skill' as const,
        id: s.id,
        title: s.name,
        context: `${s.capability.agent.shortName} · ${s.capability.name}`,
        agentId: s.capability.agent.id,
        skillId: s.id,
      })),
      ...steps.map((step) => ({
        type: 'step' as const,
        id: step.id,
        title: step.text,
        context: `${step.skill.capability.agent.shortName} · ${step.skill.name}`,
        agentId: step.skill.capability.agent.id,
        skillId: step.skill.id,
      })),
      ...requests.map((r) => ({
        type: 'request' as const,
        id: r.id,
        title: r.name,
        context: `${r.agent.shortName} · Request`,
        agentId: r.agent.id,
        skillId: null,
      })),
    ];
  }
}
