-- CreateTable
CREATE TABLE "Borrowing" (
    "id" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "repaidOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Borrowing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Borrowing_repaidOn_dueDate_idx" ON "Borrowing"("repaidOn", "dueDate");
