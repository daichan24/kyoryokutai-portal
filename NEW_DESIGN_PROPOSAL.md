# 新設計提案とマイグレーション方針

## 📋 現在の状態

### 現在のモデル構造
- **Mission** (旧 Goal): ミッション（大目標）
- **Project**: プロジェクト（中目標）、missionId は任意
- **Task**: タスク（小目標）、missionId 必須、projectId 任意
- **Request** (旧 TaskRequest): 依頼

### 問題点
1. Task が Mission 配下で Project と並列になっている
2. 新しい要件では **Project 1 - N Task** の階層が必要
3. SNSPost.postedAt に null データが存在（P2032 エラー）

## 🎯 新しい設計

### 目標構造
```
Mission (大目標)
  └─ Project (中目標)
      └─ Task (小目標)  ← 必須で Project に紐づく
```

### モデル変更方針

#### Task モデルの変更
- **変更前**: `missionId` 必須、`projectId` 任意
- **変更後**: `projectId` 必須、`missionId` は削除（Project から取得可能）

#### リレーション
- Project 1 - N Task（必須）
- Task は Project を通じて Mission にアクセス

## 🔄 安全な段階的マイグレーション方針

### フェーズ1: SNSPost.postedAt の修正（最優先）

**目的**: P2032 エラーを解消

**手順**:
1. `postedAt` を nullable に一時的に変更
2. 既存の null データにデフォルト値を設定（week から推測）
3. `postedAt` を必須に戻す

### フェーズ2: Task モデルの変更

**目的**: Project 1 - N Task の階層構造に変更

**手順**:
1. Task に `projectId` を必須にする（既存は任意）
2. 既存の Task データを移行
   - `missionId` のみの Task → 関連する Project を探して紐づけ
   - Project が見つからない場合は、Mission の最初の Project を使用
3. `missionId` カラムを削除
4. 外部キー制約を更新

### フェーズ3: 既存データの移行

**GoalTask → Task の移行**（既存の階層構造から）
- GoalTask は SubGoal → MidGoal → Mission の階層
- これを Project → Task に移行する必要がある
- 移行戦略を検討

## 📝 マイグレーション戦略

### 安全な移行の原則
1. **段階的実行**: 一度にすべてを変更しない
2. **データ保持**: 古いデータは削除せず、新しい構造にコピー
3. **後方互換性**: 可能な限り既存APIを維持
4. **ロールバック可能**: 各ステップでロールバック可能にする

### 推奨マイグレーション順序

#### Step 1: SNSPost.postedAt 修正
```sql
-- 1. postedAt を nullable に変更（既に nullable の場合はスキップ）
ALTER TABLE "SNSPost" ALTER COLUMN "postedAt" DROP NOT NULL;

-- 2. null データにデフォルト値を設定（week から推測）
UPDATE "SNSPost"
SET "postedAt" = (
  SELECT date_trunc('week', CURRENT_DATE) + (week::text || ' weeks')::interval
  FROM generate_series(0, 52) AS week
  WHERE week::text = substring("SNSPost"."week" FROM 6)
)
WHERE "postedAt" IS NULL;

-- 3. postedAt を必須に戻す
ALTER TABLE "SNSPost" ALTER COLUMN "postedAt" SET NOT NULL;
```

#### Step 2: Task モデルの変更準備
```sql
-- 1. projectId を必須にする準備（既存の null を処理）
-- まず、missionId から projectId を推測して設定
UPDATE "Task" t
SET "projectId" = (
  SELECT p."id"
  FROM "Project" p
  WHERE p."missionId" = t."missionId"
  ORDER BY p."createdAt" ASC
  LIMIT 1
)
WHERE t."projectId" IS NULL AND t."missionId" IS NOT NULL;

-- 2. projectId が null の Task を削除（または別の処理）
-- 注意: データ損失を避けるため、慎重に判断
```

#### Step 3: Task モデルの変更
```sql
-- 1. projectId を必須にする
ALTER TABLE "Task" ALTER COLUMN "projectId" SET NOT NULL;

-- 2. missionId カラムを削除（外部キー制約を先に削除）
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_missionId_fkey";
ALTER TABLE "Task" DROP COLUMN "missionId";
DROP INDEX IF EXISTS "Task_missionId_idx";
```

## ⚠️ 注意事項

### データ移行の考慮事項
1. **既存の Task データ**: missionId のみの Task を Project に紐づける必要がある
2. **Project がない場合**: Mission に Project がない場合の処理が必要
3. **GoalTask の移行**: 既存の GoalTask を Task に移行する必要があるか検討

### リスク軽減策
1. **バックアップ**: 各フェーズ前に必ずバックアップ
2. **テスト環境**: 本番前にテスト環境で完全にテスト
3. **段階的ロールアウト**: 可能であれば段階的に適用

## 🔍 確認事項

### 既存データの確認クエリ
```sql
-- SNSPost の null データ数
SELECT COUNT(*) FROM "SNSPost" WHERE "postedAt" IS NULL;

-- Task の projectId が null の数
SELECT COUNT(*) FROM "Task" WHERE "projectId" IS NULL;

-- Task の missionId のみで projectId がない数
SELECT COUNT(*) FROM "Task" 
WHERE "projectId" IS NULL AND "missionId" IS NOT NULL;

-- Mission に Project がない数
SELECT COUNT(*) FROM "Mission" m
WHERE NOT EXISTS (SELECT 1 FROM "Project" p WHERE p."missionId" = m."id");
```

## 📊 移行後の構造

### 新しい階層
```
Mission
  ├─ Project 1
  │   ├─ Task 1-1
  │   ├─ Task 1-2
  │   └─ Task 1-3
  ├─ Project 2
  │   ├─ Task 2-1
  │   └─ Task 2-2
  └─ Project 3
      └─ Task 3-1
```

### API エンドポイント
- `GET /api/missions` - ミッション一覧
- `GET /api/missions/:missionId/projects` - プロジェクト一覧
- `GET /api/projects/:projectId/tasks` - タスク一覧
- `POST /api/projects/:projectId/tasks` - タスク作成

