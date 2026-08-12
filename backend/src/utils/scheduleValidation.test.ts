import { describe, expect, it } from 'vitest';
import { requiresScheduleLocation } from './scheduleValidation';

describe('requiresScheduleLocation', () => {
  it('requires a location for a normal schedule', () => {
    expect(requiresScheduleLocation({ isDayOff: false, locationText: null })).toBe(true);
    expect(requiresScheduleLocation({ locationText: '   ' })).toBe(true);
  });

  it('does not require a location for a day-off schedule', () => {
    expect(requiresScheduleLocation({ isDayOff: true, locationText: null })).toBe(false);
  });

  it('accepts a location for a normal schedule', () => {
    expect(requiresScheduleLocation({ isDayOff: false, locationText: '役場' })).toBe(false);
  });
});
