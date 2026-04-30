# 協力隊業務・役場業務が面談ページに表示されない問題のトラブルシューティング

## 現状確認

### ✅ 完了済み
1. **デフォルトプロジェクト作成**: 全13名のメンバーに「協力隊業務」と「役場業務」のミッション・プロジェクトを作成済み
2. **バックエンド修正**: 期間フィルタリングを削除し、全プロジェクトを返すように修正済み
3. **フロントエンド修正**: `projectsKpi` から全プロジェクトを表示するように実装済み
4. **デバッグログ追加**: バックエンドとフロントエンドにコンソールログを追加

### 🔍 確認方法

#### 1. データベース確認
```bash
cd backend
npm run verify-default-projects
```

このコマンドで全メンバーに「協力隊業務」と「役場業務」のプロジェクトが存在することを確認できます。

#### 2. API レスポンス確認
```bash
cd backend
npm run test-api-response
```

このコマンドで API が正しく `projectsKpi` にデフォルトプロジェクトを含めて返していることを確認できます。

#### 3. ブラウザでの確認手順

1. **ブラウザのキャッシュをクリア**
   - Chrome: Cmd+Shift+Delete (Mac) / Ctrl+Shift+Delete (Windows)
   - 「キャッシュされた画像とファイル」を選択してクリア

2. **ハードリロード**
   - Chrome: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

3. **開発者ツールでコンソールを確認**
   - Chrome: Cmd+Option+J (Mac) / Ctrl+Shift+J (Windows)
   - 面談ページを開いて、以下のログを確認:
     ```
     🔍 [API Response] projectsKpi: [...]
     🔍 [API Response] projectsKpi.length: 2
     🔍 [InterviewMonthlySchedules] projectsKpi: [...]
     🔍 [InterviewMonthlySchedules] projectsKpi.length: 2
     🔍 [InterviewMonthlySchedules] allProjects: [...]
     ```

4. **ネットワークタブで API レスポンスを確認**
   - 開発者ツールの「Network」タブを開く
   - 面談ページを開く
   - `for-interview-month` というリクエストを探す
   - レスポンスの `projectsKpi` フィールドに「協力隊業務」と「役場業務」が含まれているか確認

## 考えられる原因と対策

### 原因1: ブラウザキャッシュ
**対策**: ブラウザのキャッシュをクリアしてハードリロード

### 原因2: React Query のキャッシュ
**対策**: 
- ブラウザの開発者ツールで `localStorage.clear()` を実行
- ページをリロード

### 原因3: バックエンドが再起動されていない
**対策**:
```bash
cd backend
npm run dev
```

### 原因4: フロントエンドが再ビルドされていない
**対策**:
```bash
cd frontend
npm run build
```

### 原因5: データベース接続の問題
**対策**:
```bash
cd backend
npm run verify-default-projects
```
でデータが存在することを確認

## デバッグログの見方

### バックエンドログ (ターミナル)
```
[Interview API] userId: 64b1a34f-969c-43d9-8499-3be5f7b9de93, month: 2026-04
[Interview API] allProjects.length: 2
[Interview API] projectsKpi.length: 2
[Interview API] projectsKpi: [
  { id: '58b51c52-484e-450d-b695-de830820d453', name: '協力隊業務' },
  { id: '3f0e0345-b93a-4d86-ac1d-dadcac03dd1e', name: '役場業務' }
]
```

### フロントエンドログ (ブラウザコンソール)
```
🔍 [API Response] projectsKpi: Array(2)
  0: {id: '58b51c52-...', projectName: '協力隊業務', ...}
  1: {id: '3f0e0345-...', projectName: '役場業務', ...}
🔍 [API Response] projectsKpi.length: 2
🔍 [InterviewMonthlySchedules] projectsKpi: Array(2)
🔍 [InterviewMonthlySchedules] projectsKpi.length: 2
🔍 [InterviewMonthlySchedules] allProjects: Array(2)
  0: {id: '58b51c52-...', name: '協力隊業務', color: '#3B82F6'}
  1: {id: '3f0e0345-...', name: '役場業務', color: '#10B981'}
```

## 実装の詳細

### バックエンド
- **ファイル**: `backend/src/routes/schedules.ts`
- **エンドポイント**: `GET /api/schedules/for-interview-month`
- **クエリ**: 
  ```typescript
  const allProjects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    include: {
      tasks: true,
      relatedTasks: { select: { id: true, title: true, status: true } },
      mission: { select: { id: true, missionName: true } },
    },
  });
  ```
- **期間フィルタリング**: 削除済み（全プロジェクトを返す）

### フロントエンド
- **ファイル**: `frontend/src/pages/InterviewMonthlySchedules.tsx`
- **表示ロジック**: 
  ```typescript
  const allProjects = projectsKpi.map(p => ({
    id: p.id,
    name: p.projectName,
    color: p.themeColor || '#6366f1',
  }));
  ```
- **表示**: 全プロジェクトを表示し、スケジュールがない場合は「この月は実行されませんでした」と表示

## 次のステップ

1. ブラウザのキャッシュをクリアしてハードリロード
2. 開発者ツールのコンソールでログを確認
3. ログが表示されない場合は、バックエンドとフロントエンドを再起動
4. それでも表示されない場合は、ネットワークタブで API レスポンスを確認
5. API レスポンスに `projectsKpi` が含まれていない場合は、バックエンドのログを確認

## デバッグログの削除

問題が解決したら、以下のファイルからデバッグログを削除してください:

1. `backend/src/routes/schedules.ts` (line 223-226)
2. `frontend/src/pages/InterviewMonthlySchedules.tsx` (line 211-213, 667-672)
