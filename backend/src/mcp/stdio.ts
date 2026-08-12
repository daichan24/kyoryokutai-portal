import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  AI_SCOPE_STRING,
  requiredAiScope,
  type AiScope,
} from '../security/aiPermissions';

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

const fieldLabels: Record<string, string> = {
  date: '日付',
  endDate: '終了日',
  startTime: '開始時刻',
  endTime: '終了時刻',
  title: 'タイトル',
  locationText: '場所',
  missionId: 'ミッション',
  missionName: 'ミッション名',
  missionType: 'ミッション種別',
  projectId: 'プロジェクト',
  projectName: 'プロジェクト名',
  taskId: 'タスク',
  scheduleId: '予定',
  notepadId: 'メモ',
  dueDate: '期限日',
};

type ValidationIssue = {
  path?: unknown;
  message?: unknown;
};

function issueDescription(issue: ValidationIssue): string | null {
  if (typeof issue.message !== 'string') return null;
  const rawPath = Array.isArray(issue.path) ? issue.path.map(String).join('.') : '';
  const lastPath = rawPath.split('.').filter(Boolean).at(-1) || '';
  const label = fieldLabels[lastPath] || rawPath;
  return label ? `${label}: ${issue.message}` : issue.message;
}

export function formatClearBaseApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    const issues = payload
      .map((value) => (
        typeof value === 'object' && value ? issueDescription(value as ValidationIssue) : null
      ))
      .filter((value): value is string => Boolean(value));
    if (issues.length > 0) return issues.join('、');
    return JSON.stringify(payload) ?? String(payload);
  }
  if (typeof payload === 'object' && payload) {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.error)) return formatClearBaseApiError(record.error);
    if (typeof record.details === 'string') return record.details;
    if (typeof record.error === 'string') return record.error;
  }
  return JSON.stringify(payload) ?? String(payload);
}

class ClearBaseApiError extends Error {
  constructor(
    readonly status: number,
    readonly requiredScope: AiScope | null,
    detail: string,
  ) {
    const guidance = status === 400
      ? '入力内容が不足または不正です。上記の項目をユーザーに確認してから、同じ操作をもう一度実行してください。'
      : detail;
    super(status === 400 ? `${guidance} 詳細: ${detail}` : `ClearBase API ${status}: ${detail}`);
    this.name = 'ClearBaseApiError';
  }
}

export function buildMcpReauthorizationChallenge(
  apiBaseUrl: string,
  requiredScope: AiScope,
): string {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '');
  return `Bearer resource_metadata="${normalizedBaseUrl}/.well-known/oauth-protected-resource", error="insufficient_scope", scope="${AI_SCOPE_STRING}", error_description="${requiredScope}を含むClearBase全本人操作権限での再接続が必要です"`;
}

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
  const scope = requiredAiScope(method, path);
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
    throw new ClearBaseApiError(response.status, scope, formatClearBaseApiError(payload));
  }
  return payload;
}

function toolResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function toolError(error: unknown) {
  if (error instanceof ClearBaseApiError && error.status === 403 && error.requiredScope) {
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: 'このAI接続には、この操作に必要な権限がありません。ClearBaseとの接続を解除して再接続し、表示された本人操作権限を許可してください。',
      }],
      _meta: {
        'mcp/www_authenticate': [
          buildMcpReauthorizationChallenge(apiBaseUrl, error.requiredScope),
        ],
      },
    };
  }
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
  title: z.string().min(1).max(200).describe('予定のタイトル。わからない場合は実行前にユーザーへ確認'),
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
  description: '本人のカレンダーへ通常予定を追加します。日付・タイトル・場所が不足している場合は、保存を試みる前にユーザーへ確認してください。',
  inputSchema: scheduleInput,
  annotations: writeAnnotations,
}, async ({ operationId, ...input }) => runTool(() => callApi('/api/schedules', {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_day_off_create', {
  title: '自分の休日を追加',
  description: '本人のカレンダーへ休日・有給・無休・代休・時間調整を追加します。日付が不明ならユーザーへ確認してください。休日は場所とプロジェクト連携が不要です。',
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
  description: '本人が作成した予定・休日を部分更新します。対象が特定できない場合は予定一覧で候補を確認し、それでも不明ならユーザーへ確認してください。',
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
  title: z.string().min(1).describe('タスクのタイトル。わからない場合は実行前にユーザーへ確認'),
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
  description: '本人のミッションにタスクを追加します。ミッションまたはタイトルが不明な場合は、まず自分のミッション・プロジェクト一覧で候補を確認し、特定できなければユーザーへ質問してください。dueDateを指定するとカレンダー予定も連動作成されます。',
  inputSchema: {
    missionId: z.string().describe('追加先ミッションのID。clearbase_my_contextで確認'),
    ...taskFields,
    operationId: z.string().max(80).optional(),
  },
  annotations: writeAnnotations,
}, async ({ missionId, operationId, ...input }) => runTool(() => callApi(`/api/missions/${missionId}/tasks`, {
  method: 'POST', body: input, operationId,
})));

registerTool('clearbase_my_task_update', {
  title: '自分のタスクを更新',
  description: '本人のタスクを更新します。対象ミッション・タスクが特定できない場合は一覧で候補を確認し、それでも不明ならユーザーへ質問してください。期限の追加・変更は連動カレンダー予定にも反映されます。',
  inputSchema: {
    missionId: z.string().describe('対象ミッションのID'),
    taskId: z.string().describe('対象タスクのID'),
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
  description: '本人のミッションを追加します。ミッション名または種別が不明ならユーザーへ確認してください。',
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
  description: '本人のプロジェクトを追加し、必要なら本人のミッションに紐づけます。プロジェクト名が不明ならユーザーへ確認してください。',
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
