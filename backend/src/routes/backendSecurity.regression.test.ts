import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateHeaderValue } from 'node:http';
import type { Router, Response } from 'express';
import type { AuthRequest } from '../middleware/auth';

const db = vi.hoisted(() => {
  const delegate = () => Object.fromEntries(['findUnique', 'findFirst', 'findMany', 'create', 'update', 'delete'].map(key => [key, vi.fn()]));
  return { request: delegate(), inspection: delegate(), sNSPost: delegate(), event: delegate(), eventParticipation: delegate(), user: delegate(), contact: delegate(), contactHistory: delegate(), schedule: delegate(), timeAdjustment: delegate(), aiAccessToken: delegate(), $transaction: vi.fn() };
});
vi.mock('../lib/prisma', () => ({ default: db }));
vi.mock('../services/approvalEmailService', () => ({ notifyInspectionSubmitted: vi.fn().mockResolvedValue(undefined), notifyInspectionResult: vi.fn().mockResolvedValue(undefined), notifyCompensatoryLeaveConfirmed: vi.fn(), notifyCompensatoryLeaveSubmitted: vi.fn(), notifyTimeAdjustmentConfirmed: vi.fn(), notifyTimeAdjustmentSubmitted: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/notificationService', () => ({ notifyRequest: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/defaultSnsAccountService', () => ({ ensureDefaultInstagramAccount: vi.fn() }));
vi.mock('../services/pdfGenerator', () => ({ generateNudgePDF: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')) }));
import requests from './requests';
import inspections from './inspections';
import snsPosts from './snsPosts';
import events from './events';
import contacts from './contacts';
import users from './users';
import leave from './leave';
import nudges from './nudges';
import { authenticate } from '../middleware/auth';

const own = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sid = '33333333-3333-4333-8333-333333333333';
const safeUser = { id: own, name: 'Member', email: 'member@example.test', role: 'MEMBER', avatarColor: '#123456', isTestAccount: false, pdfFileNameTemplates: { inspection: '{name}_{date}' } };
const rawUser = { ...safeUser, password: 'fictional-hash', passwordUpdatedAt: new Date() };
// Model Prisma's projection at the DB boundary, leaving the real handler untouched.
function projectUser(selection: unknown) {
  if (selection === true) return rawUser;
  const select = (selection as { select: Record<string, boolean> }).select;
  return Object.fromEntries(Object.entries(rawUser).filter(([key]) => select[key]));
}
function response() {
  const result = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; }, send(body: unknown) { this.body = body; return this; }, setHeader(name: string, value: string) { validateHeaderValue(name, value); this.headers[name] = value; }, on: vi.fn() };
  return result;
}
async function invoke(router: Router, method: string, path: string, body = {}, params = {}, role = 'MEMBER', id = own) {
  const layer = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
  const handler = layer.route.stack.at(-1).handle;
  const res = response();
  await handler({ body, params, query: {}, user: { id, role, email: 'test@example.test' }, authContext: { kind: 'SESSION' } }, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async fn => fn(db));
  db.user.findUnique.mockResolvedValue({ role: 'MEMBER' });
  db.user.update.mockResolvedValue(safeUser);
  db.schedule.findUnique.mockResolvedValue({ id: sid, userId: other, isDayOff: true, dayOffType: 'TIME_ADJUST' });
  db.schedule.create.mockResolvedValue({ id: 'generated' });
  db.schedule.update.mockResolvedValue({ id: sid });
  db.schedule.delete.mockResolvedValue({ id: sid });
  db.timeAdjustment.create.mockImplementation(async ({ data }) => ({ id: 'adjustment', ...data }));
  db.timeAdjustment.update.mockImplementation(async ({ data }) => ({ id: 'adjustment', ...data }));
  db.timeAdjustment.findUnique.mockResolvedValue({ id: 'adjustment', userId: own, usedScheduleId: sid, hours: 2, usedAt: new Date('2026-09-07'), usedStartTime: '09:00', usedEndTime: '10:00', note: null });
  db.aiAccessToken.findFirst.mockResolvedValue({ id: 'token', userId: own, user: safeUser, scopes: ['schedules:read:self'], name: 'test', expiresAt: null, revokedAt: null });
  db.aiAccessToken.update.mockResolvedValue({});
});
describe('public User boundaries', () => {
  it('contact detail omits credentials from creator and history for MEMBER', async () => {
    db.contact.findUnique.mockImplementation(async ({ include }) => ({ creator: projectUser(include.creator), histories: [{ userId: other, user: projectUser(include.histories.include.user), projectId: 'secret-project' }] }));
    const res = await invoke(contacts, 'get', '/:id', {}, { id: 'contact' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ creator: safeUser, histories: [{ userId: other, user: safeUser, projectId: null, project: null }] });
  });
  it.each(['post', 'put'])('contact %s response omits credentials', async method => {
    db.contact[method === 'post' ? 'create' : 'update'].mockImplementation(async ({ include }) => ({ creator: projectUser(include.creator) }));
    const res = await invoke(contacts, method, method === 'post' ? '/' : '/:id', { name: 'Contact' }, { id: 'contact' });
    expect(res.body).toEqual({ creator: safeUser });
  });
  it('contact history write response omits credentials', async () => {
    db.contactHistory.create.mockImplementation(async ({ include }) => ({ user: projectUser(include.user) }));
    const res = await invoke(contacts, 'post', '/:id/histories', { date: '2026-09-07', content: 'Meeting' }, { id: 'contact' });
    expect(res.body).toEqual({ user: safeUser });
  });
});
describe('other public User write responses', () => {
  it.each(['post', 'put'])('inspection %s excludes credentials', async method => {
    db.inspection.findUnique.mockResolvedValue({ id: 'inspection', userId: own });
    db.inspection[method === 'post' ? 'create' : 'update'].mockImplementation(async ({ include }) => ({ user: projectUser(include.user) }));
    const res = await invoke(inspections, method, method === 'post' ? '/' : '/:id', { date: '2026-09-07', destination: 'Town', purpose: 'Meeting' }, { id: 'inspection' });
    expect(res.statusCode).toBe(method === 'post' ? 201 : 200); expect(res.body).toEqual({ user: safeUser });
  });
  it.each(['create', 'update'])('SNS %s excludes credentials', async operation => {
    db.sNSPost.findFirst.mockResolvedValue(operation === 'create' ? null : { id: 'post' });
    db.sNSPost[operation].mockImplementation(async ({ include }) => ({ user: projectUser(include.user) }));
    const res = await invoke(snsPosts, 'post', '/', { postedAt: '2026-09-07', postType: 'FEED' });
    expect(res.statusCode).toBe(200); expect(res.body).toEqual({ user: safeUser });
  });
  it.each(['create', 'respond', 'detail'])('request %s excludes requester/requestee credentials', async operation => {
    const projected = ({ include }: { include: { requester: unknown; requestee: unknown } }) => ({ requestedBy: own, requestedTo: own, requester: projectUser(include.requester), requestee: projectUser(include.requestee) });
    db.request.findUnique.mockImplementation(async args => operation === 'detail' ? projected(args) : { requestedTo: own });
    db.request.create.mockImplementation(async args => projected(args)); db.request.update.mockImplementation(async args => projected(args));
    const res = operation === 'detail'
      ? await invoke(requests, 'get', '/:id', {}, { id: 'request' })
      : await invoke(requests, 'post', operation === 'create' ? '/' : '/:id/respond', operation === 'create' ? { requesteeId: other, requestTitle: 'Please help', requestDescription: 'Meeting' } : { approvalStatus: 'REJECTED' }, { id: 'request' });
    expect(res.statusCode).toBe(operation === 'create' ? 201 : 200);
    expect(res.body).toMatchObject({ requester: safeUser, requestee: safeUser });
  });
  it('event participation excludes user credentials', async () => {
    db.eventParticipation.findUnique.mockResolvedValue(null);
    db.eventParticipation.create.mockImplementation(async ({ include }) => ({ event: { id: 'event', date: new Date('2026-09-07'), eventName: 'Meeting' }, user: projectUser(include.user) }));
    const res = await invoke(events, 'post', '/:id/participate', { participationType: 'PARTICIPATION' }, { id: 'event' });
    expect(res.statusCode).toBe(201); expect(res.body).toMatchObject({ user: safeUser });
  });
});
describe('display order authorization', () => {
  it.each(['SUPPORT', 'GOVERNMENT'])('%s can reorder only', async role => {
    expect((await invoke(users, 'put', '/:id', { displayOrder: 2 }, { id: other }, role)).statusCode).toBe(200);
    db.user.update.mockClear();
    const res = await invoke(users, 'put', '/:id', { displayOrder: 2, email: 'changed@example.test', name: 'Changed' }, { id: other }, role);
    expect(res.statusCode).toBe(403);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it.each(['MEMBER', 'SUPPORT', 'GOVERNMENT', 'MASTER'])('%s can edit own ordinary fields', async role => {
    expect((await invoke(users, 'put', '/:id', { name: 'New name' }, { id: own }, role)).statusCode).toBe(200);
  });
  it('MASTER can mix reorder and profile edit', async () => {
    expect((await invoke(users, 'put', '/:id', { displayOrder: 2, name: 'Changed' }, { id: other }, 'MASTER')).statusCode).toBe(200);
  });
});
describe('AI schedule self scope', () => {
  it.each(['/api/schedules', '/api/schedules/'])('%s rejects cross-user queries and pins omitted user', async path => {
    for (const query of [{ userId: other }, { allMembers: 'true' }, { userIds: own }]) {
      const res = response(); const next = vi.fn();
      await authenticate({ method: 'GET', originalUrl: path, query, headers: { authorization: 'Bearer cbai_test' } } as unknown as AuthRequest, res as unknown as Response, next);
      expect(res.statusCode).toBe(403); expect(next).not.toHaveBeenCalled();
    }
    const req = { method: 'GET', originalUrl: path, query: {}, headers: { authorization: 'Bearer cbai_test' } } as unknown as AuthRequest;
    const res = response(); const next = vi.fn();
    await authenticate(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled(); expect(req.query.userId).toBe(own);
  });
});
describe('time adjustment schedule ownership', () => {
  it.each([{ userId: other, isDayOff: true, dayOffType: 'TIME_ADJUST' }, { userId: own, isDayOff: false, dayOffType: null }, { userId: own, isDayOff: true, dayOffType: 'PAID' }])('rejects invalid attachment %j for create and update', async schedule => {
    db.schedule.findUnique.mockResolvedValue({ id: sid, ...schedule });
    for (const method of ['post', 'put']) {
      const res = await invoke(leave, method, method === 'post' ? '/time-adjustments' : '/time-adjustments/:id', { adjustedAt: '2026-09-07', hours: 2, usedScheduleId: sid }, { id: 'adjustment' });
      expect(res.statusCode).toBe(403);
    }
    expect(db.schedule.update).not.toHaveBeenCalled(); expect(db.timeAdjustment.create).not.toHaveBeenCalled();
  });
  it('deleting a legacy foreign link preserves the foreign schedule', async () => {
    expect((await invoke(leave, 'delete', '/time-adjustments/:id', {}, { id: 'adjustment' })).statusCode).toBe(200);
    expect(db.schedule.delete).not.toHaveBeenCalled();
  });
  it.each(['lookup', 'delete', 'concurrent missing'])('primary deletion succeeds when linked cleanup fails: %s', async failure => {
    db.schedule.findUnique.mockResolvedValue({ id: sid, userId: own, isDayOff: true, dayOffType: 'TIME_ADJUST' });
    if (failure === 'lookup') db.schedule.findUnique.mockRejectedValueOnce(new Error('Database temporarily unavailable'));
    else db.schedule.delete.mockRejectedValueOnce(Object.assign(new Error('Cleanup failed'), { code: failure === 'concurrent missing' ? 'P2025' : 'P1001' }));
    const res = await invoke(leave, 'delete', '/time-adjustments/:id', {}, { id: 'adjustment' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(db.timeAdjustment.delete).toHaveBeenCalledWith({ where: { id: 'adjustment' } });
    if (failure === 'lookup') expect(db.schedule.delete).not.toHaveBeenCalled();
    else expect(db.schedule.delete).toHaveBeenCalledWith({ where: { id: sid } });
  });
  it.each([
    { userId: other, isDayOff: true, dayOffType: 'TIME_ADJUST' },
    { userId: own, isDayOff: false, dayOffType: null },
    { userId: own, isDayOff: true, dayOffType: 'PAID' },
  ])('successful deletion never cleans up an invalid linked target: %j', async target => {
    db.schedule.findUnique.mockResolvedValue({ id: sid, ...target });
    const res = await invoke(leave, 'delete', '/time-adjustments/:id', {}, { id: 'adjustment' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(db.timeAdjustment.delete).toHaveBeenCalledWith({ where: { id: 'adjustment' } });
    expect(db.schedule.delete).not.toHaveBeenCalled();
    expect(db.schedule.update).not.toHaveBeenCalled();
  });
  it('updating a legacy foreign link never updates it', async () => {
    await invoke(leave, 'put', '/time-adjustments/:id', { note: 'Changed' }, { id: 'adjustment' });
    expect(db.schedule.update).not.toHaveBeenCalled();
  });
  it('own valid usage update and deletion work', async () => {
    db.schedule.findUnique.mockResolvedValue({ id: sid, userId: own, isDayOff: true, dayOffType: 'TIME_ADJUST' });
    expect((await invoke(leave, 'put', '/time-adjustments/:id', { note: 'Changed' }, { id: 'adjustment' })).statusCode).toBe(200);
    expect(db.schedule.update).toHaveBeenCalled();
    expect((await invoke(leave, 'delete', '/time-adjustments/:id', {}, { id: 'adjustment' })).statusCode).toBe(200);
    expect(db.schedule.delete).toHaveBeenCalled();
  });
  it('server-created usage link cannot be overridden by body', async () => {
    db.schedule.findUnique.mockResolvedValue({ id: sid, userId: own, isDayOff: true, dayOffType: 'TIME_ADJUST' });
    const res = await invoke(leave, 'post', '/time-adjustments', { adjustedAt: '2026-09-07', hours: 2, usedScheduleId: sid, usedAt: '2026-09-07', usedStartTime: '09:00', usedEndTime: '10:00' });
    expect(res.statusCode).toBe(200); expect(res.body).toMatchObject({ usedScheduleId: 'generated' });
  });
});
it('Japanese nudge PDF has valid ASCII header and UTF-8 filename metadata', async () => {
  const res = await invoke(nudges, 'get', '/:fiscalYear/pdf', {}, { fiscalYear: '2026' });
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Disposition']).toContain("filename*=UTF-8''");
  expect(decodeURIComponent(res.headers['Content-Disposition'].split("filename*=UTF-8''")[1])).toContain('協力隊細則_2026年度');
});
