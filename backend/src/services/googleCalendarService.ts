import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const GOOGLE_CALENDAR_NAME = 'クリアベース｜活動予定';
const GOOGLE_TIME_ZONE = 'Asia/Tokyo';
const MAX_SYNC_ATTEMPTS = 5;

type GoogleEvent = {
  id: string;
  status?: string;
  etag?: string;
  updated?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};

type CalendarConnection = NonNullable<Awaited<ReturnType<typeof getActiveConnection>>>;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function backendPublicUrl() {
  return (process.env.BACKEND_PUBLIC_URL || process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
}

function oauthRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${backendPublicUrl()}/api/integrations/google-calendar/oauth/callback`;
}

function encryptionKey() {
  const source = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'secret';
  return crypto.createHash('sha256').update(source).digest();
}

function encrypt(value: string | null | undefined) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith('v1:')) return value;
  const [, ivRaw, tagRaw, encryptedRaw] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function signState(userId: string) {
  return jwt.sign(
    { userId, nonce: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '10m' },
  );
}

function verifyState(state: string) {
  const decoded = jwt.verify(state, process.env.JWT_SECRET || 'secret') as { userId: string };
  if (!decoded.userId) throw new Error('Invalid OAuth state');
  return decoded.userId;
}

function ymd(date: Date | string | null | undefined) {
  if (!date) return new Date().toISOString().slice(0, 10);
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function tokyoParts(dateTime: string) {
  const date = new Date(dateTime);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GOOGLE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

async function googleFetch<T>(connection: CalendarConnection, url: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getValidAccessToken(connection.id);
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Google API failed: ${response.status} ${text}`);
    (err as any).status = response.status;
    throw err;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function getActiveConnection(userId: string) {
  return prisma.googleCalendarConnection.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'ERROR'] }, calendarId: { not: null } },
  });
}

export async function getGoogleCalendarStatus(userId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { userId },
    select: {
      status: true,
      googleAccountEmail: true,
      calendarId: true,
      calendarSummary: true,
      lastSyncedAt: true,
      lastError: true,
      watchExpiration: true,
      syncEnabledAt: true,
      disconnectedAt: true,
    },
  });
  return {
    connected: connection?.status === 'ACTIVE' || connection?.status === 'ERROR',
    connection: connection
      ? {
          ...connection,
          accessToken: undefined,
          refreshToken: undefined,
        }
      : null,
  };
}

export function buildGoogleAuthUrl(userId: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: oauthRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: signState(userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: oauthRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const body = await response.json() as any;
  if (!response.ok) throw new Error(`Google OAuth token exchange failed: ${JSON.stringify(body)}`);
  return body as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json() as any;
  if (!response.ok) {
    console.warn('Google userinfo unavailable with current scopes:', body);
    return {};
  }
  return body as { sub?: string; email?: string };
}

async function getValidAccessToken(connectionId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { id: connectionId } });
  if (!connection || !['ACTIVE', 'ERROR'].includes(connection.status)) throw new Error('Google Calendar connection is not active');
  const current = decrypt(connection.accessToken);
  if (current && connection.tokenExpiry && connection.tokenExpiry.getTime() > Date.now() + 60_000) {
    return current;
  }

  const refreshToken = decrypt(connection.refreshToken);
  if (!refreshToken) {
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { status: 'REAUTH_REQUIRED', lastError: 'Google refresh token is missing' },
    });
    throw new Error('Google refresh token is missing');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await response.json() as any;
  if (!response.ok) {
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { status: 'REAUTH_REQUIRED', lastError: JSON.stringify(body) },
    });
    throw new Error(`Google token refresh failed: ${JSON.stringify(body)}`);
  }

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(body.access_token),
      tokenExpiry: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
      status: 'ACTIVE',
      lastError: null,
    },
  });
  return body.access_token as string;
}

async function createDedicatedCalendar(connection: CalendarConnection) {
  const calendar = await googleFetch<{ id: string; summary: string }>(
    connection,
    'https://www.googleapis.com/calendar/v3/calendars',
    {
      method: 'POST',
      body: JSON.stringify({
        summary: GOOGLE_CALENDAR_NAME,
        timeZone: GOOGLE_TIME_ZONE,
      }),
    },
  );
  return calendar;
}

function scheduleToGoogleEvent(schedule: any, connection: CalendarConnection) {
  const startDate = ymd(schedule.startDate || schedule.date);
  const endDate = ymd(schedule.endDate || schedule.startDate || schedule.date);
  const privateProps = {
    clearbaseScheduleId: schedule.id,
    origin: 'CLEARBASE',
    connectionUserId: connection.userId,
    lastSyncedBy: 'clearbase',
  };

  if (schedule.isAllDay) {
    return {
      summary: schedule.title || schedule.activityDescription || '予定',
      location: schedule.locationText || undefined,
      description: schedule.freeNote || undefined,
      start: { date: startDate },
      end: { date: addDays(endDate, 1) },
      extendedProperties: { private: privateProps },
    };
  }

  return {
    summary: schedule.title || schedule.activityDescription || '予定',
    location: schedule.locationText || undefined,
    description: schedule.freeNote || undefined,
    start: { dateTime: `${startDate}T${schedule.startTime}:00`, timeZone: GOOGLE_TIME_ZONE },
    end: { dateTime: `${endDate}T${schedule.endTime}:00`, timeZone: GOOGLE_TIME_ZONE },
    extendedProperties: { private: privateProps },
  };
}

function googleEventToScheduleData(event: GoogleEvent) {
  const isAllDay = !!event.start?.date;
  if (isAllDay) {
    const startDate = event.start?.date || new Date().toISOString().slice(0, 10);
    const endExclusive = event.end?.date || addDays(startDate, 1);
    const endDate = addDays(endExclusive, -1);
    return {
      date: parseDateOnly(startDate),
      startDate: parseDateOnly(startDate),
      endDate: parseDateOnly(endDate),
      startTime: '00:00',
      endTime: '23:59',
      isAllDay: true,
    };
  }

  const start = tokyoParts(event.start?.dateTime || new Date().toISOString());
  const end = tokyoParts(event.end?.dateTime || event.start?.dateTime || new Date().toISOString());
  return {
    date: parseDateOnly(start.date),
    startDate: parseDateOnly(start.date),
    endDate: parseDateOnly(end.date),
    startTime: start.time,
    endTime: end.time,
    isAllDay: false,
  };
}

export async function handleGoogleOAuthCallback(code: string, state: string) {
  const userId = verifyState(state);
  const tokens = await exchangeCode(code);
  const userInfo = await fetchGoogleUserInfo(tokens.access_token);
  const existing = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  const refreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refreshToken || null;

  const connection = await prisma.googleCalendarConnection.upsert({
    where: { userId },
    create: {
      userId,
      googleAccountEmail: userInfo.email || null,
      googleSubject: userInfo.sub || null,
      accessToken: encrypt(tokens.access_token),
      refreshToken,
      tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope || GOOGLE_CALENDAR_SCOPE,
      status: 'ACTIVE',
      syncEnabledAt: new Date(),
      disconnectedAt: null,
      lastError: null,
    },
    update: {
      googleAccountEmail: userInfo.email || null,
      googleSubject: userInfo.sub || null,
      accessToken: encrypt(tokens.access_token),
      refreshToken,
      tokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope || GOOGLE_CALENDAR_SCOPE,
      status: 'ACTIVE',
      syncEnabledAt: new Date(),
      disconnectedAt: null,
      lastError: null,
    },
  });

  let active = await prisma.googleCalendarConnection.findUnique({ where: { id: connection.id } });
  if (!active?.calendarId) {
    const calendar = await createDedicatedCalendar(active as CalendarConnection);
    active = await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { calendarId: calendar.id, calendarSummary: calendar.summary || GOOGLE_CALENDAR_NAME },
    });
  }

  await enqueueGoogleCalendarSyncJob(active.id, 'INITIAL');
  await processGoogleCalendarSyncJobs(1);
  return `${frontendUrl()}/settings/google-calendar?googleCalendar=connected`;
}

export async function enqueueGoogleCalendarSyncJob(
  connectionId: string,
  jobType: 'INITIAL' | 'MANUAL' | 'WEBHOOK' | 'POLL' | 'WATCH_RENEWAL' | 'PUSH' | 'PULL',
  payload?: Record<string, unknown>,
) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { id: connectionId } });
  return prisma.googleCalendarSyncJob.create({
    data: {
      connectionId,
      userId: connection?.userId || null,
      jobType,
      payload: payload as any,
    },
  });
}

export async function syncScheduleToGoogle(scheduleId: string) {
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || schedule.deletedAt) return;
  const connection = await getActiveConnection(schedule.userId);
  if (!connection?.calendarId) return;

  try {
    const existing = await prisma.googleCalendarEventLink.findUnique({ where: { scheduleId } });
    const body = scheduleToGoogleEvent(schedule, connection);
    const encodedCalendarId = encodeURIComponent(connection.calendarId);

    if (existing && !existing.googleEventId.startsWith('pending-')) {
      const event = await googleFetch<GoogleEvent>(
        connection,
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(existing.googleEventId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      await prisma.googleCalendarEventLink.update({
        where: { id: existing.id },
        data: {
          googleEtag: event.etag || null,
          googleUpdatedAt: event.updated ? new Date(event.updated) : null,
          lastSyncedAt: new Date(),
          lastPushedAt: new Date(),
          lastSyncDirection: 'PUSH',
          syncStatus: 'SYNCED',
          lastError: null,
        },
      });
    } else {
      const event = await googleFetch<GoogleEvent>(
        connection,
        `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      await prisma.googleCalendarEventLink.create({
        data: {
          scheduleId,
          userId: schedule.userId,
          connectionId: connection.id,
          googleCalendarId: connection.calendarId,
          googleEventId: event.id,
          googleEtag: event.etag || null,
          googleUpdatedAt: event.updated ? new Date(event.updated) : null,
          origin: 'CLEARBASE',
          lastSyncedAt: new Date(),
          lastPushedAt: new Date(),
          lastSyncDirection: 'PUSH',
          syncStatus: 'SYNCED',
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { status: 'ERROR', lastError: message },
    });
    await prisma.googleCalendarEventLink.upsert({
      where: { scheduleId },
      create: {
        scheduleId,
        userId: schedule.userId,
        connectionId: connection.id,
        googleCalendarId: connection.calendarId,
        googleEventId: `pending-${scheduleId}`,
        origin: 'CLEARBASE',
        syncStatus: 'ERROR',
        lastError: message,
      },
      update: { syncStatus: 'ERROR', lastError: message },
    }).catch(() => undefined);
    throw error;
  }
}

export async function deleteScheduleFromGoogle(scheduleId: string, userId: string) {
  const connection = await getActiveConnection(userId);
  const link = await prisma.googleCalendarEventLink.findUnique({ where: { scheduleId } });
  if (!connection?.calendarId || !link) return;
  try {
    await googleFetch<void>(
      connection,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(link.googleEventId)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    if ((error as any).status !== 404 && (error as any).status !== 410) throw error;
  }
  await prisma.googleCalendarEventLink.update({
    where: { id: link.id },
    data: {
      syncStatus: 'DELETED',
      lastSyncedAt: new Date(),
      lastPushedAt: new Date(),
      lastSyncDirection: 'PUSH',
    },
  });
}

async function pullGoogleEvents(connection: CalendarConnection, forceFull = false) {
  if (!connection.calendarId) return;
  const params = new URLSearchParams({
    showDeleted: 'true',
    maxResults: '2500',
    singleEvents: 'true',
  });
  if (connection.syncToken && !forceFull) {
    params.set('syncToken', connection.syncToken);
  } else {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    params.set('timeMin', past.toISOString());
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events?${params.toString()}`;
  let body: { items?: GoogleEvent[]; nextSyncToken?: string };
  try {
    body = await googleFetch(connection, url);
  } catch (error) {
    if ((error as any).status === 410 && !forceFull) {
      await prisma.googleCalendarConnection.update({ where: { id: connection.id }, data: { syncToken: null } });
      return pullGoogleEvents({ ...connection, syncToken: null }, true);
    }
    throw error;
  }

  for (const event of body.items || []) {
    await upsertScheduleFromGoogleEvent(connection, event);
  }

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      syncToken: body.nextSyncToken || connection.syncToken,
      lastSyncedAt: new Date(),
      status: 'ACTIVE',
      lastError: null,
    },
  });
}

async function upsertScheduleFromGoogleEvent(connection: CalendarConnection, event: GoogleEvent) {
  if (!connection.calendarId) return;
  const link = await prisma.googleCalendarEventLink.findUnique({
    where: { googleCalendarId_googleEventId: { googleCalendarId: connection.calendarId, googleEventId: event.id } },
  });

  if (event.status === 'cancelled') {
    if (link) {
      await prisma.schedule.update({ where: { id: link.scheduleId }, data: { deletedAt: new Date() } });
      await prisma.googleCalendarEventLink.update({
        where: { id: link.id },
        data: { syncStatus: 'DELETED', lastPulledAt: new Date(), lastSyncDirection: 'PULL', lastSyncedAt: new Date() },
      });
    }
    return;
  }

  const clearbaseScheduleId = event.extendedProperties?.private?.clearbaseScheduleId;
  const scheduleData = googleEventToScheduleData(event);
  const baseData = {
    ...scheduleData,
    title: event.summary || '予定',
    activityDescription: event.summary || '予定',
    locationText: event.location || null,
    freeNote: event.description || null,
  };

  const linkedScheduleId = link?.scheduleId || clearbaseScheduleId;
  if (linkedScheduleId) {
    const existing = await prisma.schedule.findUnique({ where: { id: linkedScheduleId } });
    if (existing) {
      const conflict = link?.lastSyncedAt && existing.updatedAt > link.lastSyncedAt && event.updated
        ? new Date(event.updated) > link.lastSyncedAt
        : false;
      await prisma.schedule.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          deletedAt: null,
        },
      });
      await prisma.googleCalendarEventLink.upsert({
        where: { scheduleId: existing.id },
        create: {
          scheduleId: existing.id,
          userId: connection.userId,
          connectionId: connection.id,
          googleCalendarId: connection.calendarId,
          googleEventId: event.id,
          googleEtag: event.etag || null,
          googleUpdatedAt: event.updated ? new Date(event.updated) : null,
          origin: 'CLEARBASE',
          lastSyncedAt: new Date(),
          lastPulledAt: new Date(),
          lastSyncDirection: 'PULL',
          syncStatus: conflict ? 'CONFLICT_RESOLVED' : 'SYNCED',
        },
        update: {
          googleEtag: event.etag || null,
          googleUpdatedAt: event.updated ? new Date(event.updated) : null,
          lastSyncedAt: new Date(),
          lastPulledAt: new Date(),
          lastSyncDirection: 'PULL',
          syncStatus: conflict ? 'CONFLICT_RESOLVED' : 'SYNCED',
          lastError: null,
        },
      });
      return;
    }
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId: connection.userId,
      ...baseData,
      participants: [],
      projectId: null,
      taskId: null,
      isPending: false,
      isTemplate: false,
      reportable: false,
    },
  });
  await prisma.googleCalendarEventLink.create({
    data: {
      scheduleId: schedule.id,
      userId: connection.userId,
      connectionId: connection.id,
      googleCalendarId: connection.calendarId,
      googleEventId: event.id,
      googleEtag: event.etag || null,
      googleUpdatedAt: event.updated ? new Date(event.updated) : null,
      origin: 'GOOGLE',
      lastSyncedAt: new Date(),
      lastPulledAt: new Date(),
      lastSyncDirection: 'PULL',
      syncStatus: 'SYNCED',
    },
  });
}

async function pushExistingSchedules(connection: CalendarConnection) {
  const schedules = await prisma.schedule.findMany({
    where: {
      userId: connection.userId,
      deletedAt: null,
      isTemplate: false,
      googleCalendarEventLink: null,
    },
    take: 500,
    orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
  });
  for (const schedule of schedules) {
    await syncScheduleToGoogle(schedule.id);
  }
}

async function startWatch(connection: CalendarConnection) {
  if (!connection.calendarId || !process.env.BACKEND_PUBLIC_URL) return;
  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomBytes(24).toString('hex');
  const response = await googleFetch<{ resourceId?: string; expiration?: string }>(
    connection,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events/watch`,
    {
      method: 'POST',
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: `${backendPublicUrl()}/api/integrations/google-calendar/webhook/google-calendar`,
        token: channelToken,
      }),
    },
  );
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      watchChannelId: channelId,
      watchResourceId: response.resourceId || null,
      watchExpiration: response.expiration ? new Date(Number(response.expiration)) : null,
      watchTokenHash: crypto.createHash('sha256').update(channelToken).digest('hex'),
    },
  });
}

export async function stopWatch(connection: CalendarConnection) {
  if (!connection.watchChannelId || !connection.watchResourceId) return;
  await googleFetch<void>(connection, 'https://www.googleapis.com/calendar/v3/channels/stop', {
    method: 'POST',
    body: JSON.stringify({
      id: connection.watchChannelId,
      resourceId: connection.watchResourceId,
    }),
  }).catch(() => undefined);
}

export async function disconnectGoogleCalendar(userId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!connection) return;
  await stopWatch(connection as CalendarConnection);
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      status: 'DISCONNECTED',
      accessToken: null,
      refreshToken: null,
      syncToken: null,
      watchChannelId: null,
      watchResourceId: null,
      watchExpiration: null,
      watchTokenHash: null,
      disconnectedAt: new Date(),
    },
  });
}

export async function handleGoogleCalendarWebhook(headers: Record<string, string | string[] | undefined>) {
  const channelId = String(headers['x-goog-channel-id'] || '');
  const resourceId = String(headers['x-goog-resource-id'] || '');
  const token = String(headers['x-goog-channel-token'] || '');
  if (!channelId || !resourceId) return false;

  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { watchChannelId: channelId, watchResourceId: resourceId, status: 'ACTIVE' },
  });
  if (!connection) return false;
  const tokenHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
  if (connection.watchTokenHash && connection.watchTokenHash !== tokenHash) return false;
  await enqueueGoogleCalendarSyncJob(connection.id, 'WEBHOOK', {
    resourceState: headers['x-goog-resource-state'],
    messageNumber: headers['x-goog-message-number'],
  });
  return true;
}

export async function processGoogleCalendarSyncJobs(limit = 10) {
  const jobs = await prisma.googleCalendarSyncJob.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: MAX_SYNC_ATTEMPTS },
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  for (const job of jobs) {
    await prisma.googleCalendarSyncJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
    try {
      const connection = job.connectionId
        ? await prisma.googleCalendarConnection.findUnique({ where: { id: job.connectionId } })
        : null;
      if (!connection || !['ACTIVE', 'ERROR'].includes(connection.status)) throw new Error('Active Google Calendar connection not found');
      if (job.jobType === 'INITIAL') await pushExistingSchedules(connection as CalendarConnection);
      await pullGoogleEvents(connection as CalendarConnection, job.jobType === 'INITIAL');
      if (job.jobType === 'INITIAL' || job.jobType === 'WATCH_RENEWAL') {
        const latest = await prisma.googleCalendarConnection.findUnique({ where: { id: connection.id } });
        await startWatch(latest as CalendarConnection);
      }
      await prisma.googleCalendarSyncJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', finishedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = job.attempts + 1;
      const retryMinutes = Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
      await prisma.googleCalendarSyncJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: message,
          finishedAt: new Date(),
          scheduledAt: attempts >= MAX_SYNC_ATTEMPTS ? job.scheduledAt : new Date(Date.now() + retryMinutes * 60_000),
        },
      });
      if (job.connectionId) {
        await prisma.googleCalendarConnection.update({
          where: { id: job.connectionId },
          data: { status: message.includes('refresh') || message.includes('invalid_grant') ? 'REAUTH_REQUIRED' : 'ERROR', lastError: message },
        }).catch(() => undefined);
      }
    }
  }
}

export async function enqueuePollAndWatchRenewalJobs() {
  const now = new Date();
  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const connections = await prisma.googleCalendarConnection.findMany({
    where: { status: { in: ['ACTIVE', 'ERROR'] }, calendarId: { not: null } },
  });
  for (const connection of connections) {
    await enqueueGoogleCalendarSyncJob(connection.id, 'POLL');
    if (!connection.watchExpiration || connection.watchExpiration < renewBefore || connection.watchExpiration < now) {
      await enqueueGoogleCalendarSyncJob(connection.id, 'WATCH_RENEWAL');
    }
  }
}
