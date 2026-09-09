import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const delegate = () => Object.fromEntries(
    ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'updateMany', 'delete', 'deleteMany']
      .map((key) => [key, vi.fn()]),
  );
  return {
    task: delegate(),
    schedule: delegate(),
    event: delegate(),
    project: delegate(),
    projectTask: delegate(),
    compensatoryLeave: delegate(),
    timeAdjustment: delegate(),
    $transaction: vi.fn(),
  };
});

vi.mock('../lib/prisma', () => ({ default: db }));
vi.mock('../services/defaultWorkProjectService', () => ({
  ensureDefaultWorkMissionProject: vi.fn(),
  isDefaultWorkLinkKind: vi.fn().mockReturnValue(false),
}));
vi.mock('../services/approvalEmailService', () => ({
  notifyCompensatoryLeaveSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyTimeAdjustmentSubmitted: vi.fn().mockResolvedValue(undefined),
}));

import tasksRouter from './tasks';
import { generateWeeklyReportDraft } from '../services/weeklyReportGenerator';

const userId = '11111111-1111-4111-8111-111111111111';
const missionId = '22222222-2222-4222-8222-222222222222';
const taskId = '33333333-3333-4333-8333-333333333333';
const scheduleId = '44444444-4444-4444-8444-444444444444';
const activityDate = new Date(2026, 8, 8, 12, 0, 0);

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

async function updateTask(body: Record<string, unknown>) {
  const layer = tasksRouter.stack.find(
    (candidate) => candidate.route?.path === '/missions/:missionId/tasks/:id'
      && candidate.route.methods.put,
  );
  const handler = layer!.route.stack.at(-1).handle;
  const res = response();
  await handler({
    body,
    params: { missionId, id: taskId },
    query: {},
    user: { id: userId, role: 'MEMBER', email: 'member@example.test' },
    authContext: { kind: 'SESSION' },
  }, res);
  return res;
}

function linkedTask(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    missionId,
    projectId: null,
    title: 'Work',
    description: 'Existing description',
    status: 'IN_PROGRESS',
    order: 0,
    dueDate: activityDate,
    linkKind: 'UNSET',
    createdAt: activityDate,
    updatedAt: activityDate,
    mission: { id: missionId, missionName: 'Mission', userId },
    project: null,
    ...overrides,
  };
}

function holidayWorkSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: scheduleId,
    userId,
    taskId,
    date: activityDate,
    startDate: activityDate,
    endDate: activityDate,
    startTime: '09:00',
    endTime: '17:00',
    title: 'Work',
    activityDescription: 'Work',
    locationText: null,
    reportable: true,
    deletedAt: null,
    isTemplate: false,
    isHolidayWork: true,
    compensatoryLeaveRequired: true,
    compensatoryLeaveType: 'FULL_DAY',
    project: null,
    task: { title: 'Work', linkKind: 'UNSET', mission: { missionName: 'Mission' } },
    location: null,
    scheduleParticipants: [],
    scheduleProgress: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.task.findUnique.mockResolvedValue(linkedTask());
  db.task.update.mockImplementation(async ({ data }) => linkedTask({ ...data }));
  db.schedule.findFirst.mockResolvedValue(holidayWorkSchedule());
  db.schedule.update.mockImplementation(async ({ data }) => holidayWorkSchedule({ ...data }));
  db.compensatoryLeave.findFirst.mockResolvedValue({ id: 'existing-leave' });
  db.compensatoryLeave.findMany.mockResolvedValue([{ id: 'existing-leave', usages: [] }]);
  db.compensatoryLeave.update.mockImplementation(async ({ data }) => ({ id: 'existing-leave', ...data }));
  db.event.findMany.mockResolvedValue([]);
  db.projectTask.findMany.mockResolvedValue([]);
});

describe('task holiday-work compensation synchronization', () => {
  it.each([
    ['status-only', { status: 'COMPLETED' }],
    ['title-only', { title: 'Renamed work' }],
  ])('%s update preserves unused grants from the persisted linked schedule', async (_name, body) => {
    const res = await updateTask(body);

    expect(res.statusCode).toBe(200);
    expect(db.compensatoryLeave.deleteMany).not.toHaveBeenCalled();
    expect(db.timeAdjustment.deleteMany).not.toHaveBeenCalled();
  });

  it('explicit holiday-work clearing removes unused grants', async () => {
    const res = await updateTask({ isHolidayWork: false });

    expect(res.statusCode).toBe(200);
    expect(db.timeAdjustment.deleteMany).toHaveBeenCalledWith({
      where: { sourceScheduleId: scheduleId, userId },
    });
    expect(db.compensatoryLeave.deleteMany).toHaveBeenCalledWith({
      where: { scheduleId, userId },
    });
  });
});

interface ReportFixture {
  schedules?: ReturnType<typeof holidayWorkSchedule>[];
  tasks?: Array<ReturnType<typeof linkedTask> & { linkedScheduleCount: number }>;
  events?: Array<Record<string, unknown>>;
  projectTasks?: Array<Record<string, unknown>>;
}

function configureReportFixture(fixture: ReportFixture) {
  db.schedule.findMany.mockImplementation(async ({ take }) => take ? [] : (fixture.schedules ?? []));
  db.event.findMany.mockResolvedValue(fixture.events ?? []);
  db.projectTask.findMany.mockResolvedValue(fixture.projectTasks ?? []);
  db.task.findMany.mockImplementation(async ({ where }) => {
    const tasks = fixture.tasks ?? [];
    return where.schedules?.none ? tasks.filter((task) => task.linkedScheduleCount === 0) : tasks;
  });
}

describe('weekly report task/schedule consistency', () => {
  it('uses the reportable linked schedule as the task\'s single activity', async () => {
    configureReportFixture({
      schedules: [holidayWorkSchedule()],
      tasks: [{ ...linkedTask(), linkedScheduleCount: 1 }],
    });

    const report = await generateWeeklyReportDraft(userId, '2026-W37');

    expect(report.thisWeekActivities).toEqual([
      expect.objectContaining({
        date: '2026-09-08',
        activity: 'AM・PM：Work',
        sourceType: 'schedule',
      }),
    ]);
  });

  it.each([
    ['nonreportable', { reportable: false, deletedAt: null }],
    ['deleted', { reportable: true, deletedAt: activityDate }],
  ])('does not restore a %s linked schedule as a fallback task row', async (_name, scheduleState) => {
    configureReportFixture({
      schedules: [],
      tasks: [{ ...linkedTask(), linkedScheduleCount: 1 }],
    });
    db.schedule.findMany.mockImplementation(async ({ take }) => {
      if (take) return [];
      const schedule = holidayWorkSchedule(scheduleState);
      return schedule.deletedAt === null && schedule.reportable ? [schedule] : [];
    });

    const report = await generateWeeklyReportDraft(userId, '2026-W37');

    expect(report.thisWeekActivities).toEqual([]);
  });

  it('keeps an unlinked task as one activity', async () => {
    configureReportFixture({ tasks: [{ ...linkedTask(), linkedScheduleCount: 0 }] });

    const report = await generateWeeklyReportDraft(userId, '2026-W37');

    expect(report.thisWeekActivities).toEqual([
      expect.objectContaining({ date: '2026-09-08', activity: 'Work', sourceType: 'task' }),
    ]);
  });

  it('preserves independent event and project-task activities', async () => {
    configureReportFixture({
      events: [{
        id: 'event',
        date: activityDate,
        eventType: 'TEAM',
        eventName: 'Town meeting',
        participations: [{ userId }],
      }],
      projectTasks: [{
        id: 'project-task',
        deadline: activityDate,
        taskName: 'Prepare materials',
        project: {
          id: 'project',
          projectName: 'Community project',
          mission: { missionName: 'Mission' },
        },
      }],
    });

    const report = await generateWeeklyReportDraft(userId, '2026-W37');

    expect(report.thisWeekActivities).toEqual(expect.arrayContaining([
      expect.objectContaining({ activity: 'イベント:チーム / Town meeting', sourceType: 'event' }),
      expect.objectContaining({ activity: 'Prepare materials', sourceType: 'projectTask' }),
    ]));
    expect(report.thisWeekActivities).toHaveLength(2);
  });
});
