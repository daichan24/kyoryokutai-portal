# 協力隊業務・役場業務のプロジェクト連携実装

## 概要
「協力隊業務」と「役場業務」をミッションとして選択した場合、対応するプロジェクトも自動的に設定されるように実装する必要があります。これにより、面談ページの「プロジェクト別」セクションで正しく表示されるようになります。

## 現状の問題

現在、`defaultMissionProjectService.ts` で「協力隊業務」と「役場業務」のミッションとプロジェクトの両方が作成されていますが、TaskModal でこれらのミッションを選択した際に、プロジェクトが自動的に設定されていません。

そのため、以下の問題が発生しています:
- スケジュールやタスクで「協力隊業務」を選択しても、`projectId` が `null` のまま
- `linkKind` が `'KYORYOKUTAI_WORK'` になり、プロジェクトに紐づかない
- 面談ページの「プロジェクト別」セクションで「協力隊業務」や「役場業務」が表示されない

## 必要な実装

### 1. TaskModal.tsx の handleMissionChange 関数を更新

**ファイル**: `frontend/src/components/project/TaskModal.tsx`
**行番号**: 約416-421行目

**現在のコード**:
```typescript
const handleMissionChange = async (v: string) => {
  if (v === '__KYORYOKUTAI__') { setSelectedMissionId(''); setAttachMode('KYORYOKUTAI'); setProjectId(null); }
  else if (v === '__YAKUBA__') { setSelectedMissionId(''); setAttachMode('YAKUBA'); setProjectId(null); }
  else {
    // ... 通常のミッション選択処理
  }
};
```

**変更後のコード**:
```typescript
const handleMissionChange = async (v: string) => {
  if (v === '__KYORYOKUTAI__') {
    // 協力隊業務: 対応するプロジェクトを自動選択
    const kyoryokutaiProject = projects.find(p => p.projectName === '協力隊業務');
    if (kyoryokutaiProject) {
      setSelectedMissionId(kyoryokutaiProject.missionId || '');
      setProjectId(kyoryokutaiProject.id);
      setAttachMode('KYORYOKUTAI'); // UIでは特別扱いするが、projectIdは設定
      console.log('協力隊業務プロジェクトを自動選択:', kyoryokutaiProject);
    } else {
      // プロジェクトが見つからない場合は従来の動作
      setSelectedMissionId('');
      setAttachMode('KYORYOKUTAI');
      setProjectId(null);
      console.warn('協力隊業務プロジェクトが見つかりません');
    }
  }
  else if (v === '__YAKUBA__') {
    // 役場業務: 対応するプロジェクトを自動選択
    const yakubaProject = projects.find(p => p.projectName === '役場業務');
    if (yakubaProject) {
      setSelectedMissionId(yakubaProject.missionId || '');
      setProjectId(yakubaProject.id);
      setAttachMode('YAKUBA'); // UIでは特別扱いするが、projectIdは設定
      console.log('役場業務プロジェクトを自動選択:', yakubaProject);
    } else {
      // プロジェクトが見つからない場合は従来の動作
      setSelectedMissionId('');
      setAttachMode('YAKUBA');
      setProjectId(null);
      console.warn('役場業務プロジェクトが見つかりません');
    }
  }
  else {
    // ... 通常のミッション選択処理（変更なし）
  }
};
```

### 2. handleSubmit 関数でスケジュール保存時の projectId 設定を更新

**ファイル**: `frontend/src/components/project/TaskModal.tsx`
**行番号**: 約451行目

**現在のコード**:
```typescript
projectId: attachMode === 'PROJECT' ? projectId : null,
```

**変更後のコード**:
```typescript
projectId: (attachMode === 'PROJECT' || attachMode === 'KYORYOKUTAI' || attachMode === 'YAKUBA') ? projectId : null,
```

### 3. handleSubmit 関数でタスク保存時の linkKind と projectId を更新

**ファイル**: `frontend/src/components/project/TaskModal.tsx`
**行番号**: 約486行目と489行目

**現在のコード**:
```typescript
const linkKind = attachMode === 'PROJECT' ? 'PROJECT' : attachMode === 'KYORYOKUTAI' ? 'KYORYOKUTAI_WORK' : attachMode === 'TRIAGE' ? 'TRIAGE_PENDING' : 'UNSET';
// ...
projectId: attachMode === 'PROJECT' ? projectId : null, linkKind,
```

**変更後のコード**:
```typescript
const linkKind = (attachMode === 'PROJECT' || attachMode === 'KYORYOKUTAI' || attachMode === 'YAKUBA') ? 'PROJECT' : attachMode === 'TRIAGE' ? 'TRIAGE_PENDING' : 'UNSET';
// ...
projectId: (attachMode === 'PROJECT' || attachMode === 'KYORYOKUTAI' || attachMode === 'YAKUBA') ? projectId : null, linkKind,
```

### 4. 既存データ編集時の検出ロジックを追加（オプション）

**ファイル**: `frontend/src/components/project/TaskModal.tsx`
**場所**: useEffect の後（約347行目あたり）

**追加するコード**:
```typescript
// プロジェクトが読み込まれた後、協力隊業務・役場業務プロジェクトの場合はattachModeを更新
useEffect(() => {
  if (projects.length > 0 && projectId && (attachMode === 'PROJECT' || attachMode === 'UNSET')) {
    const currentProject = projects.find(p => p.id === projectId);
    if (currentProject) {
      if (currentProject.projectName === '協力隊業務') {
        setAttachMode('KYORYOKUTAI');
        setSelectedMissionId(currentProject.missionId || '');
        console.log('協力隊業務プロジェクトを検出しました');
      } else if (currentProject.projectName === '役場業務') {
        setAttachMode('YAKUBA');
        setSelectedMissionId(currentProject.missionId || '');
        console.log('役場業務プロジェクトを検出しました');
      }
    }
  }
}, [projects, projectId]);
```

## 実装手順

1. `frontend/src/components/project/TaskModal.tsx` を開く
2. 上記の4つの変更を順番に適用する
3. ファイルを保存する
4. `npm run build` でビルドエラーがないか確認
5. 動作確認:
   - タスク作成で「協力隊業務」を選択 → プロジェクトが自動設定されることを確認
   - タスク作成で「役場業務」を選択 → プロジェクトが自動設定されることを確認
   - 保存後、面談ページの「プロジェクト別」で正しく表示されることを確認

## 影響範囲

### データベース
- 新規作成されるタスク/スケジュールは `projectId` が設定される
- `linkKind` は `'PROJECT'` になる（従来の `'KYORYOKUTAI_WORK'` や `'YAKUBA_WORK'` ではない）

### 既存データ
- 既存の `linkKind: 'KYORYOKUTAI_WORK'` や `'YAKUBA_WORK'` のデータは引き続き動作する
- 編集して保存すると新しい形式（`linkKind: 'PROJECT'` + `projectId` 設定）に更新される

### 面談ページ
- 「プロジェクト別」セクションで「協力隊業務」と「役場業務」が正しく表示される
- スケジュールやタスクがプロジェクトごとに分類される

## テスト項目

### 新規作成
- [ ] ミッションで「協力隊業務」を選択 → プロジェクトが自動設定される
- [ ] ミッションで「役場業務」を選択 → プロジェクトが自動設定される
- [ ] 保存後、面談ページの「プロジェクト別」で正しく表示される

### 既存データ編集
- [ ] 「協力隊業務」プロジェクトのタスクを開く → 正しく表示される
- [ ] 「役場業務」プロジェクトのタスクを開く → 正しく表示される
- [ ] 編集して保存 → 正しく保存される

### 面談ページ
- [ ] 「プロジェクト別」セクションで「協力隊業務」が表示される
- [ ] 「プロジェクト別」セクションで「役場業務」が表示される
- [ ] 各プロジェクトに正しいスケジュール/タスクが表示される

## 注意事項

1. **マイグレーション**: 既存メンバーに「協力隊業務」と「役場業務」のプロジェクトを作成するには、以下のエンドポイントを実行してください:
   ```
   POST /api/admin/create-default-missions-projects
   ```

2. **後方互換性**: 既存の `linkKind: 'KYORYOKUTAI_WORK'` や `'YAKUBA_WORK'` のデータは引き続き動作しますが、編集すると新しい形式に更新されます。

3. **UI表示**: 「協力隊業務」と「役場業務」のプロジェクトフィールドはグレーアウトで表示され、変更できません。これは意図的な動作です。

## 関連ファイル

- `frontend/src/components/project/TaskModal.tsx` - タスク/スケジュール編集モーダル（要修正）
- `backend/src/services/defaultMissionProjectService.ts` - デフォルトミッション・プロジェクト作成サービス
- `backend/src/routes/admin.ts` - 管理者用エンドポイント
- `frontend/src/pages/InterviewMonthlySchedules.tsx` - 面談ページ

## 実装状況

- [x] デフォルトミッション・プロジェクト作成サービスの実装
- [x] 管理者用マイグレーションエンドポイントの追加
- [ ] TaskModal.tsx の handleMissionChange 関数の更新（要実装）
- [ ] TaskModal.tsx の handleSubmit 関数の更新（要実装）
- [ ] 既存データ編集時の検出ロジックの追加（オプション）

## バージョン

作成日: 2026年4月30日

