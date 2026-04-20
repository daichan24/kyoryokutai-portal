# カレンダーUI改善計画

## ✅ 完了: 軽微な修正（まとめて実装済み）

### 1. カレンダーの数字を中央揃え、「日」を削除
- FullCalendarの日付表示を中央揃えに変更
- 日付の後ろの「日」を非表示に設定

### 2. タスクのテキストサイズを調整
- イベントタイトルを`text-xs`（12px）に縮小
- 時間表示を`text-xs`に統一
- 月表示の単日スケジュールも同様に調整

### 3. 時間表示が絶対に見えるように
- 時間表示を`font-semibold`で強調
- `order: -1`でタイトルより上に配置
- `flex-shrink: 0`で縮小を防止
- TimeAxisViewでも時間を最優先で表示

### 4. 薄い色のテーマカラーの文字色を反転調整
- `getTextColor()`関数を実装（WCAG基準の相対輝度計算）
- 輝度0.5を閾値に黒文字/白文字を自動切り替え
- DraggableCalendarView、TimeAxisView、Schedule.tsxの全てで適用
- スケジュール、イベント、複数日バーの全てに対応

---

## 🔄 段階的実装: 中・高の作業

### フェーズ1: メンバー表示サイドバー（中難度）

#### 目的
- 誰がどの色かをわかりやすく表示
- Googleカレンダー風のサイドバーUI

#### 実装内容
1. カレンダー左側にメンバーリストサイドバーを追加
2. 各メンバーのアバター色と名前を表示
3. チェックボックスで表示/非表示を切り替え
4. 選択状態をローカルストレージに保存

#### 技術的詳細
```typescript
// 新しいstate
const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set());

// サイドバーコンポーネント
<div className="w-48 border-r">
  {availableMembers.map(member => (
    <label key={member.id}>
      <input 
        type="checkbox" 
        checked={visibleMemberIds.has(member.id)}
        onChange={() => toggleMemberVisibility(member.id)}
      />
      <div style={{ backgroundColor: member.avatarColor }}>
        {member.avatarLetter}
      </div>
      {member.name}
    </label>
  ))}
</div>
```

#### 影響範囲
- `frontend/src/pages/Schedule.tsx`: サイドバーUI追加
- `frontend/src/components/schedule/DraggableCalendarView.tsx`: フィルタリングロジック追加
- `frontend/src/components/schedule/TimeAxisView.tsx`: フィルタリングロジック追加

---

### フェーズ2: 複数メンバー選択機能（高難度）

#### 目的
- Googleカレンダー風の柔軟な表示切り替え
- 「自分 + 特定の誰か」など、任意の組み合わせで表示

#### 実装内容
1. 現在の「個人/全体/特定メンバー」選択を廃止
2. サイドバーのチェックボックスで複数選択可能に
3. 「全員選択」「全員解除」ボタンを追加
4. デフォルトは自分のみ選択状態

#### 技術的詳細
```typescript
// 既存のcalendarViewModeを廃止し、visibleMemberIdsで管理
const filteredSchedules = schedules.filter(s => 
  visibleMemberIds.size === 0 || visibleMemberIds.has(s.userId)
);

// クイックアクション
const selectAll = () => setVisibleMemberIds(new Set(availableMembers.map(m => m.id)));
const selectOnlyMe = () => setVisibleMemberIds(new Set([user?.id]));
```

#### 影響範囲
- `frontend/src/pages/Schedule.tsx`: 表示モード切り替えロジックの大幅変更
- `backend/src/routes/schedules.ts`: クエリパラメータの変更（複数userId対応）
- 全てのカレンダーコンポーネント: フィルタリングロジックの統一

---

### フェーズ3: 「more」モーダルの人ごと表示（中難度）

#### 目的
- 月表示で「他N件」をクリックした際、人ごとにグループ化して表示

#### 実装内容
1. 既存の`selectedDateForDetail`モーダルを拡張
2. スケジュールをユーザーごとにグループ化（既に実装済み）
3. 時間順ソートを維持しつつ、ユーザーセクションで分割
4. 各ユーザーセクションにアバターとスケジュール数を表示

#### 技術的詳細
```typescript
// 既存のコードを活用（Schedule.tsxの1000行目付近）
const userGroups = [...userMap.values()].sort((a, b) =>
  (a.user?.name || '').localeCompare(b.user?.name || '', 'ja')
);

// 各グループ内で時間順ソート
userSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime))
```

#### 影響範囲
- `frontend/src/pages/Schedule.tsx`: モーダルUIの調整（既にほぼ実装済み）
- スタイリングの微調整のみ

---

## 実装優先順位

1. **フェーズ3（最優先）**: 既存コードの活用で最小工数
2. **フェーズ1（次）**: 独立した機能で段階的に追加可能
3. **フェーズ2（最後）**: 既存ロジックの大幅変更が必要

## 注意事項

- 各フェーズは独立してテスト・デプロイ可能
- ユーザーフィードバックを得ながら段階的に実装
- パフォーマンスへの影響を監視（特にフェーズ2）
- モバイル対応も考慮（サイドバーは折りたたみ可能に）

## 次のステップ

ユーザーの承認を得てから、フェーズ3から実装を開始します。
