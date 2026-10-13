import { describe, expect, it } from 'vitest';
import { buildMonthlySpentDates, resolveStatusAfterEdit } from './activityExpenseRules';

describe('buildMonthlySpentDates', () => {
  it('creates one date per month across the fiscal year boundary', () => {
    expect(buildMonthlySpentDates('2026-06-25', '2027-02')).toEqual([
      '2026-06-25', '2026-07-25', '2026-08-25', '2026-09-25', '2026-10-25',
      '2026-11-25', '2026-12-25', '2027-01-25', '2027-02-25',
    ]);
  });

  it('clamps days that do not exist to the end of the month', () => {
    expect(buildMonthlySpentDates('2027-01-31', '2027-04')).toEqual([
      '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30',
    ]);
  });

  it('allows a single month and rejects end months before the start', () => {
    expect(buildMonthlySpentDates('2026-10-05', '2026-10')).toEqual(['2026-10-05']);
    expect(() => buildMonthlySpentDates('2026-10-05', '2026-09')).toThrow('REPEAT_UNTIL_BEFORE_START');
  });

  it('rejects more than 24 months', () => {
    expect(buildMonthlySpentDates('2026-04-01', '2028-03')).toHaveLength(24);
    expect(() => buildMonthlySpentDates('2026-04-01', '2028-04')).toThrow('REPEAT_TOO_MANY');
  });
});

describe('resolveStatusAfterEdit', () => {
  it('keeps approval when only category/counterparty changed', () => {
    expect(resolveStatusAfterEdit({ currentStatus: 'APPROVED', requestedStatus: 'PENDING', coreFieldsChanged: false }))
      .toEqual({ status: 'APPROVED', keepApproval: true });
    expect(resolveStatusAfterEdit({ currentStatus: 'PENDING', requestedStatus: 'PENDING', coreFieldsChanged: false }))
      .toEqual({ status: 'PENDING', keepApproval: true });
  });

  it('sends approved entries back to pending when amount/date/etc changed', () => {
    expect(resolveStatusAfterEdit({ currentStatus: 'APPROVED', requestedStatus: 'PENDING', coreFieldsChanged: true }))
      .toEqual({ status: 'PENDING', keepApproval: false });
  });

  it('resubmits rejected entries even if only the category changed', () => {
    expect(resolveStatusAfterEdit({ currentStatus: 'REJECTED', requestedStatus: 'PENDING', coreFieldsChanged: false }))
      .toEqual({ status: 'PENDING', keepApproval: false });
  });

  it('keeps planned entries planned unless submitted', () => {
    expect(resolveStatusAfterEdit({ currentStatus: 'PLANNED', requestedStatus: 'PLANNED', coreFieldsChanged: false }))
      .toEqual({ status: 'PLANNED', keepApproval: false });
    expect(resolveStatusAfterEdit({ currentStatus: 'PLANNED', requestedStatus: 'PENDING', coreFieldsChanged: false }))
      .toEqual({ status: 'PENDING', keepApproval: false });
  });

  it('moves an approved entry to planned when explicitly requested', () => {
    expect(resolveStatusAfterEdit({ currentStatus: 'APPROVED', requestedStatus: 'PLANNED', coreFieldsChanged: false }))
      .toEqual({ status: 'PLANNED', keepApproval: false });
  });
});
