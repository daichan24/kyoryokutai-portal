-- Add order field to Project model
ALTER TABLE "Project" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add order field to Mission model
ALTER TABLE "Mission" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Create index for ordering
CREATE INDEX "Project_userId_order_idx" ON "Project"("userId", "order");
CREATE INDEX "Mission_userId_order_idx" ON "Mission"("userId", "order");
