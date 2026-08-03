import type { InterviewAvailabilityStatus, InterviewPollStatus } from '../types';

export function canMemberEditInterviewAvailability(status: InterviewPollStatus): boolean {
  return status === 'COLLECTING' || status === 'PROPOSED';
}

export function nextStaffInterviewAvailabilityStatus(
  current?: InterviewAvailabilityStatus,
): InterviewAvailabilityStatus {
  return current === 'OK' ? 'NG' : 'OK';
}
