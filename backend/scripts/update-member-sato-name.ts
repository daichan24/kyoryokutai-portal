import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating member 佐藤大地 to さとうだいち...');

  // メンバーで「佐藤大地」という名前のユーザーを検索
  const memberSato = await prisma.user.findFirst({
    where: {
      role: 'MEMBER',
      name: '佐藤大地',
    },
  });

  if (memberSato) {
    await prisma.user.update({
      where: { id: memberSato.id },
      data: { name: 'さとうだいち' },
    });
    console.log(`✅ Updated user ${memberSato.email} from 佐藤大地 to さとうだいち`);
  } else {
    console.log('ℹ️ No member with name 佐藤大地 found');
  }

  // 念のため、メンバーで「さとうだいち」が存在するか確認
  const memberSatoHiragana = await prisma.user.findFirst({
    where: {
      role: 'MEMBER',
      name: 'さとうだいち',
    },
  });

  if (memberSatoHiragana) {
    console.log(`✅ Member さとうだいち exists: ${memberSatoHiragana.email}`);
  } else {
    console.log('⚠️ Member さとうだいち does not exist. Please run seed.ts to create it.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

