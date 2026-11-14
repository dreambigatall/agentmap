import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Models that belong to a workspace. Every table added later with a workspace_id goes here. */
const WORKSPACE_MODELS = new Set<string>([Prisma.ModelName.Membership, Prisma.ModelName.Invite]);

const FILTERED_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

/**
 * The single database client for the API.
 * It connects on the first query rather than at startup, so the API can
 * start and report "database down" on /api/health when Postgres is unreachable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * A client that can only see and write rows of one workspace.
   * It adds workspace_id to every filter and every new row of workspace-owned
   * models, so a query that forgets the filter still cannot cross workspaces.
   * Services working inside a workspace must use this, not the plain client.
   */
  forWorkspace(workspaceId: string) {
    return this.$extends({
      name: 'workspace-scope',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!WORKSPACE_MODELS.has(model)) return query(args);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scoped: any = { ...(args ?? {}) };
            if (FILTERED_OPERATIONS.has(operation)) {
              scoped.where = { ...(scoped.where ?? {}), workspaceId };
            }
            if (operation === 'create') {
              scoped.data = { ...scoped.data, workspaceId };
            }
            if (operation === 'createMany' || operation === 'createManyAndReturn') {
              const rows = Array.isArray(scoped.data) ? scoped.data : [scoped.data];
              scoped.data = rows.map((row: object) => ({ ...row, workspaceId }));
            }
            if (operation === 'upsert') {
              scoped.create = { ...scoped.create, workspaceId };
            }
            if ((operation === 'update' || operation === 'updateMany') && scoped.data) {
              // A row can never be moved to another workspace.
              const { workspaceId: _ignored, ...rest } = scoped.data;
              scoped.data = rest;
            }
            return query(scoped);
          },
        },
      },
    });
  }
}

export type WorkspaceDb = ReturnType<PrismaService['forWorkspace']>;
