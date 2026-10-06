/*
  Warnings:

  - Added the required column `ownerId` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_ticketCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "TicketCategory" DROP CONSTRAINT "TicketCategory_eventId_fkey";

-- DropForeignKey
ALTER TABLE "WaitlistEntry" DROP CONSTRAINT "WaitlistEntry_ticketCategoryId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "ownerId" TEXT;

-- Backfill : donnees de dev/seed uniquement, rattachees au premier compte
-- existant (l'admin seede) avant de rendre la colonne obligatoire.
UPDATE "Event" SET "ownerId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ticketCategoryId_fkey" FOREIGN KEY ("ticketCategoryId") REFERENCES "TicketCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_ticketCategoryId_fkey" FOREIGN KEY ("ticketCategoryId") REFERENCES "TicketCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
