import prisma from '../lib/prisma';

export async function ensureDefaultInstagramAccount(userId: string) {
  const existing = await prisma.sNSAccount.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.sNSAccount.create({
    data: {
      userId,
      platform: 'instagram',
      accountName: 'instagram',
      displayName: 'Instagram',
      isDefault: true,
    },
    select: { id: true },
  });
}
