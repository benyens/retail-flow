-- Varias listas NORMAL (una por tipo de local) y lista asignada a cada sucursal.
DROP INDEX IF EXISTS "price_lists_type_key";
ALTER TABLE "price_lists" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
UPDATE "price_lists" SET "isDefault" = true WHERE "type" = 'NORMAL';
ALTER TABLE "branches" ADD COLUMN "priceListId" TEXT;
ALTER TABLE "branches" ADD CONSTRAINT "branches_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "branches_priceListId_idx" ON "branches"("priceListId");
