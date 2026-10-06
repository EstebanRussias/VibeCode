-- Roles : ADMIN (organisateur) -> ORGANIZER, SUPERADMIN -> ADMIN.
-- RENAME VALUE conserve le role des comptes existants (pas de perte de donnees).
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'ORGANIZER';
ALTER TYPE "Role" RENAME VALUE 'SUPERADMIN' TO 'ADMIN';

-- Nom affiche (differencie les organisateurs) : backfill depuis l'email.
ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
UPDATE "User" SET "name" = split_part("email", '@', 1) WHERE "name" = '';
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;

-- Prix (centimes) et tarif early par categorie.
ALTER TABLE "TicketCategory" ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "earlyPriceCents" INTEGER,
ADD COLUMN "earlyUntil" TIMESTAMP(3);

-- Prix fige sur chaque billet, pour que les recettes ne bougent pas si le
-- tarif de la categorie change apres coup.
ALTER TABLE "Reservation" ADD COLUMN "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isEarly" BOOLEAN NOT NULL DEFAULT false;

-- Vue des recettes par categorie de concert. Seuls les billets CONFIRMED
-- comptent : HELD (offre liste d'attente non confirmee), CANCELLED et
-- EXPIRED ne sont pas des ventes.
CREATE VIEW "CategoryRevenue" AS
SELECT
  e."id"                AS "eventId",
  e."name"              AS "eventName",
  e."ownerId"           AS "ownerId",
  c."id"                AS "categoryId",
  c."name"              AS "categoryName",
  c."totalPlaces"       AS "totalPlaces",
  c."placesDisponibles" AS "placesDisponibles",
  c."priceCents"        AS "priceCents",
  c."earlyPriceCents"   AS "earlyPriceCents",
  COALESCE(SUM(r."quantity") FILTER (WHERE r."status" = 'CONFIRMED'), 0)::bigint
    AS "ticketsSold",
  COALESCE(SUM(r."quantity") FILTER (WHERE r."status" = 'CONFIRMED' AND r."isEarly"), 0)::bigint
    AS "earlyTicketsSold",
  COALESCE(SUM(r."quantity") FILTER (WHERE r."status" = 'CONFIRMED' AND r."scannedAt" IS NOT NULL), 0)::bigint
    AS "ticketsScanned",
  COALESCE(SUM(r."quantity" * r."unitPriceCents") FILTER (WHERE r."status" = 'CONFIRMED'), 0)::bigint
    AS "revenueCents"
FROM "TicketCategory" c
JOIN "Event" e ON e."id" = c."eventId"
LEFT JOIN "Reservation" r ON r."ticketCategoryId" = c."id"
GROUP BY e."id", c."id";
