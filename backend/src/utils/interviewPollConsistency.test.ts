import { describe, expect, test } from 'vitest';
import { getInterviewPollAssignmentConsistency } from './interviewPollConsistency';

describe('interview poll assignment consistency', () => {
  test('treats an OK answer without a department block as consistent', () => {
    const result = getInterviewPollAssignmentConsistency({
      availability: [{ memberId: 'member-1', dateId: 'date-1', status: 'OK' }],
      assignments: [{
        id: 'assignment-1',
        memberId: 'member-1',
        dateId: 'date-1',
        member: { department: '企画課' },
        date: { unavailableDepartments: [] },
      }],
      dates: [{ id: 'date-1', capacity: 1 }],
    });

    expect(result).toEqual({ consistent: true, issues: [] });
  });

  test('reports a stale assignment when the answer is NG and the department is blocked', () => {
    const result = getInterviewPollAssignmentConsistency({
      availability: [{ memberId: 'member-1', dateId: 'date-1', status: 'NG' }],
      assignments: [{
        id: 'assignment-1',
        memberId: 'member-1',
        dateId: 'date-1',
        member: { department: '企画課' },
        date: { unavailableDepartments: ['企画課'] },
      }],
      dates: [{ id: 'date-1', capacity: 1 }],
    });

    expect(result.consistent).toBe(false);
    expect(result.issues[0].reasons).toEqual([
      '本人回答がOKではありません',
      '企画課が課NGです',
    ]);
  });

  test('reports assignments over capacity', () => {
    const result = getInterviewPollAssignmentConsistency({
      availability: [
        { memberId: 'member-1', dateId: 'date-1', status: 'OK' },
        { memberId: 'member-2', dateId: 'date-1', status: 'OK' },
      ],
      assignments: [
        { id: 'assignment-1', memberId: 'member-1', dateId: 'date-1' },
        { id: 'assignment-2', memberId: 'member-2', dateId: 'date-1' },
      ],
      dates: [{ id: 'date-1', capacity: 1 }],
    });

    expect(result.consistent).toBe(false);
    expect(result.issues).toContainEqual({
      assignmentId: '',
      memberId: '',
      dateId: 'date-1',
      reasons: ['定員1名を超えています'],
    });
  });
});
