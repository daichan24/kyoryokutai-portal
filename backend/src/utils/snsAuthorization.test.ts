import { describe, expect, it } from 'vitest';
import { canModifyOwnSnsPost } from './snsAuthorization';

describe('SNS投稿の本人更新権限', () => {
  it.each([
    ['小川紗綾佳', 'ogawa-member'],
    ['前野寿美麗', 'maeno-member'],
  ])('%sと同じMEMBER権限では自分の投稿を更新できる', (_name, memberId) => {
    expect(canModifyOwnSnsPost({ id: memberId, role: 'MEMBER' }, memberId)).toBe(true);
    expect(canModifyOwnSnsPost({ id: memberId, role: 'MEMBER' }, 'another-member')).toBe(false);
  });
});
