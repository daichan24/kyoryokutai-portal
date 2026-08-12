import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

function loadAiToken(): string | undefined {
  const environmentToken = process.env.CLEARBASE_AI_TOKEN?.trim();
  if (environmentToken) return environmentToken;
  if (process.platform !== 'darwin') return undefined;

  const account = process.env.CLEARBASE_KEYCHAIN_ACCOUNT?.trim() || process.env.USER?.trim();
  const service = process.env.CLEARBASE_KEYCHAIN_SERVICE?.trim() || 'clearbase-ai-token';
  if (!account) return undefined;
  try {
    return execFileSync('security', [
      'find-generic-password', '-a', account, '-s', service, '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

export type ClearBaseMcpServerOptions = {
  apiBaseUrl: string;
  aiToken: string;
};

export function createClearBaseMcpServer(options: ClearBaseMcpServerOptions): McpServer {
const apiBaseUrl = options.apiBaseUrl.replace(/\/$/, '');
const aiToken = options.aiToken.trim();

if (!aiToken.startsWith('cbai_') && !aiToken.startsWith('cboa_')) {
  throw new Error('A ClearBase AI connection token is required. Never use a user password here.');
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  operationId?: string;
};

async function callApi(path: string, options: ApiOptions = {}): Promise<unknown> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${aiToken}`,
    Accept: 'application/json',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const keySuffix = options.operationId?.trim() || crypto.randomUUID();
    headers['Idempotency-Key'] = `mcp:${keySuffix}`.slice(0, 100);
    headers['X-Request-Id'] = crypto.randomUUID();
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    const detail = typeof payload === 'object' && payload && 'error' in payload
      ? JSON.stringify((payload as { error: unknown }).error)
      : JSON.stringify(payload);
    throw new Error(`ClearBase API ${response.status}: ${detail}`);
  }
  return payload;
}

function toolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(error: unknown) {
  return {
    isError: true,
    content: [{
      type: 'text' as const,
      text: error instanceof Error ? error.message : 'ClearBase operation failed',
    }],
  };
}

async function runTool(operation: () => Promise<unknown>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    return toolError(error);
  }
}

function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

const server = new McpServer({
  name: 'clearbase-self-service',
  version: '1.0.0',
});

// Avoid expanding the SDK's large generic tool types for every registration.
// Runtime input validation is still performed by the Zod schemas below.
type ToolArguments = ReturnType<typeof JSON.parse>;
const registerTool = server.registerTool.bind(server) as (
  name: string,
  config: Record<string, unknown>,
  handler: (args: ToolArguments) => Promise<unknown>,
) => unknown;

const readAnnotations = { readOnlyHint: true, openWorldHint: false } as const;
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const deleteAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

registerTool('clearbase_my_context', {
  title: '自分のミッション・プロジェクト一覧',
  description: 'ログインユーザー本人のミッションとプロジェクトをまとめて取得します。ID確認にも使います。',
  annotations: readAnnotations,
}, async () => runTool(async () => {
  const [missions, projects] = await Promise.all([
    callApi('/api/missions'),
    callApi('/api/projects'),
  ]);
  return { missions, projects };
}));

registerTool('clearbase_my_schedules_list', {
  title: '自分の予定一覧',
  description: '本人の予定・休日を期間指定で取得します。日付はYYYY-MM-DDです。',
  inputSchema: {
    startDate: z.string().optional().describe('期間開始 YYYY-MM-DD'),
    endDate: z.string().optional().describe('期間終了 YYYY-MM-DD'),
    reportable: z.enum(['true', 'false']).optional(),
  },
  annotations: readAnnotations,
}, async ({ startDate, endDate, reportable }) => runTool(() => callApi(
  `/api/schedules${queryString({ startDate, endDate, reportable })}`,
)));

const scheduleInput = {
  date: z.string().describe('開始日 YYYY-MM-DD'),
  endDate: z.string().optional().describe('終了日 YYYY-MM-DD。省略時は開始日と同日'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  title: z.string().min(1).max(200),
  activityDescription: z.string().optional(),
  locationText: z.string().min(1).describe('通常予定では必須。休日には不要'),
  freeNote: z.string().optional(),
  referenceUrl: z.string().url().optional(),
  projectId: z.string().optional(),
  linkKind: z.enum(['PROJECT', 'UNSET', 'KYORYOKUTAI_WORK', 'YAKUBA_WORK', 'TRIAGE_PENDING']).optional(),
  isAllDay: z.boolean().optional(),
  isTimeUnspecified: z.boolean().optional(),
  reportable: z.boolean().optional(),
  operationId: z.string().max(80).optional().describe('再試行時も同じ値を使う重複防止ID'),
};

registerTool('clearbase_my_schedule_create', {
  title: '自分の予定を追加',
  description: '本人のカレンダーへ通常予定を追加します。通常予定は場所が必要です。',
  inputSchema: scheduleInput,
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/schedules', {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_day_off_create', {
  title: '自分の休日を追加',
  description: '本人のカレンダーへ休日・有給・無休・代休・時間調整を追加します。休日は場所とプロジェクト連携が不要です。',
  inputSchema: {
    date: z.string().describe('開始日 YYYY-MM-DD'),
    endDate: z.string().optional().describe('終了日 YYYY-MM-DD'),
    title: z.string().default('休み'),
    dayOffType: z.enum(['PAID', 'UNPAID', 'COMPENSATORY', 'TIME_ADJUST']).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).default('00:00'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
    freeNote: z.string().optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/schedules', {
  method: 'POST',
  operationId,
  body: {
    ...input,
    activityDescription: input.title,
    isDayOff: true,
    isAllDay: true,
    reportable: false,
    linkKind: 'UNSET',
  },
})));

registerTool('clearbase_my_schedule_update', {
  title: '自分の予定を更新',
  description: '本人が作成した予定・休日を部分更新します。',
  inputSchema: {
    scheduleId: z.string(),
    date: z.string().optional(),
    endDate: z.string().optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    title: z.string().min(1).max(200).optional(),
    activityDescription: z.string().optional(),
    locationText: z.string().nullable().optional(),
    freeNote: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    isDayOff: z.boolean().optional(),
    dayOffType: z.enum(['PAID', 'UNPAID', 'COMPENSATORY', 'TIME_ADJUST']).nullable().optional(),
    reportable: z.boolean().optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ scheduleId, operationId, ...input }) => runTool(() => callApi(`/api/schedules/${scheduleId}`, {
  method: 'PUT', body: input, operationId,
})));

registerTool('clearbase_my_schedule_delete', {
  title: '自分の予定を削除',
  description: '本人が作成した予定を削除します。削除前に対象IDと内容を確認してください。',
  inputSchema: { scheduleId: z.string(), operationId: z.string().max(80).optional() },
  annotations: deleteAnnotations,
}, async ({ scheduleId, operationId }) => runTool(() => callApi(`/api/schedules/${scheduleId}`, {
  method: 'DELETE', operationId,
})));

registerTool('clearbase_my_tasks_list', {
  title: '自分のタスク一覧',
  description: '本人の全ミッションからタスクをまとめて取得します。',
  inputSchema: {
    missionId: z.string().optional(),
    projectId: z.string().optional(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  },
  annotations: readAnnotations,
}, async ({ missionId, projectId, status }) => runTool(async () => {
  const missions = missionId
    ? [{ id: missionId }]
    : (await callApi('/api/missions') as Array<{ id: string }>);
  const taskGroups = await Promise.all(missions.map(async (mission) => {
    const tasks = await callApi(
      `/api/missions/${mission.id}/tasks${queryString({ projectId })}`,
    ) as Array<{ status?: string }>;
    return status ? tasks.filter((task) => task.status === status) : tasks;
  }));
  return taskGroups.flat();
}));

const taskFields = {
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  projectId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional().describe('YYYY-MM-DD。指定すると同じ予定がカレンダーにも自動作成されます'),
  endDate: z.string().nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  locationText: z.string().optional(),
  linkKind: z.enum(['PROJECT', 'UNSET', 'KYORYOKUTAI_WORK', 'YAKUBA_WORK', 'TRIAGE_PENDING']).optional(),
  isAllDay: z.boolean().optional(),
  isTimeUnspecified: z.boolean().optional(),
  reportable: z.boolean().optional(),
};

registerTool('clearbase_my_task_create', {
  title: '自分のタスクを追加',
  description: '本人のミッションにタスクを追加します。dueDateを指定した場合、既存の本体処理によりカレンダー予定も連動作成されます。',
  inputSchema: {
    missionId: z.string(),
    ...taskFields,
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ missionId, operationId, ...input }) => runTool(() => callApi(`/api/missions/${missionId}/tasks`, {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_task_update', {
  title: '自分のタスクを更新',
  description: '本人のタスクを更新します。期限の追加・変更は連動カレンダー予定にも反映されます。',
  inputSchema: {
    missionId: z.string(),
    taskId: z.string(),
    ...Object.fromEntries(Object.entries(taskFields).map(([key, schema]) => [key, schema.optional()])),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ missionId, taskId, operationId, ...input }) => runTool(() => callApi(
  `/api/missions/${missionId}/tasks/${taskId}`,
  { method: 'PUT', body: input, operationId },
)));

registerTool('clearbase_my_task_delete', {
  title: '自分のタスクを削除',
  description: '本人のタスクを削除します。削除前に対象IDと内容を確認してください。',
  inputSchema: { missionId: z.string(), taskId: z.string(), operationId: z.string().max(80).optional() },
  annotations: deleteAnnotations,
}, async ({ missionId, taskId, operationId }) => runTool(() => callApi(
  `/api/missions/${missionId}/tasks/${taskId}`,
  { method: 'DELETE', operationId },
)));

registerTool('clearbase_my_mission_create', {
  title: '自分のミッションを追加',
  description: '本人のミッションを追加します。',
  inputSchema: {
    missionName: z.string().min(1),
    missionType: z.enum(['PRIMARY', 'SUB']),
    targetPercentage: z.number().min(0).max(100).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    achievementBorder: z.string().optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/missions', {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_mission_update', {
  title: '自分のミッションを更新',
  description: '本人のミッションを部分更新します。',
  inputSchema: {
    missionId: z.string(),
    missionName: z.string().min(1).optional(),
    missionType: z.enum(['PRIMARY', 'SUB']).optional(),
    targetPercentage: z.number().min(0).max(100).optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    achievementBorder: z.string().nullable().optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ missionId, operationId, ...input }) => runTool(() => callApi(`/api/missions/${missionId}`, {
  method: 'PUT', body: input, operationId,
})));

registerTool('clearbase_my_mission_delete', {
  title: '自分のミッションを削除',
  description: '本人のミッションを削除します。配下データへの影響を確認してから実行してください。',
  inputSchema: { missionId: z.string(), operationId: z.string().max(80).optional() },
  annotations: deleteAnnotations,
}, async ({ missionId, operationId }) => runTool(() => callApi(`/api/missions/${missionId}`, {
  method: 'DELETE', operationId,
})));

const projectFields = {
  projectName: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phase: z.enum(['PREPARATION', 'EXECUTION', 'COMPLETED', 'REVIEW']).optional(),
  missionId: z.string().optional(),
  themeColor: z.string().optional(),
  tags: z.array(z.string()).optional(),
};

registerTool('clearbase_my_project_create', {
  title: '自分のプロジェクトを追加',
  description: '本人のプロジェクトを追加し、必要なら本人のミッションに紐づけます。',
  inputSchema: { ...projectFields, operationId: z.string().max(80).optional() },
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/projects', {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_project_update', {
  title: '自分のプロジェクトを更新',
  description: '本人のプロジェクトを部分更新します。本体APIが必要とする既存値は自動補完します。',
  inputSchema: {
    projectId: z.string(),
    ...Object.fromEntries(Object.entries(projectFields).map(([key, schema]) => [key, schema.optional()])),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ projectId, operationId, ...input }) => runTool(async () => {
  const current = await callApi(`/api/projects/${projectId}`) as Record<string, unknown>;
  const body = {
    projectName: current.projectName,
    description: current.description ?? undefined,
    startDate: typeof current.startDate === 'string' ? current.startDate.slice(0, 10) : undefined,
    endDate: typeof current.endDate === 'string' ? current.endDate.slice(0, 10) : undefined,
    phase: current.phase,
    missionId: current.missionId ?? undefined,
    themeColor: current.themeColor ?? undefined,
    tags: current.tags ?? [],
    ...input,
  };
  return callApi(`/api/projects/${projectId}`, { method: 'PUT', body, operationId });
}));

registerTool('clearbase_my_project_delete', {
  title: '自分のプロジェクトを削除',
  description: '本人のプロジェクトを削除します。関連予定・タスクへの影響を確認してから実行してください。',
  inputSchema: { projectId: z.string(), operationId: z.string().max(80).optional() },
  annotations: deleteAnnotations,
}, async ({ projectId, operationId }) => runTool(() => callApi(`/api/projects/${projectId}`, {
  method: 'DELETE', operationId,
})));

registerTool('clearbase_my_notepad_list', {
  title: '自分のメモ一覧',
  description: '本人のメモページ一覧を取得します。',
  annotations: readAnnotations,
}, async () => runTool(() => callApi('/api/me/notepad')));

registerTool('clearbase_my_notepad_get', {
  title: '自分のメモを読む',
  description: '本人のメモ本文を取得します。',
  inputSchema: { notepadId: z.string() },
  annotations: readAnnotations,
}, async ({ notepadId }) => runTool(() => callApi(`/api/me/notepad/${notepadId}`)));

registerTool('clearbase_my_notepad_create', {
  title: '自分のメモを追加',
  description: '本人のメモページを追加します。',
  inputSchema: {
    title: z.string().max(200).optional(),
    content: z.string().max(10000).optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/me/notepad', {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_notepad_update', {
  title: '自分のメモを更新',
  description: '本人のメモページを部分更新します。',
  inputSchema: {
    notepadId: z.string(),
    title: z.string().max(200).optional(),
    content: z.string().max(10000).optional(),
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ notepadId, operationId, ...input }) => runTool(() => callApi(`/api/me/notepad/${notepadId}`, {
  method: 'PUT', body: input, operationId,
})));

registerTool('clearbase_my_notepad_delete', {
  title: '自分のメモを削除',
  description: '本人のメモページを削除します。削除前に対象IDと内容を確認してください。',
  inputSchema: { notepadId: z.string(), operationId: z.string().max(80).optional() },
  annotations: deleteAnnotations,
}, async ({ notepadId, operationId }) => runTool(() => callApi(`/api/me/notepad/${notepadId}`, {
  method: 'DELETE', operationId,
})));

return server;
}

async function main(): Promise<void> {
  const aiToken = loadAiToken();
  if (!aiToken) {
    throw new Error('ClearBase AI token is required in CLEARBASE_AI_TOKEN or the macOS Keychain.');
  }
  const server = createClearBaseMcpServer({
    apiBaseUrl: process.env.CLEARBASE_API_URL || 'http://localhost:3001',
    aiToken,
  });
  await server.connect(new StdioServerTransport());
}

if (require.main === module) {
main().catch((error) => {
  console.error('ClearBase MCP server failed:', error);
  process.exit(1);
});
}
