-- CreateEnum
CREATE TYPE "skill_status" AS ENUM ('draft', 'defined', 'in_build', 'live');

-- CreateEnum
CREATE TYPE "input_need" AS ENUM ('automatic', 'required');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "short_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "capability_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "skill_status" NOT NULL DEFAULT 'draft',
    "started_by_role_id" UUID,
    "trigger" TEXT NOT NULL DEFAULT '',
    "deliverable" TEXT NOT NULL DEFAULT '',
    "human_control" TEXT NOT NULL DEFAULT '',
    "runs_alongside" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_steps" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "role_id" UUID,
    "text" TEXT NOT NULL,
    "is_approval" BOOLEAN NOT NULL DEFAULT false,
    "if_no" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "skill_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_inputs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "need" "input_need" NOT NULL,

    CONSTRAINT "skill_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_channels" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "usage" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "skill_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_workspace_id_name_key" ON "roles"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspace_id_name_key" ON "channels"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "agents_workspace_id_idx" ON "agents"("workspace_id");

-- CreateIndex
CREATE INDEX "capabilities_agent_id_idx" ON "capabilities"("agent_id");

-- CreateIndex
CREATE INDEX "skills_capability_id_idx" ON "skills"("capability_id");

-- CreateIndex
CREATE INDEX "skill_steps_skill_id_position_idx" ON "skill_steps"("skill_id", "position");

-- CreateIndex
CREATE INDEX "skill_inputs_skill_id_position_idx" ON "skill_inputs"("skill_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "skill_channels_skill_id_channel_id_key" ON "skill_channels"("skill_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_versions_skill_id_number_key" ON "skill_versions"("skill_id", "number");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_started_by_role_id_fkey" FOREIGN KEY ("started_by_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_steps" ADD CONSTRAINT "skill_steps_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_steps" ADD CONSTRAINT "skill_steps_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_steps" ADD CONSTRAINT "skill_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_inputs" ADD CONSTRAINT "skill_inputs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_inputs" ADD CONSTRAINT "skill_inputs_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_channels" ADD CONSTRAINT "skill_channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_channels" ADD CONSTRAINT "skill_channels_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_channels" ADD CONSTRAINT "skill_channels_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ------------------------------------------------------------------ Hand-written

-- Starting roles and channels for workspaces created before this migration.
-- New workspaces get the same lists from WorkspacesService (DEFAULT_ROLES, DEFAULT_CHANNELS).
INSERT INTO "roles" ("id", "workspace_id", "name", "sort_order", "updated_at")
SELECT gen_random_uuid(), w."id", r."name", r."ord", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
  ('Line manager', 0), ('Team lead', 1), ('Department manager', 2),
  ('People team', 3), ('Finance', 4), ('Customer', 5)
) AS r("name", "ord")
ON CONFLICT ("workspace_id", "name") DO NOTHING;

INSERT INTO "channels" ("id", "workspace_id", "name", "sort_order", "updated_at")
SELECT gen_random_uuid(), w."id", c."name", c."ord", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES ('Email', 0), ('Slack', 1), ('Microsoft Teams', 2), ('In-app', 3)) AS c("name", "ord")
ON CONFLICT ("workspace_id", "name") DO NOTHING;
