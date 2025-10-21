CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "marks" JSONB NOT NULL,
    "clientHasBingo" BOOLEAN NOT NULL,
    "serverCheck" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Claim_sessionId_idx" ON "Claim"("sessionId");
CREATE INDEX "Claim_declaredAt_idx" ON "Claim"("declaredAt");