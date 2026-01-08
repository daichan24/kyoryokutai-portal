# Phase 3 実装ガイド - 利便性向上機能

このドキュメントは、Phase 3の完全な実装手順を提供します。

## 実装状況

### ✅ 完了
1. **Prismaスキーマ更新** - ScheduleSuggestionモデル追加済み

### 🔨 実装タスク

## 1. クイック入力機能（自然文パース）

### フロントエンド実装

#### パーサーユーティリティ (`frontend/src/utils/quickInputParser.ts`)

```typescript
import { addDays, getDay } from 'date-fns';
import { Location, User, Project } from '../types';

export interface ParsedSchedule {
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  locationText: string | null;
  participants: string[];
  projectId: string | null;
  description: string;
  missingFields: string[];
}

export function parseQuickInput(
  text: string,
  locations: Location[],
  users: User[],
  projects: Project[]
): ParsedSchedule {
  const result: ParsedSchedule = {
    date: null,
    startTime: null,
    endTime: null,
    locationId: null,
    locationText: null,
    participants: [],
    projectId: null,
    description: text,
    missingFields: [],
  };

  // 日付パース
  result.date = parseDateFromText(text);
  if (!result.date) result.missingFields.push('日付');

  // 時刻パース
  const timeResult = parseTimeFromText(text);
  result.startTime = timeResult.startTime;
  result.endTime = timeResult.endTime;
  if (!result.startTime || !result.endTime) result.missingFields.push('時刻');

  // 場所パース
  for (const location of locations) {
    if (text.includes(location.name)) {
      result.locationId = location.id;
      result.locationText = location.name;
      break;
    }
  }

  // 参加者パース（○○さん）
  const participantMatches = text.matchAll(/([^\s、,]+)さん/g);
  for (const match of participantMatches) {
    const name = match[1];
    const user = users.find((u) => u.name.includes(name));
    if (user) {
      result.participants.push(user.id);
    }
  }

  // プロジェクトパース
  for (const project of projects) {
    if (text.includes(project.projectName)) {
      result.projectId = project.id;
      break;
    }
  }

  return result;
}

function parseDateFromText(text: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 明日
  if (text.includes('明日')) {
    return addDays(today, 1);
  }

  // 明後日
  if (text.includes('明後日')) {
    return addDays(today, 2);
  }

  // 今週○曜日
  const dayMatch = text.match(/今週(月|火|水|木|金|土|日)曜日/);
  if (dayMatch) {
    const dayMap: Record<string, number> = {
      日: 0,
      月: 1,
      火: 2,
      水: 3,
      木: 4,
      金: 5,
      土: 6,
    };
    const targetDay = dayMap[dayMatch[1]];
    return getNextDayOfWeek(today, targetDay);
  }

  // MM/DD形式
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = today.getFullYear();
    return new Date(year, month - 1, day);
  }

  // DD日
  const dayOnlyMatch = text.match(/(\d{1,2})日/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1]);
    const month = today.getMonth();
    const year = today.getFullYear();
    return new Date(year, month, day);
  }

  return null;
}

function parseTimeFromText(text: string): {
  startTime: string | null;
  endTime: string | null;
} {
  // HH:MM-HH:MM形式
  const timeMatch1 = text.match(/(\d{1,2}):(\d{2})[-~〜](\d{1,2}):(\d{2})/);
  if (timeMatch1) {
    return {
      startTime: `${timeMatch1[1].padStart(2, '0')}:${timeMatch1[2]}`,
      endTime: `${timeMatch1[3].padStart(2, '0')}:${timeMatch1[4]}`,
    };
  }

  // HH時-HH時形式
  const timeMatch2 = text.match(/(\d{1,2})時[-~〜](\d{1,2})時/);
  if (timeMatch2) {
    return {
      startTime: `${timeMatch2[1].padStart(2, '0')}:00`,
      endTime: `${timeMatch2[2].padStart(2, '0')}:00`,
    };
  }

  return { startTime: null, endTime: null };
}

function getNextDayOfWeek(from: Date, targetDay: number): Date {
  const currentDay = getDay(from);
  let daysToAdd = targetDay - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7;
  return addDays(from, daysToAdd);
}
```

#### QuickInputModal コンポーネント (`frontend/src/components/schedule/QuickInputModal.tsx`)

```typescript
import React, { useState } from 'react';
import { format } from 'date-fns';
import { parseQuickInput, ParsedSchedule } from '../../utils/quickInputParser';
import { Button } from '../common/Button';

interface QuickInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (parsed: ParsedSchedule) => void;
  locations: any[];
  users: any[];
  projects: any[];
}

export const QuickInputModal: React.FC<QuickInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  locations,
  users,
  projects,
}) => {
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedSchedule | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    const result = parseQuickInput(inputText, locations, users, projects);
    setParsedResult(result);
  };

  const handleSubmit = () => {
    if (!parsedResult) return;
    onSubmit(parsedResult);
    setInputText('');
    setParsedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 p-6">
        <h2 className="text-2xl font-bold mb-4">⚡ クイック入力</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            予定を自然な文章で入力してください
          </label>
          <textarea
            className="w-full border rounded-md p-3"
            rows={3}
            placeholder="例: 明日 10:00-12:00 ホワイトベースでAさんとプロジェクト準備"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            日付、時刻、場所、参加者、プロジェクト名を自然に記述できます
          </p>
        </div>

        <Button onClick={handleParse} className="mb-4">
          解析する
        </Button>

        {parsedResult && (
          <div className="border rounded-lg p-4 mb-4 space-y-3">
            <h3 className="font-semibold text-lg">解析結果:</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">日付:</span>
                <span
                  className={`text-sm font-medium ${
                    parsedResult.date ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {parsedResult.date
                    ? format(parsedResult.date, 'yyyy/MM/dd (E)')
                    : '❌ 不明'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">時刻:</span>
                <span
                  className={`text-sm font-medium ${
                    parsedResult.startTime ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {parsedResult.startTime && parsedResult.endTime
                    ? `${parsedResult.startTime}-${parsedResult.endTime}`
                    : '❌ 不明'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">場所:</span>
                <span
                  className={`text-sm font-medium ${
                    parsedResult.locationId ? 'text-green-600' : 'text-yellow-600'
                  }`}
                >
                  {parsedResult.locationText || '⚠️ 未設定'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">参加者:</span>
                <span className="text-sm font-medium">
                  {parsedResult.participants.length > 0
                    ? `${parsedResult.participants.length}名`
                    : 'なし'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">プロジェクト:</span>
                <span
                  className={`text-sm font-medium ${
                    parsedResult.projectId ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {parsedResult.projectId ? '✓ 設定済' : '未設定'}
                </span>
              </div>
            </div>

            {parsedResult.missingFields.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ 以下の項目が不足しています:{' '}
                  <span className="font-semibold">
                    {parsedResult.missingFields.join(', ')}
                  </span>
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  このまま保存する場合は、後で手動で入力してください
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!parsedResult}>
            このまま保存
          </Button>
        </div>
      </div>
    </div>
  );
};
```

## 2. 予定の自動紐付け機能

### バックエンド実装

#### スケジュールサービス (`backend/src/services/scheduleService.ts`)

```typescript
import prisma from '../lib/prisma';

export async function createScheduleWithSuggestions(
  scheduleData: any,
  suggestToUserIds: string[]
) {
  // 1. 予定作成
  const schedule = await prisma.schedule.create({
    data: scheduleData,
  });

  // 2. 各ユーザーに提案作成
  for (const userId of suggestToUserIds) {
    // 衝突チェック
    const conflicts = await checkScheduleConflicts(
      userId,
      scheduleData.date,
      scheduleData.startTime,
      scheduleData.endTime
    );

    await prisma.scheduleSuggestion.create({
      data: {
        scheduleId: schedule.id,
        suggestedTo: userId,
        conflictingSchedules: conflicts.map((c) => c.id),
      },
    });
  }

  return schedule;
}

export async function checkScheduleConflicts(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string
) {
  return await prisma.schedule.findMany({
    where: {
      userId,
      date,
      OR: [
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime },
        },
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
      ],
    },
  });
}

export async function respondToSuggestion(
  suggestionId: string,
  status: 'ACCEPTED' | 'DECLINED'
) {
  const suggestion = await prisma.scheduleSuggestion.update({
    where: { id: suggestionId },
    data: {
      status,
      respondedAt: new Date(),
    },
    include: { schedule: true },
  });

  // ACCEPTEDの場合、予定をコピー
  if (status === 'ACCEPTED') {
    const { id, createdAt, updatedAt, ...scheduleData } = suggestion.schedule;
    await prisma.schedule.create({
      data: {
        ...scheduleData,
        userId: suggestion.suggestedTo,
      },
    });
  }

  return suggestion;
}
```

#### APIルート (`backend/src/routes/scheduleSuggestions.ts`)

```typescript
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  createScheduleWithSuggestions,
  respondToSuggestion,
} from '../services/scheduleService';
import prisma from '../lib/prisma';

const router = Router();
router.use(authenticate);

// 予定作成時に複数人に提案
router.post('/with-suggestions', async (req: AuthRequest, res) => {
  try {
    const { schedule, suggestToUserIds } = req.body;

    const createdSchedule = await createScheduleWithSuggestions(
      {
        ...schedule,
        userId: req.user!.id,
        date: new Date(schedule.date),
      },
      suggestToUserIds
    );

    res.status(201).json(createdSchedule);
  } catch (error) {
    console.error('Create schedule with suggestions error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// 提案一覧取得
router.get('/suggestions', async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;

    const where: any = {
      suggestedTo: req.user!.id,
    };

    if (status) {
      where.status = status;
    }

    const suggestions = await prisma.scheduleSuggestion.findMany({
      where,
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// 提案に応答
router.post('/suggestions/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const suggestion = await respondToSuggestion(id, status);

    res.json(suggestion);
  } catch (error) {
    console.error('Respond to suggestion error:', error);
    res.status(500).json({ error: 'Failed to respond to suggestion' });
  }
});

export default router;
```

### フロントエンド実装

#### ScheduleSuggestionNotification (`frontend/src/components/schedule/ScheduleSuggestionNotification.tsx`)

```typescript
import React from 'react';
import { format } from 'date-fns';
import { Button } from '../common/Button';

export const ScheduleSuggestionNotification: React.FC = () => {
  const [suggestions, setSuggestions] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    // API call to get pending suggestions
    const response = await fetch('/api/schedule-suggestions/suggestions?status=PENDING');
    const data = await response.json();
    setSuggestions(data);
  };

  const handleRespond = async (id: string, status: 'ACCEPTED' | 'DECLINED') => {
    await fetch(`/api/schedule-suggestions/suggestions/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchSuggestions();
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="bg-white border shadow-lg rounded-lg p-4 max-w-sm"
        >
          <h4 className="font-semibold mb-2">📅 予定の提案</h4>
          <p className="text-sm text-gray-600 mb-1">
            {suggestion.schedule.user.name}さんからの提案
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {format(new Date(suggestion.schedule.date), 'M月d日')}{' '}
            {suggestion.schedule.startTime}-{suggestion.schedule.endTime}
          </p>
          <p className="text-sm mb-3">{suggestion.schedule.activityDescription}</p>

          {suggestion.conflictingSchedules &&
            suggestion.conflictingSchedules.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ 既存の予定と重複しています
                </p>
              </div>
            )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleRespond(suggestion.id, 'ACCEPTED')}
              className="flex-1"
            >
              追加する
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRespond(suggestion.id, 'DECLINED')}
              className="flex-1"
            >
              拒否
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 3. バッチジョブ

### 週末リマインダー (`backend/src/jobs/weekendReminder.ts`)

```typescript
import prisma from '../lib/prisma';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';

// 毎週金曜20時に実行
export async function sendWeekendReminder() {
  const users = await prisma.user.findMany({
    where: { role: 'MEMBER' },
  });

  for (const user of users) {
    // 保留中のスケジュールをチェック
    const pendingCount = await prisma.schedule.count({
      where: {
        userId: user.id,
        isPending: true,
      },
    });

    if (pendingCount > 0) {
      console.log(`週末リマインド: ${user.name} - 保留${pendingCount}件`);
      // TODO: 通知送信
    }

    // 次週のスケジュール入力チェック
    const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });

    const nextWeekSchedulesCount = await prisma.schedule.count({
      where: {
        userId: user.id,
        date: {
          gte: nextWeekStart,
          lte: nextWeekEnd,
        },
      },
    });

    if (nextWeekSchedulesCount === 0) {
      console.log(`週末リマインド: ${user.name} - 次週スケジュール未入力`);
      // TODO: 通知送信
    }
  }

  console.log('✅ Weekend reminders sent');
}
```

## 4. 実装手順

### ステップ1: マイグレーション実行

```bash
cd backend
npx prisma migrate dev --name phase3_suggestions
npx prisma generate
```

### ステップ2: バックエンドAPI実装

```bash
# サービスとAPIルートを作成
touch src/services/scheduleService.ts
touch src/routes/scheduleSuggestions.ts
touch src/jobs/weekendReminder.ts
```

### ステップ3: index.ts更新

```typescript
// src/index.ts に追加
import scheduleSuggestionsRoutes from './routes/scheduleSuggestions';

app.use('/api/schedule-suggestions', scheduleSuggestionsRoutes);
```

### ステップ4: フロントエンド実装

```bash
cd frontend
# ユーティリティとコンポーネントを作成
touch src/utils/quickInputParser.ts
touch src/components/schedule/QuickInputModal.tsx
touch src/components/schedule/ScheduleSuggestionNotification.tsx
```

### ステップ5: 動作確認

```bash
docker-compose down
docker-compose up --build
```

## Phase 3の主要機能

1. **クイック入力** - 自然文から予定を自動パース
2. **予定提案** - 複数人へ予定を一括提案・衝突検知
3. **テンプレート** - 定型予定の効率化
4. **繰り返し** - 定期的な予定の一括作成
5. **ドラッグ&ドロップ** - 直感的なカレンダー操作
6. **ダッシュボードカスタマイズ** - ウィジェット並び替え
7. **進捗保留モード** - 未更新項目の管理
8. **週末リマインダー** - 自動通知

これでPhase 3の基本機能が実装可能です！
