-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('new', 'in_review', 'approved', 'declined');

-- CreateEnum
CREATE TYPE "request_frequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'when_needed');

-- CreateEnum
CREATE TYPE "comment_target" AS ENUM ('skill', 'request');

-- CreateEnum
CREATE TYPE "signoff_status" AS ENUM ('pending', 'approved', 'changes_asked', 'cancelled', 'outdated');

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'new',
    "trigger" TEXT NOT NULL DEFAULT '',
    "owner_role" TEXT NOT NULL DEFAULT '',
    "frequency" "request_frequency",
    "result" TEXT NOT NULL DEFAULT '',
    "rules" TEXT NOT NULL DEFAULT '',
    "problems" TEXT NOT NULL DEFAULT '',
    "keep_human" TEXT NOT NULL DEFAULT '',
    "author_id" UUID NOT NULL,
    "skill_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_steps" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "role_id" UUID,
    "other_role" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "place" TEXT NOT NULL DEFAULT '',
    "is_approval" BOOLEAN NOT NULL DEFAULT false,
    "if_no" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "request_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_inputs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "what" TEXT NOT NULL,
    "who" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "request_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_versions" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "author_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "request_input_id" UUID,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "target_type" "comment_target" NOT NULL,
    "target_id" UUID NOT NULL,
    "step_id" UUID,
    "body" TEXT NOT NULL,
    "mentioned_user_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "author_id" UUID NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_id" UUID,
    "edited_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signoffs" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "skill_version" INTEGER NOT NULL,
    "status" "signoff_status" NOT NULL DEFAULT 'pending',
    "requested_by_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "actor_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requests_agent_id_idx" ON "requests"("agent_id");

-- CreateIndex
CREATE INDEX "request_steps_request_id_position_idx" ON "request_steps"("request_id", "position");

-- CreateIndex
CREATE INDEX "request_inputs_request_id_position_idx" ON "request_inputs"("request_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "request_versions_request_id_number_key" ON "request_versions"("request_id", "number");

-- CreateIndex
CREATE INDEX "files_request_id_idx" ON "files"("request_id");

-- CreateIndex
CREATE INDEX "files_workspace_id_idx" ON "files"("workspace_id");

-- CreateIndex
CREATE INDEX "comments_target_type_target_id_idx" ON "comments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "signoffs_skill_id_idx" ON "signoffs"("skill_id");

-- CreateIndex
CREATE INDEX "signoffs_owner_id_status_idx" ON "signoffs"("owner_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_created_at_idx" ON "notifications"("user_id", "workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_steps" ADD CONSTRAINT "request_steps_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_steps" ADD CONSTRAINT "request_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_steps" ADD CONSTRAINT "request_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_inputs" ADD CONSTRAINT "request_inputs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_inputs" ADD CONSTRAINT "request_inputs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_versions" ADD CONSTRAINT "request_versions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_versions" ADD CONSTRAINT "request_versions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_versions" ADD CONSTRAINT "request_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_request_input_id_fkey" FOREIGN KEY ("request_input_id") REFERENCES "request_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

