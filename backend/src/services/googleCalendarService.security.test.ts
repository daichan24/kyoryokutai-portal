import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => {
  const delegate = () => Object.fromEntries(['findUnique', 'findFirst', 'create', 'update', 'upsert'].map(key => [key, vi.fn()]));
  return { schedule: delegate(), googleCalendarEventLink: delegate(), googleCalendarConnection: delegate() };
});
vi.mock('../lib/prisma', () => ({ default: db }));
import { syncScheduleToGoogle, upsertScheduleFromGoogleEvent } from './googleCalendarService';
const connection = { id: 'connection', userId: 'own', calendarId: 'calendar', status: 'ACTIVE', accessToken: 'test-token', tokenExpiry: new Date('2099-01-01') } as unknown as Parameters<typeof upsertScheduleFromGoogleEvent>[0];
const event = { id: 'event', summary: 'Imported', start: { date: '2026-09-07' }, end: { date: '2026-09-08' }, extendedProperties: { private: { clearbaseScheduleId: 'schedule', connectionUserId: 'own' } } };
const schedule = { id: 'schedule', userId: 'own', title: 'Own schedule', isAllDay: true, startDate: new Date('2026-09-07'), updatedAt: new Date('2026-09-01') };
const link = { id: 'link', scheduleId: 'schedule', userId: 'own', connectionId: 'connection', googleCalendarId: 'calendar', googleEventId: 'event' };
beforeEach(() => {
  vi.resetAllMocks();
  db.schedule.findUnique.mockResolvedValue(schedule);
  db.schedule.create.mockResolvedValue({ id: 'imported' });
  db.googleCalendarEventLink.findUnique.mockResolvedValue(null);
  db.googleCalendarConnection.findFirst.mockResolvedValue(connection);
  db.googleCalendarConnection.findUnique.mockResolvedValue(connection);
});
describe('Google import ownership', () => {
  it.each(['confirmed', 'cancelled'])('foreign owner external ID cannot mutate schedules (%s)', async status => {
    db.schedule.findUnique.mockResolvedValue({ ...schedule, userId: 'other' });
    await upsertScheduleFromGoogleEvent(connection, { ...event, status }).catch(() => undefined);
    expect(db.schedule.update).not.toHaveBeenCalled(); expect(db.googleCalendarEventLink.upsert).not.toHaveBeenCalled();
  });
  it.each(['confirmed', 'cancelled'])('foreign connection link cannot mutate schedules (%s)', async status => {
    db.googleCalendarEventLink.findUnique.mockResolvedValue({ ...link, connectionId: 'other-connection' });
    await upsertScheduleFromGoogleEvent(connection, { ...event, status }).catch(() => undefined);
    expect(db.schedule.update).not.toHaveBeenCalled(); expect(db.googleCalendarEventLink.update).not.toHaveBeenCalled();
  });
  it.each(['confirmed', 'cancelled'])('even an existing link cannot mutate a foreign schedule (%s)', async status => {
    db.googleCalendarEventLink.findUnique.mockResolvedValue(link);
    db.schedule.findUnique.mockResolvedValue({ ...schedule, userId: 'other', deletedAt: new Date() });
    await expect(upsertScheduleFromGoogleEvent(connection, { ...event, status })).rejects.toThrow('FORBIDDEN');
    expect(db.schedule.update).not.toHaveBeenCalled();
  });
  it('fallback ID cannot adopt a schedule linked to another connection/calendar', async () => {
    db.googleCalendarEventLink.findUnique.mockImplementation(async ({ where }) => where.scheduleId ? { ...link, connectionId: 'previous-connection', googleCalendarId: 'previous-calendar' } : null);
    await expect(upsertScheduleFromGoogleEvent(connection, event)).rejects.toThrow('FORBIDDEN');
    expect(db.schedule.update).not.toHaveBeenCalled();
  });
  it('external ID cannot steal another event link on the same owned schedule', async () => {
    db.googleCalendarEventLink.findUnique.mockImplementation(async ({ where }) => where.scheduleId ? { ...link, googleEventId: 'another-event' } : null);
    await upsertScheduleFromGoogleEvent(connection, event).catch(() => undefined);
    expect(db.schedule.update).not.toHaveBeenCalled(); expect(db.googleCalendarEventLink.upsert).not.toHaveBeenCalled();
  });
  it('external ID cannot override an existing link identity', async () => {
    db.googleCalendarEventLink.findUnique.mockResolvedValue(link);
    await upsertScheduleFromGoogleEvent(connection, { ...event, extendedProperties: { private: { clearbaseScheduleId: 'other-schedule' } } }).catch(() => undefined);
    expect(db.schedule.update).not.toHaveBeenCalled();
  });
  it('valid owned fallback ID imports and existing random link remains usable', async () => {
    await upsertScheduleFromGoogleEvent(connection, event);
    expect(db.schedule.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'schedule' }, data: expect.objectContaining({ title: 'Imported' }) }));
    db.googleCalendarEventLink.findUnique.mockResolvedValue(link);
    await upsertScheduleFromGoogleEvent(connection, { ...event, status: 'cancelled' });
    expect(db.schedule.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { deletedAt: expect.any(Date) } }));
  });
  it('a new Google event creates an owned schedule', async () => {
    await upsertScheduleFromGoogleEvent(connection, { ...event, extendedProperties: undefined });
    expect(db.schedule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'own', title: 'Imported' }) }));
  });
});
describe('Google create recovery', () => {
  function fakeGoogle() {
    const events = new Map<string, Record<string, unknown>>();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        const body = JSON.parse(init.body as string);
        const id = body.id || `random-${events.size}`;
        if (events.has(id)) return new Response('Conflict', { status: 409 });
        const created = { ...body, id }; events.set(id, created);
        return Response.json(created);
      }
      const id = decodeURIComponent(_url.split('/').at(-1)!);
      if (init.method === 'PATCH') {
        const updated = { ...JSON.parse(init.body as string), id }; events.set(id, updated); return Response.json(updated);
      }
      return events.has(id) ? Response.json(events.get(id)) : new Response('Missing', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return { events, fetchMock };
  }
  function linkStore(failFirstSave = false) {
    let current: Record<string, unknown> | null = null;
    let failed = false;
    db.googleCalendarEventLink.findUnique.mockImplementation(async () => current);
    db.googleCalendarEventLink.create.mockImplementation(async ({ data }) => {
      if (failFirstSave && !failed) { failed = true; throw new Error('DB unavailable'); }
      if (current) throw new Error('P2002');
      current = { id: 'link', ...data }; return current;
    });
    db.googleCalendarEventLink.upsert.mockImplementation(async ({ create, update }) => {
      if (failFirstSave && !failed && create.syncStatus === 'SYNCED') { failed = true; throw new Error('DB unavailable'); }
      current = current ? { ...current, ...update } : { id: 'link', ...create }; return current;
    });
    db.googleCalendarEventLink.update.mockImplementation(async ({ data }) => { current = { ...current, ...data }; return current; });
    return () => current;
  }
  it('pending link recovers after failed POST without duplicate events', async () => {
    const { events, fetchMock } = fakeGoogle(); const current = linkStore();
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(syncScheduleToGoogle('schedule')).rejects.toThrow('Network unavailable');
    await expect(syncScheduleToGoogle('schedule')).resolves.toBeUndefined();
    expect(events.size).toBe(1); expect(current()).toMatchObject({ syncStatus: 'SYNCED' });
    expect([...events.keys()][0]).toMatch(/^[0-9a-v]{5,1024}$/);
  });
  it('Google success followed by DB failure recovers one event on repeated retries', async () => {
    const { events } = fakeGoogle(); const current = linkStore(true);
    await expect(syncScheduleToGoogle('schedule')).rejects.toThrow('DB unavailable');
    await expect(syncScheduleToGoogle('schedule')).resolves.toBeUndefined();
    await expect(syncScheduleToGoogle('schedule')).resolves.toBeUndefined();
    expect(events.size).toBe(1); expect(current()).toMatchObject({ syncStatus: 'SYNCED' });
  });
  it('a lost POST response recovers the same Google event', async () => {
    const { events, fetchMock } = fakeGoogle(); const current = linkStore();
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(async (url, init) => { await normalFetch(url, init); throw new Error('Response lost'); });
    await expect(syncScheduleToGoogle('schedule')).rejects.toThrow('Response lost');
    await expect(syncScheduleToGoogle('schedule')).resolves.toBeUndefined();
    expect(events.size).toBe(1); expect(current()).toMatchObject({ syncStatus: 'SYNCED' });
  });
  it('409 recovery refuses an event with unrelated ownership metadata', async () => {
    linkStore();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('Conflict', { status: 409 })).mockResolvedValueOnce(Response.json({ ...event, extendedProperties: { private: { clearbaseScheduleId: 'other-schedule', connectionUserId: 'other' } } })));
    await expect(syncScheduleToGoogle('schedule')).rejects.toThrow();
    expect(db.googleCalendarEventLink.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ syncStatus: 'SYNCED' }) }));
  });
  it('existing random Google event IDs are patched', async () => {
    const { fetchMock } = fakeGoogle(); db.googleCalendarEventLink.findUnique.mockResolvedValue(link);
    await syncScheduleToGoogle('schedule');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/events/event'), expect.objectContaining({ method: 'PATCH' }));
  });
});
