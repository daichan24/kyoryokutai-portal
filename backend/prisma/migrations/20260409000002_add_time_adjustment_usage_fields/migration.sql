-- AlterTable: TimeAdjustment に使用記録フィールド追加
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TimeAdjustment' AND column_name='usedAt') THEN
    ALTER TABLE "TimeAdjustment" ADD COLUMN "usedAt" DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TimeAdjustment' AND column_name='usedStartTime') THEN
    ALTER TABLE "TimeAdjustment" ADD COLUMN "usedStartTime" VARCHAR(5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TimeAdjustment' AND column_name='usedEndTime') THEN
    ALTER TABLE "TimeAdjustment" ADD COLUMN "usedEndTime" VARCHAR(5);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TimeAdjustment' AND column_name='usedScheduleId') THEN
    ALTER TABLE "TimeAdjustment" ADD COLUMN "usedScheduleId" TEXT;
  END IF;
END $$;

-- AddForeignKey (制約が既に存在する場合はスキップ)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TimeAdjustment_usedScheduleId_fkey') THEN
    ALTER TABLE "TimeAdjustment" ADD CONSTRAINT "TimeAdjustment_usedScheduleId_fkey" FOREIGN KEY ("usedScheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;