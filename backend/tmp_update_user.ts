import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: '守屋岳杜' },
        { email: 'tsukiko1418gm@gmail.com' }
      ]
    }
  });

  if (user) {
    console.log('User found:', JSON.stringify(user, null, 2));
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { email: 'gakuto.moriya@gmail.com' }
    });
    console.log('User email updated successfully to:', updatedUser.email);
  } else {
    console.error('User "守屋岳杜" or email "tsukiko1418gm@gmail.com" not found in the database.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
