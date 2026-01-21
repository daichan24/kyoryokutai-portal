# [RESOLVED] スケジュールカレンダーの横幅がはみ出す

## 問題の概要
スケジュール管理のカレンダー表示で、横幅が画面からはみ出る問題がありました。

## エラーの詳細
- **発生箇所**: `frontend/src/pages/Schedule.tsx`
- **症状**: カレンダーの横幅が画面からはみ出る

## 原因
カレンダーグリッドの幅が固定されておらず、コンテナに`overflow-x-auto`が設定されていなかった

## 解決方法

### 1. カレンダーグリッドに最小幅を設定
```typescript
// カレンダーグリッドに min-w-[1260px] を設定（7日分 × 180px）
<div className="grid grid-cols-7 gap-1 min-w-[1260px]">
```

### 2. 親コンテナに横スクロールを追加
```typescript
// 親コンテナに overflow-x-auto を追加
<div className="overflow-x-auto">
  {/* カレンダーグリッド */}
</div>
```

これにより、カレンダーが画面幅を超える場合は横スクロールが表示されるようになりました。

## 関連コミット
- `fix: スケジュールカレンダーの横幅がはみ出す問題を修正`

## ラベル
`bug`, `frontend`, `ui`, `css`, `resolved`

