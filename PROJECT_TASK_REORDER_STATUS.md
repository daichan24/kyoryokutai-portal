# プロジェクト・ミッション・タスク順番入れ替え機能 実装状況

## 完了した項目

### 1. プロジェクトページ (Projects.tsx) ✅
- **実装完了**: ドラッグ&ドロップ機能
- **対応表示**: カード表示・リスト表示両方
- **対応役職**: 全役職（MASTER/SUPPORT/GOVERNMENT/MEMBER）
- **対応モード**: viewMode・createMode両方
- **バックエンド**: `/api/projects/:id/reorder-to` エンドポイント実装済み
- **フロントエンド**: react-beautiful-dnd使用、GripVerticalアイコン追加
- **バージョン**: 2.48.0
- **コミット**: 9ccb496
- **GitHub**: プッシュ完了

### 2. TaskModal (frontend/src/components/project/TaskModal.tsx) ✅
- **実装完了**: ミッション選択時にプロジェクトフィルタリング
- **機能**: ミッションを選択すると、そのミッションに紐づくプロジェクトのみ表示
- **ソート**: ミッションとプロジェクトを登録順（古い順）に表示
  - `order`フィールドがある場合はそれを使用
  - なければ`createdAt`で比較

## 未完了の項目

### 3. ミッションページ (Goals.tsx) ⚠️
**現状**:
- 矢印ボタン（ArrowUp/ArrowDown）で順番入れ替え実装済み
- デフォルトミッション（協力隊業務・役場業務）は順番変更不可の制御あり
- viewMode条件で表示制御あり

**必要な作業**:
1. react-beautiful-dndのimport追加
2. handleDragEnd関数の実装
3. カード表示のDragDropContext/Droppable/Draggable化
4. GripVerticalアイコン追加
5. デフォルトミッションはドラッグ不可にする制御
6. viewMode条件を削除して全役職で表示

**バックエンド**:
- `/api/missions/:id/reorder` エンドポイント実装済み（矢印用）
- `/api/missions/:id/reorder-to` エンドポイント未実装（ドラッグ&ドロップ用）

### 4. タスクページ (Tasks.tsx) ⚠️
**現状**:
- 矢印ボタン（ArrowUp/ArrowDown）で順番入れ替え実装済み
- カード表示・リスト表示切り替えあり
- viewMode条件で表示制御あり

**必要な作業**:
1. react-beautiful-dndのimport追加
2. handleDragEnd関数の実装
3. カード表示とリスト表示の両方をDragDropContext/Droppable/Draggable化
4. GripVerticalアイコン追加
5. viewMode条件を削除して全役職で表示

**バックエンド**:
- `/api/missions/:missionId/tasks/:id/reorder` エンドポイント実装済み（矢印用）
- `/api/missions/:missionId/tasks/:id/reorder-to` エンドポイント未実装（ドラッグ&ドロップ用）

## 次のステップ

### 優先順位1: バックエンドエンドポイント追加
1. `backend/src/routes/missions.ts` に `/api/missions/:id/reorder-to` エンドポイント追加
2. `backend/src/routes/tasks.ts` に `/api/missions/:missionId/tasks/:id/reorder-to` エンドポイント追加

### 優先順位2: フロントエンド実装
1. Goals.tsx のドラッグ&ドロップ実装
2. Tasks.tsx のドラッグ&ドロップ実装

### 優先順位3: テストとデプロイ
1. ローカル環境で動作確認
2. GitHubにプッシュ
3. Renderで自動デプロイ
4. 本番環境で動作確認（ブラウザキャッシュクリア）

## 技術的な注意点

### ドラッグ&ドロップ実装パターン
```tsx
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';

const handleDragEnd = async (result: DropResult) => {
  if (!result.destination) return;
  
  const sourceIndex = result.source.index;
  const destinationIndex = result.destination.index;
  
  if (sourceIndex === destinationIndex) return;

  const itemId = result.draggableId;
  
  try {
    await api.post(`/api/endpoint/${itemId}/reorder-to`, {
      newIndex: destinationIndex,
      oldIndex: sourceIndex,
    });
    
    queryClient.invalidateQueries({ queryKey: ['key'] });
  } catch (error: any) {
    console.error('Reorder error:', error);
    alert(error.response?.data?.error || '順番の入れ替えに失敗しました');
    queryClient.invalidateQueries({ queryKey: ['key'] });
  }
};
```

### バックエンドエンドポイントパターン
```typescript
router.post('/:id/reorder-to', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newIndex, oldIndex } = req.body;

    // アイテム取得と権限チェック
    const item = await prisma.model.findUnique({
      where: { id },
      select: { id: true, userId: true, order: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'アイテムが見つかりません' });
    }

    // 権限チェック
    if (item.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    // 同じユーザーのアイテムを取得
    const allItems = await prisma.model.findMany({
      where: { userId: item.userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, order: true },
    });

    // 新しい順番を計算
    const updates = [];
    if (newIndex > oldIndex) {
      // 下に移動
      for (let i = 0; i < allItems.length; i++) {
        if (i === oldIndex) {
          updates.push({ id: allItems[i].id, order: newIndex });
        } else if (i > oldIndex && i <= newIndex) {
          updates.push({ id: allItems[i].id, order: i - 1 });
        } else {
          updates.push({ id: allItems[i].id, order: i });
        }
      }
    } else {
      // 上に移動
      for (let i = 0; i < allItems.length; i++) {
        if (i === oldIndex) {
          updates.push({ id: allItems[i].id, order: newIndex });
        } else if (i >= newIndex && i < oldIndex) {
          updates.push({ id: allItems[i].id, order: i + 1 });
        } else {
          updates.push({ id: allItems[i].id, order: i });
        }
      }
    }

    // トランザクションで更新
    await prisma.$transaction(
      updates.map(update =>
        prisma.model.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );

    res.json({ message: '順番を入れ替えました' });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: '順番の入れ替えに失敗しました' });
  }
});
```

## デプロイ手順

1. **ローカルで動作確認**
   ```bash
   docker-compose up -d
   # フロントエンド: http://localhost:5173
   # バックエンド: http://localhost:3000
   ```

2. **GitHubにプッシュ**
   ```bash
   git add .
   git commit -m "feat: ミッション・タスクにドラッグ&ドロップ機能を実装"
   git push origin main
   ```

3. **Renderで確認**
   - バックエンド: 自動デプロイ（マイグレーション自動実行）
   - フロントエンド: 自動デプロイされない場合は「Manual Deploy」→「Clear build cache & deploy」

4. **本番環境で確認**
   - ブラウザキャッシュクリア（Ctrl+Shift+R / Cmd+Shift+R）
   - 各ページで順番入れ替えをテスト

## 参考情報

- **カレンダーのドラッグ&ドロップ実装**: `frontend/src/components/schedule/DraggableCalendarView.tsx`
- **プロジェクトのドラッグ&ドロップ実装**: `frontend/src/pages/Projects.tsx`
- **バックエンドエンドポイント**: `backend/src/routes/projects.ts` の `/reorder-to`
