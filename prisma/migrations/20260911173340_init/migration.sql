-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('emi', 'chitty', 'recurring', 'credit_card');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" "BillType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDay" INTEGER,
    "endOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "installmentsPaid" INTEGER,
    "installmentsTotal" INTEGER,
    "installmentsLeft" INTEGER,
    "lastPaidCycle" TEXT,
    "lastNotifiedCycle" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeSettings" (
    "id" TEXT NOT NULL DEFAULT 'household',
    "userSalary" INTEGER NOT NULL,
    "spouseSalary" INTEGER NOT NULL,

    CONSTRAINT "IncomeSettings_pkey" PRIMARY KEY ("id")
);
