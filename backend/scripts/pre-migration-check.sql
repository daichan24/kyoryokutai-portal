-- マイグレーション前のデータ確認スクリプト
-- 本番環境でマイグレーションを実行する前に、このスクリプトを実行してデータを確認してください

-- 1. Goal テーブルのデータ数
SELECT 'Goal テーブルのデータ数' as check_name, COUNT(*) as count FROM "Goal";

-- 2. TaskRequest テーブルのデータ数
SELECT 'TaskRequest テーブルのデータ数' as check_name, COUNT(*) as count FROM "TaskRequest";

-- 3. ProjectSubGoal テーブルのデータ数
SELECT 'ProjectSubGoal テーブルのデータ数' as check_name, COUNT(*) as count FROM "ProjectSubGoal";

-- 4. ProjectSubGoal に紐づく Project の missionId が null の数
SELECT 
    'ProjectSubGoal で missionId が取得できない数' as check_name,
    COUNT(*) as count
FROM "ProjectSubGoal" psg
LEFT JOIN "Project" p ON psg."projectId" = p."id"
WHERE COALESCE(
    p."missionId",
    (SELECT m."id" FROM "Goal" m WHERE m."userId" = p."userId" ORDER BY m."createdAt" ASC LIMIT 1)
) IS NULL;

-- 5. Project で missionId (goalId) が null の数
SELECT 
    'Project で goalId が null の数' as check_name,
    COUNT(*) as count
FROM "Project"
WHERE "goalId" IS NULL;

-- 6. MidGoal で goalId が null の数
SELECT 
    'MidGoal で goalId が null の数' as check_name,
    COUNT(*) as count
FROM "MidGoal"
WHERE "goalId" IS NULL;

-- 7. 外部キー制約の確認
SELECT 
    '外部キー制約数' as check_name,
    COUNT(*) as count
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text IN ('Goal', 'TaskRequest', 'ProjectSubGoal', 'Project', 'MidGoal');

