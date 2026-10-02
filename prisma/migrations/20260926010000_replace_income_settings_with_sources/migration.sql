-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "cycle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeSource_cycle_idx" ON "IncomeSource"("cycle");

-- Carry the two fixed salaries over as permanent sources (cycle NULL) before
-- the old single-row table goes away. Zero-valued salaries are skipped rather
-- than imported as empty rows.
INSERT INTO "IncomeSource" ("id", "label", "amount", "cycle", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'My salary', "userSalary", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "IncomeSettings"
WHERE "userSalary" > 0;

INSERT INTO "IncomeSource" ("id", "label", "amount", "cycle", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Spouse salary', "spouseSalary", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "IncomeSettings"
WHERE "spouseSalary" > 0;

-- DropTable
DROP TABLE "IncomeSettings";
