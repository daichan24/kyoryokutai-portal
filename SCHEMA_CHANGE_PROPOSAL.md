# スキーマ変更提案

## 現状の問題

現在のスキーマでは、Task が Mission 配下にあり、Project は任意で紐づいています：

```prisma
model Task {
  missionId String  // 必須
  projectId String? // 任意
  mission   Mission @relation(...)
  project   Project? @relation(...)
}
```

これにより、以下の問題が発生しています：

1. **Task一覧ページの実装が複雑**: Project経由でTaskを取得する必要がある
2. **要件との不一致**: 要件では「Task は Project に必須で紐づく、Mission と Task は直接紐づけない」
3. **パフォーマンスの問題**: Task一覧を取得する際に、全Projectを取得してからTaskを集約する必要がある

## 提案するスキーマ変更

### 変更内容

```prisma
model Task {
  id        String  @id @default(uuid())
  projectId String  // 必須（Project に必須で紐づく）
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // missionId を削除（Mission と Task は直接紐づけない）

  title       String
  description String?    @db.Text
  status      TaskStatus @default(NOT_STARTED)
  order       Int        @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([projectId, status])
}
```

### Project モデルの変更

```prisma
model Project {
  // ... 既存のフィールド ...
  
  relatedTasks Task[] // このプロジェクトに関連するタスク（必須）
  
  // ... 既存のリレーション ...
}
```

### Mission モデルの変更

```prisma
model Mission {
  // ... 既存のフィールド ...
  
  // tasks リレーションを削除（Mission と Task は直接紐づけない）
  
  // ... 既存のリレーション ...
}
```

## マイグレーション方針

### ステップ1: 既存データの移行

1. 既存のTaskで`projectId`がnullの場合、`missionId`から推測
   - Projectの`missionId`がTaskの`missionId`と一致するProjectを探す
   - 見つからない場合は、そのMissionに紐づく最初のProjectを使用

2. それでも`projectId`がnullのTaskは削除するか、デフォルトのProjectに紐づける

### ステップ2: スキーマ変更

1. `projectId`を必須にする
2. `missionId`を削除
3. 外部キー制約を更新

### マイグレーションファイル例

```sql
-- Step 1: 既存データの移行
UPDATE "Task" t
SET "projectId" = (
  SELECT p."id"
  FROM "Project" p
  WHERE p."missionId" = t."missionId"
  ORDER BY p."createdAt" ASC
  LIMIT 1
)
WHERE t."projectId" IS NULL
  AND t."missionId" IS NOT NULL;

-- Step 2: projectId を必須にする
ALTER TABLE "Task" ALTER COLUMN "projectId" SET NOT NULL;

-- Step 3: missionId を削除
ALTER TABLE "Task" DROP COLUMN "missionId";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_missionId_fkey";
DROP INDEX IF EXISTS "Task_missionId_idx";
DROP INDEX IF EXISTS "Task_missionId_status_idx";
```

## API変更

### Task API の変更

現在: `/api/missions/:missionId/tasks`
提案: `/api/projects/:projectId/tasks`

### エンドポイント

- `GET /api/projects/:projectId/tasks` - プロジェクトのタスク一覧
- `POST /api/projects/:projectId/tasks` - タスク作成（projectId必須）
- `PUT /api/projects/:projectId/tasks/:id` - タスク更新
- `DELETE /api/projects/:projectId/tasks/:id` - タスク削除

### Task一覧取得の改善

現在: 全Projectを取得してからTaskを集約
提案: `/api/tasks` エンドポイントを追加（全タスク一覧、フィルタ可能）

```typescript
GET /api/tasks?projectId=xxx&status=IN_PROGRESS&sortBy=deadline
```

## 実装の利点

1. **要件との一致**: Task は Project に必須で紐づき、Mission と直接紐づかない
2. **パフォーマンス向上**: Task一覧を直接取得可能
3. **実装の簡素化**: Task一覧ページの実装が簡単になる
4. **データ整合性**: Project が削除されると、関連するTaskも自動的に削除される

## 実装順序

1. マイグレーションファイルの作成
2. バックエンドAPIの修正
3. フロントエンドの修正（Task一覧ページ、TaskModal等）
4. 動作確認

