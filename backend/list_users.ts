import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true
    },
    take: 50
  });

  console.log('--- USER LIST ---');
  users.forEach(u => {
    console.log(`${u.id}: ${u.name} <${u.email}>`);
  });
  console.log('--- END OF LIST ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
