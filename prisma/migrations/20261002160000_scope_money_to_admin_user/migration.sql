-- Give every money record an owner.
--
-- Added nullable first, backfilled to the existing admin, then made NOT NULL:
-- adding it as NOT NULL outright would fail on the rows already there, and
-- defaulting it would silently hand someone else's data to whoever sorts first.
ALTER TABLE "Bill"         ADD COLUMN "adminUserId" TEXT;
ALTER TABLE "IncomeSource" ADD COLUMN "adminUserId" TEXT;
ALTER TABLE "Expense"      ADD COLUMN "adminUserId" TEXT;
ALTER TABLE "Borrowing"    ADD COLUMN "adminUserId" TEXT;

-- Everything that exists today belongs to the first admin account created.
UPDATE "Bill"         SET "adminUserId" = (SELECT "id" FROM "AdminUser" ORDER BY "createdAt" ASC LIMIT 1) WHERE "adminUserId" IS NULL;
UPDATE "IncomeSource" SET "adminUserId" = (SELECT "id" FROM "AdminUser" ORDER BY "createdAt" ASC LIMIT 1) WHERE "adminUserId" IS NULL;
UPDATE "Expense"      SET "adminUserId" = (SELECT "id" FROM "AdminUser" ORDER BY "createdAt" ASC LIMIT 1) WHERE "adminUserId" IS NULL;
UPDATE "Borrowing"    SET "adminUserId" = (SELECT "id" FROM "AdminUser" ORDER BY "createdAt" ASC LIMIT 1) WHERE "adminUserId" IS NULL;

-- Any row still unowned here means there was no admin to attach it to; deleting
-- is wrong, so fail loudly instead and let a human look.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Bill" WHERE "adminUserId" IS NULL)
     OR EXISTS (SELECT 1 FROM "IncomeSource" WHERE "adminUserId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Expense" WHERE "adminUserId" IS NULL)
     OR EXISTS (SELECT 1 FROM "Borrowing" WHERE "adminUserId" IS NULL) THEN
    RAISE EXCEPTION 'Money rows exist with no AdminUser to own them — create an admin account first';
  END IF;
END $$;

ALTER TABLE "Bill"         ALTER COLUMN "adminUserId" SET NOT NULL;
ALTER TABLE "IncomeSource" ALTER COLUMN "adminUserId" SET NOT NULL;
ALTER TABLE "Expense"      ALTER COLUMN "adminUserId" SET NOT NULL;
ALTER TABLE "Borrowing"    ALTER COLUMN "adminUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Bill_adminUserId_idx"         ON "Bill"("adminUserId");
CREATE INDEX "IncomeSource_adminUserId_idx" ON "IncomeSource"("adminUserId");
CREATE INDEX "Expense_adminUserId_idx"      ON "Expense"("adminUserId");
CREATE INDEX "Borrowing_adminUserId_idx"    ON "Borrowing"("adminUserId");

-- AddForeignKey
ALTER TABLE "Bill"         ADD CONSTRAINT "Bill_adminUserId_fkey"         FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense"      ADD CONSTRAINT "Expense_adminUserId_fkey"      FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Borrowing"    ADD CONSTRAINT "Borrowing_adminUserId_fkey"    FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
