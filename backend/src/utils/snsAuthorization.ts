import type { Role } from '@prisma/client';

export function canModifyOwnSnsPost(
  requester: { id: string; role: Role },
  postUserId: string,
): boolean {
  return requester.role !== 'MEMBER' || requester.id === postUserId;
}
