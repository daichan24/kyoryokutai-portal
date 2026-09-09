import { expect, it } from 'vitest';
import { getScheduleMove } from './calendarMovement';
const oneDay = { date: '2026-09-07', startDate: '2026-09-07', endDate: '2026-09-07', startTime: '00:00', endTime: '23:59' };
it.each(['dayGridMonth', 'timeGridWeek'])('single full-day leave keeps inclusive dates and time in %s', view => {
  expect(getScheduleMove(oneDay, { allDay: true, start: new Date(2026,8,8), end: new Date(2026,8,9), startStr: '2026-09-08', endStr: '2026-09-09' }, view)).toEqual({ date: '2026-09-08', endDate: '2026-09-08', startTime: '00:00', endTime: '23:59' });
});
it.each(['dayGridMonth', 'timeGridWeek'])('multi-day boundary subtracts exclusive end in %s', view => {
  expect(getScheduleMove({ ...oneDay, endDate: '2026-09-09' }, { allDay: true, start: new Date(2026,8,29), end: new Date(2026,9,2), startStr: '2026-09-29', endStr: '2026-10-02' }, view)).toEqual({ date: '2026-09-29', endDate: '2026-10-01', startTime: '00:00', endTime: '23:59' });
});
it('missing exclusive end preserves original day span without UTC conversion', () => {
  expect(getScheduleMove({ ...oneDay, endDate: '2026-09-09' }, { allDay: true, start: new Date('2026-09-30T00:00:00+09:00'), end: null, startStr: '2026-09-30' }, 'timeGridWeek')).toEqual({ date: '2026-09-30', endDate: '2026-10-02', startTime: '00:00', endTime: '23:59' });
});
it('normal timed week move uses new time', () => {
  expect(getScheduleMove({ ...oneDay, startTime: '09:00', endTime: '10:30' }, { allDay: false, start: new Date(2026,8,8,11), end: new Date(2026,8,8,12,30) }, 'timeGridWeek')).toEqual({ date: '2026-09-08', startTime: '11:00', endTime: '12:30' });
});
it('normal timed month move preserves time', () => {
  expect(getScheduleMove({ ...oneDay, startTime: '09:00', endTime: '10:30' }, { allDay: false, start: new Date(2026,8,8,11), end: new Date(2026,8,8,12,30) }, 'dayGridMonth')).toEqual({ date: '2026-09-08', startTime: '09:00', endTime: '10:30' });
});
