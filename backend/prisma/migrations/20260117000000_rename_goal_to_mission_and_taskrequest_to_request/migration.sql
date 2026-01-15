-- ========================================
-- 大規模リファクタリング: Goal→Mission, TaskRequest→Request, ProjectSubGoal→Task
-- ========================================

-- Step 1: Goal → Mission のリネーム
-- テーブル名を変更
ALTER TABLE "Goal" RENAME TO "Mission";

-- カラム名を変更
ALTER TABLE "Mission" RENAME COLUMN "goalName" TO "missionName";
ALTER TABLE "Mission" RENAME COLUMN "goalType" TO "missionType";

-- インデックス名を変更
ALTER INDEX IF EXISTS "Goal_userId_idx" RENAME TO "Mission_userId_idx";

-- Step 2: MidGoal の goalId → missionId
ALTER TABLE "MidGoal" RENAME COLUMN "goalId" TO "missionId";
ALTER INDEX IF EXISTS "MidGoal_goalId_idx" RENAME TO "MidGoal_missionId_idx";

-- Step 3: Project の goalId → missionId
ALTER TABLE "Project" RENAME COLUMN "goalId" TO "missionId";
ALTER INDEX IF EXISTS "Project_goalId_idx" RENAME TO "Project_missionId_idx";

-- Step 4: GoalType enum → MissionTypeEnum
-- 既存のenumはそのまま使用し、新しいenum名に変更
ALTER TYPE "GoalType" RENAME TO "MissionTypeEnum";

-- Step 5: TaskRequest → Request のリネーム
ALTER TABLE "TaskRequest" RENAME TO "Request";

-- インデックス名を変更
ALTER INDEX IF EXISTS "TaskRequest_requestedBy_idx" RENAME TO "Request_requestedBy_idx";
ALTER INDEX IF EXISTS "TaskRequest_requestedTo_idx" RENAME TO "Request_requestedTo_idx";
ALTER INDEX IF EXISTS "TaskRequest_approvalStatus_idx" RENAME TO "Request_approvalStatus_idx";

-- Step 6: User のリレーション名変更（TaskRequest → Request）
-- 外部キー制約名を変更
ALTER TABLE "Request" 
  DROP CONSTRAINT IF EXISTS "TaskRequest_requestedBy_fkey",
  DROP CONSTRAINT IF EXISTS "TaskRequest_requestedTo_fkey";

-- 新しいリレーション名で外部キーを再作成
ALTER TABLE "Request"
  ADD CONSTRAINT "Request_requestedBy_fkey" 
    FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Request_requestedTo_fkey" 
    FOREIGN KEY ("requestedTo") REFERENCES "User"("id") ON DELETE CASCADE;

-- Step 7: Project の taskRequests → requests リレーション
-- 外部キー制約名を変更
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskRequest_projectId_fkey'
  ) THEN
    ALTER TABLE "Request" 
      DROP CONSTRAINT "TaskRequest_projectId_fkey";
  END IF;
END $$;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL;

-- Step 8: ProjectTask の taskRequest → request リレーション
-- Request.createdTaskId が ProjectTask.id を参照する外部キー
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskRequest_createdTaskId_fkey'
  ) THEN
    ALTER TABLE "Request" 
      DROP CONSTRAINT "TaskRequest_createdTaskId_fkey";
  END IF;
END $$;

ALTER TABLE "Request"
  ADD CONSTRAINT "Request_createdTaskId_fkey" 
    FOREIGN KEY ("createdTaskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL;

-- Step 9: ProjectSubGoal → Task への移行
-- 新しいTaskテーブルを作成
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- TaskStatus enum を作成
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- ProjectSubGoal のデータを Task に移行
-- 注意: ProjectSubGoal は projectId のみ持っていたが、Task は missionId が必須
-- プロジェクトからミッションを取得して移行
-- missionIdがnullの場合は、ユーザーの最初のミッションを使用、なければスキップ
-- ⚠️ 安全のため、トランザクション内で実行されることを前提としています

-- まず、移行できないデータを確認（ログ用）
DO $$
DECLARE
    unmigratable_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigratable_count
    FROM "ProjectSubGoal" psg
    LEFT JOIN "Project" p ON psg."projectId" = p."id"
    WHERE COALESCE(
        p."missionId",
        (SELECT m."id" FROM "Mission" m WHERE m."userId" = p."userId" ORDER BY m."createdAt" ASC LIMIT 1)
    ) IS NULL;
    
    IF unmigratable_count > 0 THEN
        RAISE NOTICE '警告: % 件のProjectSubGoalが移行できません（missionIdが取得できません）', unmigratable_count;
    END IF;
END $$;

-- データを移行
INSERT INTO "Task" (
    "id",
    "missionId",
    "projectId",
    "title",
    "description",
    "status",
    "order",
    "createdAt",
    "updatedAt"
)
SELECT 
    psg."id",
    COALESCE(
        p."missionId",
        (SELECT m."id" FROM "Mission" m WHERE m."userId" = p."userId" ORDER BY m."createdAt" ASC LIMIT 1)
    ) as "missionId",
    psg."projectId",
    psg."title",
    psg."description",
    CASE 
        WHEN psg."status" = 'NOT_STARTED' THEN 'NOT_STARTED'::"TaskStatus"
        WHEN psg."status" = 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TaskStatus"
        WHEN psg."status" = 'COMPLETED' THEN 'COMPLETED'::"TaskStatus"
        ELSE 'NOT_STARTED'::"TaskStatus"
    END as "status",
    COALESCE(psg."order", 0) as "order",
    COALESCE(psg."createdAt", CURRENT_TIMESTAMP) as "createdAt",
    COALESCE(psg."updatedAt", CURRENT_TIMESTAMP) as "updatedAt"
FROM "ProjectSubGoal" psg
LEFT JOIN "Project" p ON psg."projectId" = p."id"
WHERE COALESCE(
    p."missionId",
    (SELECT m."id" FROM "Mission" m WHERE m."userId" = p."userId" ORDER BY m."createdAt" ASC LIMIT 1)
) IS NOT NULL;

-- 外部キー制約を追加
ALTER TABLE "Task" 
  ADD CONSTRAINT "Task_missionId_fkey" 
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Task_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL;

-- インデックスを作成
CREATE INDEX "Task_missionId_idx" ON "Task"("missionId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_missionId_status_idx" ON "Task"("missionId", "status");

-- ProjectSubGoal テーブルを削除
DROP TABLE "ProjectSubGoal";

-- SubGoalStatus enum を削除（TaskStatus に統合）
DROP TYPE IF EXISTS "SubGoalStatus";

-- Step 10: User のリレーション名変更
-- User テーブルの外部キー制約は自動的に更新されるため、明示的な変更は不要
-- ただし、リレーション名の変更は Prisma のスキーマで管理される

-- Step 11: Mission と Task のリレーションを追加
-- Mission テーブルに tasks リレーションが追加される（既にスキーマに定義済み）

-- Step 12: Project と Task のリレーションを追加
-- Project テーブルに relatedTasks リレーションが追加される（既にスキーマに定義済み）

