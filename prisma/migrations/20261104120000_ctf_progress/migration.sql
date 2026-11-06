-- CreateTable
CREATE TABLE "CtfProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "levelSlug" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CtfProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CtfProgress_userId_levelSlug_key" ON "CtfProgress"("userId", "levelSlug");

-- CreateIndex
CREATE INDEX "CtfProgress_userId_solved_idx" ON "CtfProgress"("userId", "solved");

-- AddForeignKey
ALTER TABLE "CtfProgress" ADD CONSTRAINT "CtfProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
