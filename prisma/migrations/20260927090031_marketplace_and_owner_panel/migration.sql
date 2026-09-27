-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "review_note" VARCHAR(1000),
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_reason" VARCHAR(500);

-- CreateIndex
CREATE INDEX "listings_reviewed_by_id_idx" ON "listings"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "users_suspended_at_idx" ON "users"("suspended_at");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
