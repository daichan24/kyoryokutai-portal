-- マイグレーション後のデータ確認スクリプト
-- 本番環境でマイグレーションを実行した後、このスクリプトを実行してデータが正しく移行されたか確認してください

-- 1. Mission テーブルのデータ数（旧 Goal）
SELECT 'Mission テーブルのデータ数（旧 Goal）' as check_name, COUNT(*) as count FROM "Mission";

-- 2. Request テーブルのデータ数（旧 TaskRequest）
SELECT 'Request テーブルのデータ数（旧 TaskRequest）' as check_name, COUNT(*) as count FROM "Request";

-- 3. Task テーブルのデータ数（旧 ProjectSubGoal から移行）
SELECT 'Task テーブルのデータ数（旧 ProjectSubGoal から移行）' as check_name, COUNT(*) as count FROM "Task";

-- 4. Task で missionId が null の数（あってはならない）
SELECT 
    'Task で missionId が null の数（エラー）' as check_name,
    COUNT(*) as count
FROM "Task"
WHERE "missionId" IS NULL;

-- 5. Project で missionId が null の数
SELECT 
    'Project で missionId が null の数' as check_name,
    COUNT(*) as count
FROM "Project"
WHERE "missionId" IS NULL;

-- 6. MidGoal で missionId が null の数
SELECT 
    'MidGoal で missionId が null の数' as check_name,
    COUNT(*) as count
FROM "MidGoal"
WHERE "missionId" IS NULL;

-- 7. 外部キー制約の確認
SELECT 
    '外部キー制約数' as check_name,
    COUNT(*) as count
FROM pg_constraint
WHERE contype = 'f'
AND conrelid::regclass::text IN ('Mission', 'Request', 'Task', 'Project', 'MidGoal');

-- 8. 列挙型の確認
SELECT 
    '列挙型一覧' as check_name,
    typname as enum_name
FROM pg_type
WHERE typtype = 'e'
AND typname IN ('MissionTypeEnum', 'TaskStatus', 'ApprovalStatus');

-- 9. データ整合性チェック: Mission と Project の関連
SELECT 
    'Mission に紐づく Project の数' as check_name,
    COUNT(DISTINCT p."id") as count
FROM "Project" p
INNER JOIN "Mission" m ON p."missionId" = m."id";

-- 10. データ整合性チェック: Mission と Task の関連
SELECT 
    'Mission に紐づく Task の数' as check_name,
    COUNT(DISTINCT t."id") as count
FROM "Task" t
INNER JOIN "Mission" m ON t."missionId" = m."id";

