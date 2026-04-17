-- DropTable (CooperationRuleは削除)
DROP TABLE IF EXISTS "CooperationRule";

-- AlterTable (NudgeDocumentに年度フィールドを追加)
-- 既存データがある場合は、2025年度として設定
ALTER TABLE "NudgeDocument" ADD COLUMN "fiscalYear" INTEGER;

-- 既存データに2025年度を設定
UPDATE "NudgeDocument" SET "fiscalYear" = 2025 WHERE "fiscalYear" IS NULL;

-- fiscalYearをNOT NULLに変更
ALTER TABLE "NudgeDocument" ALTER COLUMN "fiscalYear" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NudgeDocument_fiscalYear_key" ON "NudgeDocument"("fiscalYear");
CREATE INDEX "NudgeDocument_fiscalYear_idx" ON "NudgeDocument"("fiscalYear");
