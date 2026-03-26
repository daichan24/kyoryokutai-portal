-- CreateTable
CREATE TABLE "ActivityExpenseBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allocatedAmount" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityExpenseBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityExpenseEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spentAt" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityExpenseBudget_userId_key" ON "ActivityExpenseBudget"("userId");

-- CreateIndex
CREATE INDEX "ActivityExpenseEntry_userId_spentAt_idx" ON "ActivityExpenseEntry"("userId", "spentAt");

-- AddForeignKey
ALTER TABLE "ActivityExpenseBudget" ADD CONSTRAINT "ActivityExpenseBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpenseBudget" ADD CONSTRAINT "ActivityExpenseBudget_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpenseEntry" ADD CONSTRAINT "ActivityExpenseEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpenseEntry" ADD CONSTRAINT "ActivityExpenseEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpenseEntry" ADD CONSTRAINT "ActivityExpenseEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
