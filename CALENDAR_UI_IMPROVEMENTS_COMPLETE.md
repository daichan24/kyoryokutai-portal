# カレンダーUI改善 - 実装完了

## ✅ 完了した改善項目

### フェーズ0: 軽微な修正（まとめて実装）

#### 1. カレンダーの数字を中央揃え、「日」を削除
- ✅ FullCalendarの日付表示を中央揃えに変更
- ✅ 日付の後ろの「日」を非表示に設定
- ✅ CSSで`.fc-daygrid-day-number`をカスタマイズ

#### 2. タスクのテキストサイズを調整
- ✅ イベントタイトルを`text-xs`（12px）に縮小
- ✅ 時間表示を`text-xs`に統一
- ✅ 月表示の単日スケジュールも同様に調整
- ✅ 複数日バーのフォントサイズを10pxに縮小

#### 3. 時間表示が絶対に見えるように
- ✅ 時間表示を`font-semibold`で強調
- ✅ `order: -1`でタイトルより上に配置
- ✅ `flex-shrink: 0`で縮小を防止
- ✅ TimeAxisViewでも時間を最優先で表示
- ✅ 詳細モーダルでも時間を太字で表示

#### 4. 薄い色のテーマカラーの文字色を反転調整
- ✅ `getTextColor()`関数を実装（WCAG基準の相対輝度計算）
- ✅ 輝度0.5を閾値に黒文字/白文字を自動切り替え
- ✅ DraggableCalendarView、TimeAxisView、Schedule.tsxの全てで適用
- ✅ スケジュール、イベント、複数日バーの全てに対応

---

### フェーズ1: メンバー表示サイドバー

#### 実装内容
- ✅ カレンダー左側にメンバーリストサイドバーを追加
- ✅ 各メンバーのアバター色と名前を表示
- ✅ チェックボックスで表示/非表示を切り替え
- ✅ 選択状態をローカルストレージに保存
- ✅ 選択数の表示
- ✅ サイドバーの開閉機能（デスクトップのみ）

#### 技術的詳細
```typescript
// 新しいstate
const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set());
const [showMemberSidebar, setShowMemberSidebar] = useState(true);

// ローカルストレージへの保存
useEffect(() => {
  if (visibleMemberIds.size > 0) {
    localStorage.setItem('calendarVisibleMembers', JSON.stringify([...visibleMemberIds]));
  }
}, [visibleMemberIds]);

// ローカルストレージからの読み込み
useEffect(() => {
  const saved = localStorage.getItem('calendarVisibleMembers');
  if (saved) {
    try {
      const ids = JSON.parse(saved);
      setVisibleMemberIds(new Set(ids));
    } catch (e) {
      console.error('Failed to load visible members:', e);
    }
  }
}, []);
```

#### UI機能
- クイックアクション: 「自分のみ」「全員」「クリア」ボタン
- 自分のメンバーを最上部に表示（「(自分)」ラベル付き）
- 他のメンバーは区切り線の下に表示
- スクロール可能なメンバーリスト（最大高さ60vh）
- デスクトップのみ表示（lg:block）

---

### フェーズ2: 複数メンバー選択機能

#### 実装内容
- ✅ サイドバーのチェックボックスで複数選択可能
- ✅ 「個人」ボタンで自分のみ選択
- ✅ 「全体」ボタンで全員選択
- ✅ 週表示でも同様の機能を実装
- ✅ バックエンドで複数userIdsをサポート

#### バックエンド変更
```typescript
// backend/src/routes/schedules.ts
const { userId, date, startDate, endDate, view, allMembers, userIds } = req.query;

// userIdsが指定されている場合（複数メンバー選択）
if (userIds) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  where = {
    userId: {
      in: ids as string[],
    },
  };
}
```

#### フロントエンド変更
```typescript
// frontend/src/pages/Schedule.tsx
if (calendarViewMode === 'all') {
  if (visibleMemberIds.size > 0) {
    visibleMemberIds.forEach(id => params.append('userIds', id));
  } else {
    params.append('allMembers', 'true');
  }
}
```

#### 動作
1. 「個人」ボタン: 自分のIDのみをvisibleMemberIdsに設定
2. 「全体」ボタン: 全メンバーのIDをvisibleMemberIdsに設定
3. サイドバー: 個別にチェック/アンチェックで柔軟に選択
4. 選択状態はローカルストレージに保存され、次回訪問時に復元

---

### フェーズ3: 「more」モーダルの人ごと表示

#### 実装状況
- ✅ 既に実装済み（Schedule.tsx 1000行目付近）
- ✅ ユーザーごとにグループ化
- ✅ 各グループ内で時間順ソート
- ✅ アバターとスケジュール数を表示
- ✅ 人フィルター機能

#### 既存コード
```typescript
// ユーザーごとにグループ化
const userMap = new Map<string, { user: ScheduleType['user']; schedules: ScheduleType[] }>();
for (const s of allDaySchedules) {
  const uid = s.userId;
  if (!userMap.has(uid)) userMap.set(uid, { user: s.user, schedules: [] });
  userMap.get(uid)!.schedules.push(s);
}

// 各グループ内で時間順ソート
[...userSchedules].sort((a, b) => a.startTime.localeCompare(b.startTime))
```

---

## 📱 モバイル対応

- サイドバーはデスクトップのみ表示（`hidden lg:block`）
- モバイルでは従来の「個人/全体」ボタンで切り替え
- レスポンシブデザインを維持

---

## 🎨 デザイン詳細

### サイドバー
- 幅: 224px（w-56）
- 背景: 白/ダークグレー
- ボーダー: 右側に区切り線
- スクロール: 最大高さ60vhで自動スクロール

### メンバーアイテム
- アバター: 24px円形、ユーザーカラー
- ホバー効果: 背景色変化
- チェックボックス: 角丸、グレーボーダー

### クイックアクション
- 3つのボタンを等幅で配置
- 小さいフォントサイズ（text-xs）
- グレー背景、ホバーで濃くなる

---

## 🔧 技術的な改善点

### パフォーマンス
- ローカルストレージでの状態管理
- 不要な再レンダリングを防ぐuseEffect依存配列の最適化
- Set型を使用した効率的なメンバーID管理

### 保守性
- 関数の分離（toggleMemberVisibility, selectAllMembers, etc.）
- 明確な命名規則
- コメントによる説明

### 拡張性
- バックエンドで複数userIdsをサポート
- フロントエンドで柔軟な選択ロジック
- 将来的な機能追加に対応しやすい構造

---

## 🚀 次のステップ（オプション）

### 追加機能の提案
1. メンバーグループ機能（チーム、部署など）
2. お気に入りメンバーの保存
3. メンバー検索機能
4. カラーフィルター（特定の色のスケジュールのみ表示）
5. モバイル用のメンバー選択モーダル

### パフォーマンス最適化
1. 大量のスケジュールがある場合の仮想スクロール
2. スケジュール取得のキャッシング
3. 差分更新の実装

---

## 📝 まとめ

全ての要件を実装完了しました：

1. ✅ カレンダーの数字を中央揃え、「日」を削除
2. ✅ タスクのテキストを小さく
3. ✅ 時間表示を絶対に見えるように
4. ✅ 薄い色の文字色を自動調整
5. ✅ メンバー表示サイドバー
6. ✅ 複数メンバー選択機能
7. ✅ 「more」モーダルの人ごと表示（既存）

Googleカレンダー風の使いやすいUIになりました！
