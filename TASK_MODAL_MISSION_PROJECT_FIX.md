# タスクモーダル：ミッション・プロジェクト保持の修正

## 日付
2026年4月21日

## 問題の概要
タスク編集時（特にスケジュールから「タスク編集」を開いた場合）に、ミッションとプロジェクトの情報が正しく表示・保持されない問題が発生していました。

### 具体的な症状
1. スケジュールから「タスク編集」を開くと、ミッションとプロジェクトが未選択になる
2. タスク一覧から編集を開いても、ミッションが消える場合がある
3. 「役場業務」「協力隊業務」を選択している場合、特に情報が失われやすい
4. タイトルが「メモ」フィールドに重複して表示される

## 根本原因

### 1. バックエンド：スケジュール取得APIにタスク情報が含まれていない
```typescript
// backend/src/routes/schedules.ts
// 問題：scheduleParticipantsまでしかincludeされていない
const schedules = await prisma.schedule.findMany({
  where,
  include: {
    user: { ... },
    project: { ... },
    supportEvent: { ... },
    scheduleParticipants: { ... },
    // task情報が欠落！
  },
});
```

### 2. フロントエンド：スケジュール編集時の初期値設定が不完全
```typescript
// frontend/src/components/project/TaskModal.tsx
// 問題：schedule.projectIdのみを使用し、task情報を参照していない
if (schedule) {
  setProjectId(schedule.projectId || null);
  setAttachMode(schedule.projectId ? 'PROJECT' : 'UNSET');
  // ミッションIDの設定が条件付きで不完全
  if ((schedule as any).task?.missionId) {
    setSelectedMissionId((schedule as any).task.missionId);
  }
}
```

### 3. タイトルとメモの重複
```typescript
// 問題：activityDescriptionがタイトルとメモの両方に使用されていた
setTitle(schedule.title || schedule.activityDescription || '');
setMemo([schedule.activityDescription, schedule.freeNote].filter(Boolean).join('\n'));
```

## 修正内容

### 1. バックエンド修正（backend/src/routes/schedules.ts）

スケジュール取得APIに`task`情報を含めるように修正：

```typescript
const schedules = await prisma.schedule.findMany({
  where,
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarColor: true,
      },
    },
    project: {
      select: {
        id: true,
        projectName: true,
        themeColor: true,
      },
    },
    supportEvent: {
      select: {
        id: true,
        eventName: true,
        startDate: true,
        endDate: true,
        supportSlotsNeeded: true,
      },
    },
    scheduleParticipants: {
      where: (isCreator || allMembers === 'true') ? undefined : {
        userId: currentUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarColor: true,
          },
        },
      },
    },
    // ✅ 追加：タスク情報を含める
    task: {
      select: {
        id: true,
        missionId: true,
        projectId: true,
        title: true,
        linkKind: true,
      },
    },
  },
  orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
});
```

### 2. フロントエンド修正（frontend/src/components/project/TaskModal.tsx）

スケジュール編集時の初期値設定を完全に書き直し：

```typescript
useEffect(() => {
  if (schedule) {
    // タイトルと日付の設定
    setTitle(schedule.title || '');
    const sd = formatDate(schedule.date);
    setDueDate(sd);
    setEndDate((schedule as any).endDate ? formatDate(new Date((schedule as any).endDate)) : sd);
    setStartTime(schedule.startTime); 
    setEndTime(schedule.endTime);
    
    // ✅ ミッションとプロジェクトの設定（タスク情報から取得）
    if ((schedule as any).task) {
      const scheduleTask = (schedule as any).task;
      setSelectedMissionId(scheduleTask.missionId || '');
      setProjectId(scheduleTask.projectId || null);
      
      // linkKindからattachModeを設定
      const taskLinkKind = scheduleTask.linkKind;
      if (taskLinkKind === 'KYORYOKUTAI_WORK') {
        setAttachMode('KYORYOKUTAI');
      } else if (taskLinkKind === 'YAKUBA_WORK') {
        setAttachMode('YAKUBA');
      } else if (taskLinkKind === 'TRIAGE_PENDING') {
        setAttachMode('TRIAGE');
      } else if (scheduleTask.projectId) {
        setAttachMode('PROJECT');
      } else {
        setAttachMode('UNSET');
      }
    } else {
      // タスク情報がない場合はスケジュールのprojectIdを使用
      setProjectId(schedule.projectId || null);
      setAttachMode(schedule.projectId ? 'PROJECT' : 'UNSET');
      setSelectedMissionId('');
    }
    
    // ✅ その他の設定（メモはfreeNoteのみ）
    setMemo(schedule.freeNote || '');
    setCustomColor((schedule as any).customColor || '');
    setSupportEventId(schedule.supportEventId || null);
    setShowSupportEvents(!!schedule.supportEventId);
    setIsCollaborative(!!(schedule.scheduleParticipants?.length));
    if (schedule.scheduleParticipants) {
      setSelectedParticipantIds(schedule.scheduleParticipants.filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId).map(p => p.userId));
    }
    setIsHolidayWork((schedule as any).isHolidayWork ?? false);
    setCompensatoryLeaveRequired((schedule as any).compensatoryLeaveRequired ?? false);
    setCompensatoryLeaveType((schedule as any).compensatoryLeaveType ?? 'FULL_DAY');
    setIsDayOff((schedule as any).isDayOff ?? false);
    setDayOffType((schedule as any).dayOffType ?? 'PAID');
  } else if (task) {
    // タスク編集時の処理...
  }
}, [task, schedule, missionId, defaultDate, defaultStartTime, defaultEndTime, defaultProjectId]);
```

### 3. タイトルとメモの重複修正

```typescript
// ✅ タイトルはschedule.titleのみ
setTitle(schedule.title || '');

// ✅ メモはfreeNoteのみ（activityDescriptionを削除）
setMemo(schedule.freeNote || '');
```

### 4. プロジェクト選択時のミッションリセット防止

```typescript
// プロジェクトドロップダウンのonChange
onChange={e => {
  const v = e.target.value;
  if (v === 'KYORYOKUTAI') { setAttachMode('KYORYOKUTAI'); setProjectId(null); setSelectedMissionId(''); }
  else if (v === 'YAKUBA') { setAttachMode('YAKUBA'); setProjectId(null); setSelectedMissionId(''); }
  else if (v === 'TRIAGE') { setAttachMode('TRIAGE'); setProjectId(null); setSelectedMissionId(''); }
  // ✅ 未設定の場合はミッションをリセットしない
  else if (v === '') { setAttachMode('UNSET'); setProjectId(null); }
  else { setAttachMode('PROJECT'); setProjectId(v); }
}}
```

## 影響範囲

### 修正されたファイル
1. `backend/src/routes/schedules.ts` - スケジュール取得APIにtask情報を追加
2. `frontend/src/components/project/TaskModal.tsx` - 初期値設定ロジックの完全な書き直し

### 影響を受ける機能
- スケジュールページからの「タスク編集」
- タスク一覧からの「タスク編集」
- タスクの新規作成
- スケジュールの編集

## テスト項目

### ✅ 確認済み
1. スケジュールから「タスク編集」を開いたときにミッション・プロジェクトが表示される
2. タスク一覧から編集を開いたときにミッション・プロジェクトが保持される
3. 「役場業務」「協力隊業務」を選択している場合も正しく表示される
4. タイトルがメモに重複しない
5. プロジェクトを変更してもミッションが保持される

### 追加で確認すべき項目
- [ ] 新規タスク作成時の動作
- [ ] タスクの保存後、再度開いたときの表示
- [ ] 複数のミッション・プロジェクトを持つタスクの編集
- [ ] タスク情報がないスケジュールの編集

## 技術的なポイント

### 1. データの流れ
```
Database (Schedule + Task)
  ↓ (Prisma include)
Backend API (schedules.ts)
  ↓ (JSON response)
Frontend (Schedule型 with task)
  ↓ (useEffect初期値設定)
TaskModal State (selectedMissionId, projectId, attachMode)
  ↓ (UI表示)
ドロップダウン表示
```

### 2. linkKindとattachModeのマッピング
```typescript
KYORYOKUTAI_WORK → KYORYOKUTAI
YAKUBA_WORK → YAKUBA
TRIAGE_PENDING → TRIAGE
PROJECT (projectIdあり) → PROJECT
その他 → UNSET
```

### 3. 初期値設定の優先順位
1. `schedule.task`が存在する場合：タスク情報から取得
2. `schedule.task`がない場合：スケジュールのprojectIdを使用
3. どちらもない場合：空の状態

## コミット履歴

1. `f4110c4` - feat: スケジュール取得APIにタスク情報を含める
2. `739339d` - feat: スケジュール編集時にタスク情報からミッション・プロジェクトを取得
3. `872674d` - fix: タイトルがメモに飛ぶ問題を修正とミッション保持の改善
4. `7ea2c08` - fix: プロジェクト選択時にミッションがリセットされる問題を修正

## 今後の改善案

1. **型定義の強化**
   - Schedule型にtask情報を明示的に含める
   - linkKindとattachModeの型を統一

2. **エラーハンドリング**
   - タスク情報の取得に失敗した場合の処理
   - 不正なlinkKind値の処理

3. **パフォーマンス**
   - 必要な場合のみtask情報を取得（条件付きinclude）
   - キャッシュの活用

4. **テストの追加**
   - スケジュール編集時の初期値設定のユニットテスト
   - E2Eテストでの動作確認

## 関連ドキュメント
- [CORE_FIXES_ARCHIVE.md](./CORE_FIXES_ARCHIVE.md) - コア修正のアーカイブ
- [SCHEDULE_EDIT_FIX.md](./SCHEDULE_EDIT_FIX.md) - スケジュール編集の修正履歴
