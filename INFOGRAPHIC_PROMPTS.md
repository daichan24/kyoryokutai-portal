# インフォグラフィック画像プロンプト集

> 協力隊クリアベースシステム 使い方ガイド用インフォグラフィック

---

## 🎨 キャラクタープロンプト（固定キャラクター定義）

> すべてのインフォグラフィックに共通して使用するキャラクターの定義プロンプトです。
> 画像生成時は必ずこのキャラクター定義を先頭に含めてください。

```
【固定キャラクター定義 - スノーマスコット】

A modern, minimal snowman-like mascot icon character with the following fixed design:
- Core concept: A highly simplified, friendly snowman-inspired guide character for infographics, designed with the same visual simplicity and quiet presence as a modern app mascot
- Overall form: A single unified silhouette inspired by a snowman, with a smaller rounded upper mass flowing smoothly into a larger rounded lower mass
- Shape rule: Do not draw two separate stacked circles; the body must be one continuous, seamless form with no visible boundary, seam, division line, or overlap between head and body
- Silhouette: Soft, organic, vertically compact, with a gentle snowman-like proportion that is recognizable only through the overall contour
- Face placement: Minimal face placed on the upper area of the silhouette
- Eyes: Two very small, slightly vertically elongated oval eyes, calm and neutral, inspired by the subtle eye shape of Kiro-style mascots
- Nose: One very small, simple snowman-like nose, subtle and minimal; optional muted orange accent
- Mouth: None
- Arms: None
- Legs: None
- Eyebrows: None
- Accessories: None — no bucket, no hat, no scarf, no buttons, no twig arms, no decorative winter elements
- Outline: No visible outer stroke or border line
- Form definition: The shape should be defined by contrast against the background and by a very soft, subtle shadow rather than by outlines
- Style: Minimal flat mascot icon style, extremely simple, clean, and quiet; soft presence, not cartoonish
- Color palette: Main body in white or very light warm gray; facial details in dark gray; nose in a very muted soft orange if included
- Lighting: Soft background contrast with a subtle shadow to separate the white body from the background, similar to how minimalist mascots rely on contrast rather than outlines
- Texture: Smooth flat surface, no snow texture, no fur, no gradients inside the body
- Effects: No blush, no glossy highlights, no strong shading, no dramatic lighting
- Size: Icon-scale character, approximately 1/6 of the total image height
- Personality conveyed: Calm, gentle, reliable, approachable
- Usage role: A supporting guide character inside infographics, not the main visual subject

Always render this character as a seamless snowman-inspired white mascot with only two slightly vertical oval eyes and a tiny subtle nose.
No visible separation between head and body. No outline. No mouth, no arms, no legs, no eyebrows, no bucket, no hat, no scarf, no buttons, no extra decorations.
The form must read through silhouette, background contrast, and soft shadow only.

Negative constraints:
- no visible line between head and body
- no separate circles
- no outline stroke
- no mouth
- no round dot eyes
- no realistic snowman
- no winter accessories
- no arms or legs
- no cartoon expression
- no decorative details
- no strong shadow
- no thick border
```

---

## 📐 共通レイアウト仕様

```
【共通レイアウト仕様】

Image format: Vertical/portrait orientation, 1080px × 1920px (9:16 ratio)
Style: Clean flat design infographic, Japanese UI/UX style
Color palette: 
  - Primary: Teal/mint (#4ECDC4)
  - Secondary: Soft coral (#FF6B6B)
  - Accent: Warm yellow (#FFE66D)
  - Background: Light gray-white (#F8F9FA)
  - Text: Dark charcoal (#2D3436)
Font style: Clean sans-serif, Japanese-friendly
Layout: Top title section → Character introduction → Main content sections → Bottom summary
Sections separated by soft rounded card containers with subtle drop shadows
All text in Japanese
Include the snowman mascot mascot character as described in the character definition
```

---


## 01. システム全体概要

```
【インフォグラフィック #01 - システム全体概要】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Large title text: "協力隊クリアベース"
  - Subtitle: "あなたの活動をまるごとサポートするシステム"
  - the snowman mascot appears in top-right corner, waving and smiling

Main visual (center):
  - Hub-and-spoke diagram with a central circle labeled "ポータル"
  - 8 surrounding circles connected by soft curved lines, each with an icon and label:
    1. 📅 スケジュール管理
    2. 📝 週次・月次報告
    3. 🎯 ミッション・プロジェクト
    4. 📣 SNS投稿管理
    5. 🏘️ 町民データベース
    6. 🎪 イベント管理
    7. 💬 相談・支援記録
    8. 📊 ダッシュボード
  - Each circle uses a different pastel color
  - Connecting lines are teal with small arrow indicators

Role section (below diagram):
  - Title: "4つの役割"
  - 4 horizontal cards side by side:
    1. 🟢 隊員（MEMBER）- 活動記録・報告
    2. 🔵 支援者（SUPPORT）- 隊員サポート
    3. 🟣 管理者（MASTER）- 全体管理
    4. 🟡 行政（GOVERNMENT）- 閲覧・確認
  - Each card has a small person icon and brief description

Bottom section:
  - the snowman mascot with speech bubble: "まずはダッシュボードからはじめよう！"
  - Small arrow pointing upward
```

---

## 02. ログイン・はじめかた

```
【インフォグラフィック #02 - ログイン・はじめかた】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "はじめかた"
  - Subtitle: "ログインからダッシュボードまで"
  - the snowman mascot on the left side, pointing right with a welcoming gesture

Step flow (main content):
  Vertical numbered step flow with connecting arrows between each step:

  STEP 1 - ログイン
    - Icon: 🔐 lock icon
    - Screenshot mockup: Simple login form with email/password fields
    - Caption: "管理者から発行されたメールアドレスとパスワードでログイン"

  STEP 2 - ダッシュボード表示
    - Icon: 🏠 home icon
    - Screenshot mockup: Dashboard with multiple widget cards
    - Caption: "ログイン後はダッシュボードが表示されます"

  STEP 3 - ウィジェットカスタマイズ
    - Icon: ⚙️ settings icon
    - Screenshot mockup: Widget selection modal
    - Caption: "右上の設定ボタンで表示するウィジェットを自由に変更できます"

  STEP 4 - サイドバーでナビゲート
    - Icon: 📋 menu icon
    - Screenshot mockup: Sidebar with menu items highlighted
    - Caption: "左のメニューから各機能へアクセスできます"

Bottom tip card:
  - Background: Soft yellow
  - the snowman mascot with lightbulb icon
  - Text: "💡 プロフィール設定でアバターカラーや表示名を変更できます"
```

---

## 03. ダッシュボード

```
【インフォグラフィック #03 - ダッシュボード】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "ダッシュボード"
  - Subtitle: "あなたの活動状況を一目で確認"
  - the snowman mascot floating above the title with sparkle effects

Main visual (center):
  - Large mockup of dashboard screen (portrait orientation)
  - Annotated with numbered callout bubbles pointing to different areas:
    1. 今週のスケジュール - "今週の予定が一覧で見える"
    2. プロジェクト進捗 - "進行中のプロジェクトの状況"
    3. タスク一覧 - "やるべきことをすぐ確認"
    4. SNS投稿状況 - "今週の投稿達成状況"
    5. イベント参加ポイント - "参加ポイントの累計"
    6. お知らせ - "重要なお知らせをバナー表示"

Widget grid section (below mockup):
  - Title: "表示できるウィジェット一覧"
  - 3×3 grid of small widget preview cards:
    - 週次スケジュール / ミッション / プロジェクト
    - タスク / イベント / SNS履歴
    - SNSリンク / 町民データベース / 次のやりたいこと

Customize tip (bottom):
  - the snowman mascot holding a wrench icon
  - Speech bubble: "右上の「カスタマイズ」ボタンで自分好みに並べ替えできるよ！"
```

---


## 04. スケジュール管理

```
【インフォグラフィック #04 - スケジュール管理】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "スケジュール管理"
  - Subtitle: "活動予定を記録・共有しよう"
  - the snowman mascot holding a calendar icon

Main visual - Calendar mockup (upper center):
  - Weekly calendar view mockup showing Mon-Sun
  - Sample schedule entries in different colors:
    - 青: 地域イベント参加
    - 緑: 農業体験活動
    - オレンジ: 役場打ち合わせ
  - Annotation: "色分けで活動の種類がひと目でわかる"

Feature cards (middle section):
  3 horizontal feature cards:
  1. ➕ 予定を追加
     - "タイトル・日時・場所・メモを入力"
     - Small form mockup
  2. 📍 場所を記録
     - "登録済みの場所から選択可能"
     - Location pin icon
  3. 👥 チームで共有
     - "支援者・管理者も確認できる"
     - People icon

How-to steps (lower section):
  - Title: "予定の追加方法"
  - 3-step horizontal flow:
    STEP 1: カレンダーの日付をクリック
    STEP 2: タイトル・時間・場所を入力
    STEP 3: 保存して完了！
  - Each step has a small icon and brief description

Bottom tip:
  - the snowman mascot with speech bubble: "週次報告と連携しているので、スケジュールを入れておくと報告書作成がラクになるよ！"
```

---

## 05. ミッション・プロジェクト・タスク（目標管理）

```
【インフォグラフィック #05 - 目標管理の4階層構造】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "目標管理のしくみ"
  - Subtitle: "大きな夢を小さなステップに分解しよう"
  - the snowman mascot at top with a mountain/goal icon

Hierarchy diagram (main visual - center):
  - Vertical pyramid/tree structure showing 4 levels:

  Level 1 (top, largest): 🎯 ミッション
    - Color: Deep teal
    - Description: "活動の大きな方向性・使命"
    - Example: "農業の担い手を増やす"

  Level 2: 📁 プロジェクト
    - Color: Medium blue
    - Description: "ミッション達成のための具体的な取り組み"
    - Example: "農業体験イベントの企画・運営"
    - Badge: "承認フロー付き"

  Level 3: ✅ タスク（プロジェクト内）
    - Color: Soft green
    - Description: "プロジェクトを進めるための作業"
    - Example: "会場の手配・参加者募集"

  Level 4 (bottom): 📌 独立タスク
    - Color: Warm orange
    - Description: "プロジェクトに紐づかない日常タスク"
    - Example: "週次報告書の提出"

  Connecting arrows between levels with label: "分解して管理"

Status flow (lower section):
  - Title: "プロジェクトのステータス"
  - Horizontal flow with arrows:
    準備中 → 実行中 → レビュー中 → 完了
  - Each status has a color dot indicator

Bottom section:
  - the snowman mascot with speech bubble: "ミッションから逆算して考えると、毎日の活動に意味が生まれるよ！"
```

---

## 06. 週次報告

```
【インフォグラフィック #06 - 週次報告】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "週次報告"
  - Subtitle: "1週間の活動をまとめて提出しよう"
  - the snowman mascot holding a pen/document icon

Weekly cycle visual (upper center):
  - Circular flow diagram showing the weekly cycle:
    月曜 → 活動する → 記録する → 金曜 → 報告書作成 → 提出 → 月曜（次週）
  - Each step has a small icon
  - Highlight: "毎週金曜が目安"

Report contents section (middle):
  - Title: "報告書に含まれる内容"
  - Card grid (2×3):
    1. 📅 活動日程 - "その週のスケジュール"
    2. 📝 活動内容 - "何をしたか詳細記録"
    3. 🎯 目標進捗 - "ミッション・プロジェクトの進み具合"
    4. 💭 所感・気づき - "感じたこと・学んだこと"
    5. 📣 SNS投稿 - "今週の投稿実績"
    6. 📋 来週の予定 - "次週の活動計画"

Auto-fill tip (lower section):
  - Highlighted card with star icon
  - Title: "スケジュールから自動入力"
  - Description: "事前にスケジュールを登録しておくと、報告書の活動日程が自動で埋まります"
  - Before/After mockup showing empty form → pre-filled form

Bottom section:
  - the snowman mascot with speech bubble: "支援者・管理者がレビューして承認するフローになっているよ！"
```

---


## 07. 月次報告

```
【インフォグラフィック #07 - 月次報告】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "月次報告"
  - Subtitle: "1ヶ月の活動を自動集計してまとめる"
  - the snowman mascot with a bar chart icon
  - Role badge: "支援者・管理者・行政 向け"

Auto-generation flow (main visual):
  - Large horizontal flow diagram:

  Input sources (left column, 3 items with icons):
    📅 週次報告 × 4週分
    📣 SNS投稿実績
    🎪 イベント参加記録

  Center: Large arrow with label "自動集計"
  the snowman mascot standing next to the arrow with a magic wand

  Output (right): Monthly report preview mockup showing:
    - 活動日数・時間の集計
    - プロジェクト進捗サマリー
    - SNS投稿数グラフ
    - イベント参加ポイント

Report sections breakdown (lower section):
  - Title: "月次報告の構成"
  - Vertical accordion-style cards:
    1. 📊 活動実績サマリー
    2. 🎯 ミッション・プロジェクト進捗
    3. 📣 SNS活動状況
    4. 🏘️ 地域連携・イベント参加
    5. 💬 課題・改善点
    6. 📅 翌月の活動計画

Bottom tip:
  - the snowman mascot with speech bubble: "週次報告をしっかり書いておくと、月次報告がボタン1つで自動生成できるよ！"
```

---

## 08. SNS投稿管理

```
【インフォグラフィック #08 - SNS投稿管理】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "SNS投稿管理"
  - Subtitle: "地域の魅力を発信・記録しよう"
  - the snowman mascot with social media icons floating around (Instagram, Twitter/X, Facebook, TikTok)

Why SNS section (upper middle):
  - Title: "なぜSNS投稿を記録するの？"
  - 3 reason cards in a row:
    1. 📢 地域PRのため - "活動を広く発信して認知度アップ"
    2. 📊 活動実績として - "報告書に自動反映される"
    3. 🎯 目標管理として - "週の投稿目標を達成しよう"

Weekly status visual (center):
  - Title: "週次投稿状況"
  - 7-day grid (Mon-Sun) showing:
    - Green checkmark circles: 投稿済み
    - Gray empty circles: 未投稿
    - Teal highlighted circle: 今日
  - Progress bar below: "今週の達成率 5/7"
  - the snowman mascot cheering next to the progress bar

How to record (lower section):
  - Title: "投稿の記録方法"
  - 4-step horizontal flow:
    STEP 1: SNS投稿ページを開く
    STEP 2: 「投稿を追加」をクリック
    STEP 3: プラットフォーム・URL・投稿日を入力
    STEP 4: フォロワー数も記録できる

Bottom tip:
  - the snowman mascot with speech bubble: "投稿記録は週次報告・月次報告に自動で反映されるよ！"
```

---

## 09. イベント管理・参加ポイント

```
【インフォグラフィック #09 - イベント管理・参加ポイント】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "イベント管理"
  - Subtitle: "地域イベントへの参加を記録・集計"
  - the snowman mascot wearing a party hat, excited expression

Event types section (upper middle):
  - Title: "イベントの種類"
  - 3 category cards:
    1. 🏘️ 地域行事 - "祭り・清掃活動など"
    2. 🤝 連携イベント - "他団体との協働"
    3. 📚 研修・勉強会 - "スキルアップ活動"

Point system visual (center):
  - Title: "参加ポイントシステム"
  - Large circular gauge/meter showing point accumulation
  - Point earning examples in cards:
    - イベント参加: +10pt
    - 運営スタッフ: +20pt
    - 企画・主催: +30pt
  - the snowman mascot pointing at the gauge with a smile

Event flow (lower section):
  - Title: "イベント参加の流れ"
  - Horizontal step flow:
    STEP 1: イベントを確認 → STEP 2: 参加登録 → STEP 3: 参加後に記録 → STEP 4: ポイント自動加算
  - Each step has icon and brief description

Summary card (bottom):
  - the snowman mascot with speech bubble: "参加ポイントはダッシュボードのウィジェットでいつでも確認できるよ！"
```

---


## 10. 視察復命書

```
【インフォグラフィック #10 - 視察復命書】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "視察復命書"
  - Subtitle: "視察・研修の内容を正式に記録・提出"
  - the snowman mascot with a clipboard and magnifying glass

What is it section (upper middle):
  - Highlighted explanation card:
    - Title: "復命書とは？"
    - Description: "視察や研修に参加した後、その内容・学び・今後への活用を報告する公式文書"
    - Icon: 📋 official document icon

Document contents (center):
  - Title: "復命書の記載内容"
  - Vertical checklist-style cards:
    ✅ 視察・研修の名称
    ✅ 実施日時・場所
    ✅ 参加目的
    ✅ 視察・研修の内容
    ✅ 所感・学んだこと
    ✅ 今後の活動への活用方法

Submission flow (lower section):
  - Title: "提出の流れ"
  - 3-step flow with icons:
    1. 📝 復命書を作成 → 2. 👀 支援者がレビュー → 3. ✅ 承認・完了
  - Status badges: 下書き / 提出済み / 承認済み

Bottom tip:
  - the snowman mascot with speech bubble: "テンプレートを使えば、毎回ゼロから書かなくてOK！"
```

---

## 11. 相談・支援記録

```
【インフォグラフィック #11 - 相談・支援記録】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "相談・支援記録"
  - Subtitle: "隊員と支援者をつなぐコミュニケーション機能"
  - the snowman mascot with two people icons connected by a heart

Two-perspective layout (main visual):
  - Split screen design showing two perspectives side by side:

  Left side (teal background): 隊員（MEMBER）視点
    - Icon: 👤 person icon
    - Features:
      ✉️ 相談を送る
      📋 相談履歴を確認
      💬 支援者からの返信を受け取る

  Right side (coral background): 支援者（SUPPORT）視点
    - Icon: 🤝 support icon
    - Features:
      📥 相談を受け取る
      📝 支援内容を記録
      📊 支援履歴を管理

Center divider: the snowman mascot in the middle with arrows pointing both ways

Consultation flow (lower section):
  - Title: "相談の流れ"
  - Horizontal timeline:
    隊員が相談を投稿 → 支援者に通知 → 支援者が対応・記録 → 解決・クローズ
  - Each step has a small icon

Bottom tip:
  - the snowman mascot with speech bubble: "面談のスケジュールもここから管理できるよ！"
```

---

## 12. 活動経費管理

```
【インフォグラフィック #12 - 活動経費管理】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "活動経費管理"
  - Subtitle: "活動にかかった費用を記録・申請"
  - the snowman mascot holding a receipt/wallet icon

Expense recording visual (center):
  - Large expense entry form mockup with annotations:
    - 日付フィールド: "いつの経費か"
    - 金額フィールド: "いくらかかったか"
    - カテゴリ選択: "交通費・消耗品・その他"
    - 活動との紐付け: "どの活動のための経費か"
    - メモ欄: "詳細・備考"

Monthly summary visual (lower center):
  - Bar chart mockup showing monthly expense totals
  - Category breakdown pie chart
  - Title: "月別・カテゴリ別に集計"

Approval flow (lower section):
  - Title: "申請・承認フロー"
  - 4-step horizontal flow:
    1. 💰 経費を記録 → 2. 📤 申請を提出 → 3. 👀 管理者が確認 → 4. ✅ 承認・精算
  - Status badges: 記録中 / 申請済み / 承認済み

Bottom tip:
  - the snowman mascot with speech bubble: "レシートの内容をすぐ入力する習慣をつけると月末がラクになるよ！"
```

---


## 13. 町民データベース（コンタクト管理）

```
【インフォグラフィック #13 - 町民データベース】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "町民データベース"
  - Subtitle: "地域の人とのつながりを記録・管理"
  - the snowman mascot with a community/people network icon

What to record section (upper middle):
  - Title: "記録できる情報"
  - 2×3 card grid with icons:
    👤 氏名・連絡先
    🏠 住所・地区
    💼 職業・専門分野
    🤝 関わり方・関係性
    📅 最終連絡日
    📝 メモ・特記事項

Use cases section (center):
  - Title: "こんな時に役立つ"
  - 3 scenario cards with illustrations:
    1. 🌾 農業の相談相手を探したい
       → 農業関係者でフィルタリング
    2. 📢 イベントの告知をしたい
       → 地区・属性で絞り込み
    3. 🤝 協力者を探したい
       → 専門分野で検索

Search & filter visual (lower section):
  - Title: "かんたん検索・絞り込み"
  - Search bar mockup with filter chips:
    [地区: 長沼] [職業: 農業] [関係: 協力者]
  - Results list mockup showing 3 contact cards

Bottom tip:
  - the snowman mascot with speech bubble: "ダッシュボードのウィジェットからも素早くアクセスできるよ！"
```

---

## 14. やりたいこと100リスト

```
【インフォグラフィック #14 - やりたいこと100リスト】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "やりたいこと100"
  - Subtitle: "活動の夢・目標を100個書き出そう"
  - the snowman mascot with a starry-eyed excited expression, surrounded by small star sparkles

Concept explanation (upper middle):
  - Highlighted card with warm yellow background:
    - Title: "やりたいこと100とは？"
    - Description: "任期中にやりたいこと・達成したいことを100個リストアップする自己目標管理ツール"
    - the snowman mascot with a lightbulb

List visual (center):
  - Mockup of the wish list showing numbered items:
    1. ✅ 地元の農家さんと一緒に田植えをする（達成済み）
    2. ✅ 地域の祭りで出店する（達成済み）
    3. 🔲 移住者向けガイドブックを作る
    4. 🔲 農業体験ツアーを企画する
    5. 🔲 地元食材のレシピ本を作る
    ...
  - Progress indicator: "達成 23/100"
  - Circular progress ring showing 23%

Achievement celebration (lower section):
  - Title: "達成したら..."
  - 3 cards:
    1. ✅ チェックして達成記録
    2. 📊 達成率がグラフで見える
    3. 🎯 次の目標へのモチベーションに

Bottom section:
  - the snowman mascot with confetti/celebration effects
  - Speech bubble: "100個全部達成を目指してみよう！ダッシュボードで次のやりたいことが表示されるよ！"
```

---

## 15. 通知・お知らせ・受信箱

```
【インフォグラフィック #15 - 通知・お知らせ・受信箱】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "通知・お知らせ"
  - Subtitle: "大切な情報を見逃さないために"
  - the snowman mascot with a bell icon, alert expression

Notification types (main visual):
  - Title: "通知の種類"
  - 4 notification type cards with colored left borders:

    🔴 緊急お知らせ（赤）
    - "管理者からの重要なお知らせ"
    - "ページ上部にバナー表示"

    🔵 承認通知（青）
    - "報告書・プロジェクトの承認結果"
    - "受信箱に届く"

    🟡 リマインダー（黄）
    - "週次報告の提出期限など"
    - "期限前に自動通知"

    🟢 システム通知（緑）
    - "新機能・メンテナンス情報"
    - "お知らせページで確認"

Inbox visual (lower center):
  - Title: "受信箱"
  - Inbox mockup showing message list:
    - 未読バッジ付きメッセージ
    - 既読メッセージ
    - 重要フラグ付きメッセージ

Bottom tip:
  - the snowman mascot with speech bubble: "ヘッダーのベルアイコンで未読通知の数が確認できるよ！"
```

---


## 16. 設定・ユーザー管理

```
【インフォグラフィック #16 - 設定・ユーザー管理】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "設定・ユーザー管理"
  - Subtitle: "プロフィールとシステムをカスタマイズ"
  - the snowman mascot with a gear/settings icon

Settings categories (main visual):
  - Title: "設定メニューの構成"
  - 4 large setting category cards arranged vertically:

  Card 1: 👤 プロフィール設定（全員）
    - アバターカラーの変更
    - 表示名の変更
    - パスワード変更

  Card 2: 👥 ユーザー管理（管理者）
    - 新規ユーザーの招待
    - 役割（ロール）の設定
    - アカウントの有効化・無効化

  Card 3: 📍 場所管理（全員）
    - よく使う場所を登録
    - スケジュール入力時に選択可能

  Card 4: 📄 テンプレート設定（支援者・管理者）
    - 報告書テンプレートの作成
    - 復命書テンプレートの管理

Role permissions table (lower section):
  - Title: "役割ごとのアクセス権限"
  - Simple table:
    | 機能 | 隊員 | 支援者 | 管理者 | 行政 |
    | ユーザー管理 | 自分のみ | ○ | ○ | 閲覧 |
    | 月次報告 | - | ○ | ○ | 閲覧 |
    | テンプレート | - | ○ | ○ | - |
    | 全ユーザー閲覧 | - | ○ | ○ | ○ |

Bottom tip:
  - the snowman mascot with speech bubble: "Googleドライブのリンクも登録しておくと、ダッシュボードからすぐアクセスできるよ！"
```

---

## 17. 面談管理

```
【インフォグラフィック #17 - 面談管理】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "面談管理"
  - Subtitle: "定期面談のスケジュールと記録を管理"
  - the snowman mascot with two people talking icon
  - Role badge: "支援者・管理者・行政 向け"

Monthly schedule visual (center):
  - Title: "月次面談スケジュール"
  - Calendar grid mockup showing a month view
  - Interview slots highlighted in teal
  - Each slot shows: 隊員名 + 時間
  - Annotation arrows pointing to:
    - "月ごとにスケジュールを設定"
    - "複数の隊員の面談を一元管理"

Interview record cards (lower center):
  - Title: "面談記録の内容"
  - Checklist card:
    ✅ 面談日時・場所
    ✅ 参加者
    ✅ 活動状況の確認
    ✅ 課題・悩みの共有
    ✅ 次回までのアクション
    ✅ 支援者のコメント

Flow section (bottom):
  - Title: "面談の流れ"
  - 3-step horizontal flow:
    1. 📅 月次スケジュールを設定 → 2. 🗣️ 面談を実施 → 3. 📝 記録を保存
  - the snowman mascot at the end with a thumbs up

Bottom tip:
  - the snowman mascot with speech bubble: "面談記録は支援記録と連携して、隊員のサポート履歴として蓄積されるよ！"
```

---

## 18. 全体ワークフロー（まとめ）

```
【インフォグラフィック #18 - 全体ワークフロー（まとめ）】

Apply the common layout specs and the snowman mascot character definition above.

Title section (top):
  - Title: "1週間の使い方フロー"
  - Subtitle: "ポータルを最大限に活用しよう"
  - the snowman mascot at top center with arms spread wide, welcoming

Weekly workflow timeline (main visual - large):
  - Vertical timeline showing Mon-Sun with activities:

  月曜日 🌅
    - 今週のスケジュールを確認（ダッシュボード）
    - タスクの優先順位を確認

  火〜木曜日 💪
    - 活動を実施
    - スケジュールに記録
    - SNS投稿を記録
    - 経費が発生したら即記録

  金曜日 📝
    - 週次報告書を作成・提出
    - 来週の予定を入力

  随時 🔔
    - 相談があれば支援者へ
    - イベント参加を記録
    - プロジェクト進捗を更新

  月末 📊
    - 月次報告の確認（支援者・管理者）
    - 活動経費の申請

  Each day has a small icon and 2-3 bullet points
  Timeline uses alternating left-right layout for visual interest

Benefits summary (lower section):
  - Title: "継続して使うと..."
  - 3 benefit cards with upward arrow icons:
    1. 📈 活動の可視化 - "何をどれだけやったか一目瞭然"
    2. 📝 報告書が楽に - "記録があれば報告書は自動生成"
    3. 🤝 支援が充実 - "状況が見えると支援者もサポートしやすい"

Bottom section:
  - the snowman mascot with big smile and speech bubble:
    "毎日少しずつ記録するのがコツ！まずはスケジュールとSNS投稿から始めてみよう！"
  - Small decorative stars and sparkles around the snowman mascot
```

---

## 📝 画像生成時の注意事項

- 各プロンプトの冒頭に必ず「固定キャラクター定義」と「共通レイアウト仕様」を含めてください
- キャラクター（スノーマスコット）のデザインは全画像で統一してください
- 日本語テキストは画像生成AIによっては正確に描画されない場合があります。テキスト部分は後から画像編集ツールで追加することを推奨します
- モックアップ・スクリーンショット部分は実際のUIに近いデザインで生成してください
- 縦長（1080×1920px）を基本としていますが、生成AIの制約に応じて9:16比率を維持しつつサイズを調整してください
- Midjourney、DALL-E 3、Stable Diffusionなど各ツールの特性に合わせてプロンプトを微調整してください

---

*作成日: 2026年4月*
*対象システム: 協力隊クリアベースシステム*
