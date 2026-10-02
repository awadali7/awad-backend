-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('emi', 'income', 'expense');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_kind_idx" ON "Category"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Category_kind_name_key" ON "Category"("kind", "name");

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "cycle" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_cycle_idx" ON "Expense"("cycle");

-- AlterTable
ALTER TABLE "IncomeSource" ADD COLUMN "category" TEXT;

-- Seed the EMI vocabulary from the categories already in use on Bill, so the
-- Settings screen opens populated instead of empty and existing bills keep
-- matching a known category.
INSERT INTO "Category" ("id", "kind", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'emi'::"CategoryKind", DISTINCT_CATEGORY, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" AS DISTINCT_CATEGORY FROM "Bill" WHERE "category" <> '') AS used;
