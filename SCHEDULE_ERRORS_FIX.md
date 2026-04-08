# スケジュールエラー修正

## 修正内容

### 1. スケジュール編集時の情報表示の修正

スケジュール画面からタスクを選択して「タスクを編集」のポップアップが表示される際に、場所・ミッション・プロジェクトの表記が消える問題を修正しました。

#### 変更点
- `TaskModal.tsx`のスケジュール初期化処理で、スケジュールに紐づくタスクのミッションIDを設定するように修正
- `schedule.task?.missionId`が存在する場合、`selectedMissionId`に設定

#### 修正箇所
```typescript
if (schedule) {
  // ... 既存の処理 ...
  // スケジュールのミッションIDを設定
  if ((schedule as any).task?.missionId) {
    setSelectedMissionId((schedule as any).task.missionId);
  }
}
```

### 2. 新規タスク追加時の時刻自動調整機能

新規タスク追加時のみ、開始時刻または終了時刻を最初に変更した際に、もう一方の時刻が自動的に1時間後/前に設定されるようになりました。

#### 動作
- 開始時刻を変更 → 終了時刻が自動的に1時間後に設定
- 終了時刻を変更 → 開始時刻が自動的に1時間前に設定
- 2回目以降の変更では自動調整されない（ユーザーの意図を尊重）
- 既存タスク・スケジュールの編集時には動作しない

#### 実装詳細
```typescript
const [hasEditedTime, setHasEditedTime] = useState(false);

// 開始時刻の変更
onChange={v => { 
  setStartTime(v); 
  // 新規作成時かつ時刻未編集の場合のみ自動調整
  if (!task && !schedule && !hasEditedTime) {
    setEndTime(addHour(v, 60));
  }
  setHasEditedTime(true);
}}

// 終了時刻の変更
onChange={v => { 
  setEndTime(v); 
  // 新規作成時かつ時刻未編集の場合のみ自動調整
  if (!task && !schedule && !hasEditedTime) {
    setStartTime(addHour(v, -60));
  }
  setHasEditedTime(true);
}}
```

### 3. 時刻ドラムロールの表示数変更

時刻選択のドラムロールで表示される時間の数を5つから7つに変更しました。

#### 変更点
- `VISIBLE`定数を5から7に変更
- より多くの時間が一度に表示され、選択しやすくなりました

#### 修正箇所
```typescript
const VISIBLE = 7; // 5から7に変更
```

### 4. 共同作業メンバーの表示順序改善

共同作業で連携中のメンバーがいる場合、ポップアップを開いた際に選択済みメンバーが一番上に表示されるようになりました。

#### 動作
- 選択済み（チェック済み）のメンバーがリストの一番上に表示
- 未選択のメンバーはその下に表示
- 誰と共同作業しているかが一目で分かるようになりました

#### 実装詳細
```typescript
{(() => {
  // 選択済みメンバーを一番上に表示
  const selectedUsers = availableUsers.filter(u => selectedParticipantIds.includes(u.id));
  const unselectedUsers = availableUsers.filter(u => !selectedParticipantIds.includes(u.id));
  const sortedUsers = [...selectedUsers, ...unselectedUsers];
  
  return sortedUsers.map(u => (
    // メンバー表示
  ));
})()}
```

## 変更ファイル

- `frontend/src/components/project/TaskModal.tsx`
  - スケジュール編集時のミッションID設定を追加
  - 時刻自動調整機能を新規作成時のみに限定
  - 時刻ドラムロールの表示数を7に変更
  - 共同作業メンバーの表示順序を改善

## テスト項目

1. スケジュール編集時に場所・ミッション・プロジェクトが正しく表示されることを確認
2. 新規タスク追加時に開始時刻を変更すると終了時刻が1時間後になることを確認
3. 新規タスク追加時に終了時刻を変更すると開始時刻が1時間前になることを確認
4. 2回目以降の時刻変更では自動調整されないことを確認
5. 既存タスク・スケジュール編集時には時刻自動調整が動作しないことを確認
6. 時刻ドラムロールで7つの時間が表示されることを確認
7. 共同作業メンバーが選択済みの場合、一番上に表示されることを確認
