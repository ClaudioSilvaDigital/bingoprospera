-- Round table
CREATE TABLE "Round" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "rule" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3)
);
CREATE INDEX "Round_sessionId_isActive_idx" ON "Round"("sessionId","isActive");
CREATE UNIQUE INDEX "Round_sessionId_number_key" ON "Round"("sessionId","number");

-- Extend Claim with round info
ALTER TABLE "Claim" 
  ADD COLUMN "roundNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "roundRule"   TEXT    NOT NULL DEFAULT '1-linha';
