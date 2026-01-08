import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  await prisma.weeklyReport.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create users
  const master = await prisma.user.create({
    data: {
      name: '佐藤大地',
      email: 'master@test.com',
      password: hashedPassword,
      role: 'MASTER',
      avatarColor: '#3B82F6',
    },
  });

  const member = await prisma.user.create({
    data: {
      name: '田中太郎',
      email: 'member@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#10B981',
    },
  });

  const support = await prisma.user.create({
    data: {
      name: '坂本一志',
      email: 'support@test.com',
      password: hashedPassword,
      role: 'SUPPORT',
      avatarColor: '#F59E0B',
    },
  });

  console.log('✅ Created users:', { master: master.email, member: member.email, support: support.email });

  // Create locations
  const locations = await Promise.all([
    prisma.location.create({
      data: { name: 'ながぬまホワイトベース', order: 1, isActive: true },
    }),
    prisma.location.create({
      data: { name: '役場', order: 2, isActive: true },
    }),
    prisma.location.create({
      data: { name: '加工センター', order: 3, isActive: true },
    }),
  ]);

  console.log('✅ Created locations:', locations.map(l => l.name).join(', '));

  // Create sample schedules
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.schedule.create({
    data: {
      userId: member.id,
      date: today,
      startTime: '09:00',
      endTime: '17:00',
      locationText: 'ながぬまホワイトベース',
      activityDescription: 'ウェブサイト更新作業',
      freeNote: '新しいコンテンツの追加',
      isPending: false,
    },
  });

  console.log('✅ Created sample schedule');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
