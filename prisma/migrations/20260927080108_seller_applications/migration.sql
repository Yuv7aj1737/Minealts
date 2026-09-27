-- CreateEnum
CREATE TYPE "SellerApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "seller_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "discord_id" TEXT NOT NULL,
    "discord_username" TEXT NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "what_to_sell" VARCHAR(2000) NOT NULL,
    "extra_info" VARCHAR(2000),
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_applications_user_id_idx" ON "seller_applications"("user_id");

-- CreateIndex
CREATE INDEX "seller_applications_status_idx" ON "seller_applications"("status");

-- CreateIndex
CREATE INDEX "seller_applications_created_at_idx" ON "seller_applications"("created_at");

-- CreateIndex
CREATE INDEX "seller_applications_reviewed_by_id_idx" ON "seller_applications"("reviewed_by_id");

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: at most one PENDING application per user.
--
-- This is the database-level half of "a user cannot hold two active
-- applications". The application layer checks for an existing PENDING row
-- first, but only this index can close the race where two requests for the
-- same account are submitted concurrently and both pass that check.
--
-- Deliberately scoped to PENDING only, so a member who was rejected may apply
-- again and every decision remains on record.
CREATE UNIQUE INDEX "seller_applications_one_pending_per_user"
    ON "seller_applications" ("user_id")
    WHERE "status" = 'PENDING';
