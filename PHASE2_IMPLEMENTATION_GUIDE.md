# Phase 2 実装ガイド

このドキュメントは、Phase 2の完全な実装手順を提供します。

## 実装状況

### ✅ 完了
1. **Prismaスキーマ更新** - 全Phase 2モデル追加済み
2. **進捗計算サービス** - `src/services/progressCalculator.ts`
3. **重み計算サービス** - `src/services/weightCalculator.ts`
4. **月次報告生成サービス** - `src/services/monthlyReportGenerator.ts`
5. **目標管理API** - `src/routes/goals.ts`

### 🔨 残りの実装タスク

## 1. バックエンドAPI実装

### A. プロジェクト管理API (`src/routes/projects.ts`)

```typescript
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// プロジェクト一覧取得
router.get('/', async (req: AuthRequest, res) => {
  const { userId } = req.query;

  const where: any = {};
  if (userId) {
    where.userId = userId;
  } else if (req.user!.role === 'MEMBER') {
    where.userId = req.user!.id;
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      user: true,
      members: { include: { user: true } },
      tasks: true,
      goal: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(projects);
});

// プロジェクト作成
router.post('/', async (req: AuthRequest, res) => {
  const { projectName, description, startDate, endDate, goalId, memberIds, tags } = req.body;

  const project = await prisma.project.create({
    data: {
      userId: req.user!.id,
      projectName,
      description,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      goalId,
      tags: tags || [],
      members: {
        create: (memberIds || []).map((userId: string) => ({
          userId,
          role: 'SUPPORT',
        })),
      },
    },
    include: {
      members: { include: { user: true } },
    },
  });

  res.status(201).json(project);
});

// プロジェクトタスク作成
router.post('/:projectId/tasks', async (req, res) => {
  const { projectId } = req.params;
  const { taskName, assignedTo, deadline } = req.body;

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      taskName,
      assignedTo,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  res.status(201).json(task);
});

// プロジェクト承認
router.post('/:id/approve', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { approvalStatus, comment } = req.body;

  const project = await prisma.project.update({
    where: { id },
    data: {
      approvalStatus,
      approvalComment: comment,
      approvedBy: req.user!.id,
      approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
    },
  });

  res.json(project);
});

export default router;
```

### B. イベント管理API (`src/routes/events.ts`)

```typescript
import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// イベント一覧
router.get('/', async (req, res) => {
  const { type, year } = req.query;

  const where: any = {};
  if (type) {
    where.eventType = type;
  }
  if (year) {
    where.date = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${Number(year) + 1}-01-01`),
    };
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      location: true,
      participations: { include: { user: true } },
    },
    orderBy: { date: 'desc' },
  });

  res.json(events);
});

// イベント作成
router.post('/', async (req: AuthRequest, res) => {
  const data = req.body;

  const event = await prisma.event.create({
    data: {
      ...data,
      date: new Date(data.date),
      createdBy: req.user!.id,
    },
  });

  res.status(201).json(event);
});

// イベント参加登録
router.post('/:eventId/participate', async (req: AuthRequest, res) => {
  const { eventId } = req.params;
  const { participationType } = req.body;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // ポイント計算
  let pointEarned = 0;
  if (event.eventType === 'TOWN_OFFICIAL') {
    if (participationType === 'PARTICIPATION') {
      pointEarned = event.participationPoint;
    } else if (participationType === 'PREPARATION') {
      pointEarned = event.preparationPoint;
    }
  }

  const participation = await prisma.eventParticipation.create({
    data: {
      eventId,
      userId: req.user!.id,
      participationType,
      pointEarned,
    },
  });

  res.status(201).json(participation);
});

// ポイント集計取得
router.get('/points/:userId', async (req, res) => {
  const { userId } = req.params;
  const { year } = req.query;

  const where: any = {
    userId,
    event: {
      eventType: 'TOWN_OFFICIAL',
    },
  };

  if (year) {
    where.event.date = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${Number(year) + 1}-01-01`),
    };
  }

  const participations = await prisma.eventParticipation.findMany({
    where,
    include: {
      event: true,
    },
  });

  const totalPoints = participations.reduce((sum, p) => sum + p.pointEarned, 0);

  res.json({
    totalPoints,
    participations,
  });
});

export default router;
```

### C. SNS投稿管理API (`src/routes/snsPosts.ts`)

```typescript
import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 週の投稿状況取得
router.get('/:userId/:week', async (req, res) => {
  const { userId, week } = req.params;

  const post = await prisma.sNSPost.findUnique({
    where: {
      userId_week: { userId, week },
    },
    include: {
      user: true,
    },
  });

  res.json(post);
});

// 投稿記録
router.post('/', async (req, res) => {
  const { userId, week, postDate, postType } = req.body;

  const post = await prisma.sNSPost.upsert({
    where: {
      userId_week: { userId, week },
    },
    update: {
      postDate: postDate ? new Date(postDate) : null,
      postType,
      isPosted: true,
    },
    create: {
      userId,
      week,
      postDate: postDate ? new Date(postDate) : null,
      postType,
      isPosted: true,
    },
  });

  res.json(post);
});

// 未投稿者一覧
router.get('/unpublished', async (req, res) => {
  const { week } = req.query;

  const unpublished = await prisma.sNSPost.findMany({
    where: {
      week: week as string,
      isPosted: false,
    },
    include: {
      user: true,
    },
  });

  res.json(unpublished);
});

export default router;
```

### D. 月次報告API (`src/routes/monthlyReports.ts`)

```typescript
import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { generateMonthlyReport, addSupportRecord } from '../services/monthlyReportGenerator';

const router = Router();
router.use(authenticate);

// 月次報告一覧
router.get('/', async (req, res) => {
  const reports = await prisma.monthlyReport.findMany({
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: { month: 'desc' },
  });

  res.json(reports);
});

// 月次報告自動生成
router.post('/generate', authorize('MASTER', 'SUPPORT'), async (req: AuthRequest, res) => {
  try {
    const { month } = req.body;
    const report = await generateMonthlyReport(month, req.user!.id);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// 支援記録追加
router.post('/:id/support-records', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, supportDate, supportContent, supportBy } = req.body;

    const record = await addSupportRecord(id, {
      userId,
      supportDate: new Date(supportDate),
      supportContent,
      supportBy,
    });

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add support record' });
  }
});

export default router;
```

### E. 町民データベースAPI (`src/routes/contacts.ts`)

```typescript
import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 町民一覧
router.get('/', async (req, res) => {
  const contacts = await prisma.contact.findMany({
    include: {
      creator: { select: { id: true, name: true } },
      histories: {
        include: {
          user: true,
          project: true,
        },
        orderBy: { date: 'desc' },
        take: 3,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json(contacts);
});

// 町民作成
router.post('/', async (req: AuthRequest, res) => {
  const { name, organization, title, contactInfo, memo, tags } = req.body;

  const contact = await prisma.contact.create({
    data: {
      name,
      organization,
      title,
      contactInfo,
      memo,
      tags: tags || [],
      createdBy: req.user!.id,
    },
  });

  res.status(201).json(contact);
});

// 接触履歴追加
router.post('/:contactId/histories', async (req: AuthRequest, res) => {
  const { contactId } = req.params;
  const { date, content, projectId } = req.body;

  const history = await prisma.contactHistory.create({
    data: {
      contactId,
      userId: req.user!.id,
      date: new Date(date),
      content,
      projectId,
    },
  });

  res.status(201).json(history);
});

export default router;
```

### F. スケジュールAPI更新

`src/routes/schedules.ts` に以下を追加:

```typescript
// スケジュール作成時にプロジェクトと連携
router.post('/', async (req: AuthRequest, res) => {
  const data = req.body;

  const schedule = await prisma.schedule.create({
    data: {
      ...data,
      date: new Date(data.date),
      userId: req.user!.id,
      locationId: data.locationId,
      projectId: data.projectId, // Phase 2追加
      participants: data.participants || [],
    },
  });

  // タスク進捗更新があれば処理
  if (data.scheduleProgress) {
    await prisma.scheduleProgress.create({
      data: {
        scheduleId: schedule.id,
        ...data.scheduleProgress,
      },
    });
  }

  res.status(201).json(schedule);
});
```

### G. index.ts更新

`src/index.ts` に新しいルートを追加:

```typescript
import goalsRoutes from './routes/goals';
import projectsRoutes from './routes/projects';
import eventsRoutes from './routes/events';
import snsPostsRoutes from './routes/snsPosts';
import monthlyReportsRoutes from './routes/monthlyReports';
import contactsRoutes from './routes/contacts';

app.use('/api/goals', goalsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/sns-posts', snsPostsRoutes);
app.use('/api/monthly-reports', monthlyReportsRoutes);
app.use('/api/contacts', contactsRoutes);
```

## 2. バッチジョブ実装

### `src/jobs/generateDefaultSchedules.ts`

```typescript
import prisma from '../lib/prisma';
import { addDays } from 'date-fns';

export async function generateDefaultSchedules() {
  const missionUsers = await prisma.user.findMany({
    where: { missionType: 'MISSION' },
  });

  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(0, 0, 0, 0);

  const govWorkProject = await prisma.project.findFirst({
    where: { projectName: '役場業務' },
  });

  for (const user of missionUsers) {
    const exists = await prisma.schedule.findFirst({
      where: {
        userId: user.id,
        date: tomorrow,
        startTime: '09:00',
        endTime: '12:00',
      },
    });

    if (!exists) {
      await prisma.schedule.create({
        data: {
          userId: user.id,
          date: tomorrow,
          startTime: '09:00',
          endTime: '12:00',
          locationText: '役場',
          projectId: govWorkProject?.id,
          activityDescription: '役場業務（仮）',
          isTemplate: true,
          createdBy: 'TEMPLATE',
        },
      });
    }
  }

  console.log('✅ Default schedules generated');
}
```

### `src/jobs/generateSNSPosts.ts`

```typescript
import prisma from '../lib/prisma';
import { format, addWeeks } from 'date-fns';

export async function generateWeeklySNSPosts() {
  const users = await prisma.user.findMany({
    where: { role: 'MEMBER' },
  });

  const nextWeek = format(addWeeks(new Date(), 1), "yyyy-'W'II");

  for (const user of users) {
    await prisma.sNSPost.upsert({
      where: {
        userId_week: {
          userId: user.id,
          week: nextWeek,
        },
      },
      update: {},
      create: {
        userId: user.id,
        week: nextWeek,
      },
    });
  }

  console.log('✅ Weekly SNS posts generated');
}
```

## 3. シードデータ更新

`prisma/seed.ts` に追加:

```typescript
async function seedPhase2() {
  const masterUser = await prisma.user.findFirst({
    where: { role: 'MASTER' },
  });

  if (!masterUser) return;

  // 役場業務プロジェクト
  const govWorkProject = await prisma.project.create({
    data: {
      projectName: '役場業務',
      description: 'ミッション型隊員の定期業務',
      userId: masterUser.id,
      approvalStatus: 'APPROVED',
      approvedBy: masterUser.id,
      approvedAt: new Date(),
    },
  });

  // 未分類タスクプロジェクト
  await prisma.project.create({
    data: {
      projectName: '未分類タスク',
      description: 'プロジェクトに紐づかない活動',
      userId: masterUser.id,
      approvalStatus: 'APPROVED',
      approvedBy: masterUser.id,
      approvedAt: new Date(),
    },
  });

  // システム設定
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'annual_event_point_target',
        value: 10,
      },
      {
        key: 'uncategorized_task_warning_threshold',
        value: 0.3,
      },
    ],
  });

  console.log('✅ Phase 2 seed data created');
}

// main関数内で実行
await seedPhase2();
```

## 4. フロントエンド型定義更新

`frontend/src/types/index.ts` に追加:

```typescript
// Phase 2型定義
export interface Goal {
  id: string;
  userId: string;
  goalName: string;
  goalType: 'PRIMARY' | 'SUB';
  targetPercentage: number;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  progress?: number;
  midGoals: MidGoal[];
  createdAt: string;
}

export interface MidGoal {
  id: string;
  name: string;
  weight: number;
  progress?: number;
  subGoals: SubGoal[];
}

export interface SubGoal {
  id: string;
  name: string;
  weight: number;
  progress?: number;
  tasks: GoalTask[];
}

export interface GoalTask {
  id: string;
  name: string;
  weight: number;
  progress: number;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
}

export interface Project {
  id: string;
  projectName: string;
  description?: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  members: ProjectMember[];
  tasks: ProjectTask[];
}

export interface Event {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  participationPoint: number;
  preparationPoint: number;
  participations: EventParticipation[];
}
```

## 5. 実装手順

### ステップ1: マイグレーション実行

```bash
cd backend
npx prisma migrate dev --name phase2
npx prisma generate
```

### ステップ2: シード実行

```bash
npm run seed
```

### ステップ3: バックエンド動作確認

```bash
npm run dev
# 各APIエンドポイントをPostmanやcurlでテスト
```

### ステップ4: フロントエンド実装

主要ページを実装:
- `/goals` - 目標一覧・ツリー表示
- `/projects` - プロジェクト管理
- `/events` - イベント管理
- `/sns-posts` - SNS投稿状況
- `/reports/monthly` - 月次報告

### ステップ5: Docker再ビルド

```bash
docker-compose down
docker-compose up --build
```

## 6. 主要機能の使い方

### 起業準備進捗管理
1. 目標作成 → 中目標 → 小目標 → タスクの順に作成
2. 重み付けは手動または自動計算
3. タスクの進捗を更新すると上位階層が自動計算

### プロジェクト管理
1. プロジェクト作成
2. タスク追加
3. スケジュールとプロジェクトを紐付け
4. 承認フローで管理者が承認

### イベント管理
1. 町主催イベントを作成（ポイント設定）
2. 参加登録（参加/準備）
3. 年間ポイント集計

これで Phase 2 の全機能が実装可能です！
