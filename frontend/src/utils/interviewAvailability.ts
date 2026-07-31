import type { InterviewPollStatus } from '../types';

export function canMemberEditInterviewAvailability(status: InterviewPollStatus): boolean {
  return status === 'COLLECTING' || status === 'PROPOSED';
}
