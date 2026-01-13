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

  const member1 = await prisma.user.create({
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

  const member2 = await prisma.user.create({
    data: {
      name: '山田花子',
      email: 'member2@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#8B5CF6',
    },
  });

  const member3 = await prisma.user.create({
    data: {
      name: '鈴木次郎',
      email: 'member3@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '観光課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EC4899',
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

  const government = await prisma.user.create({
    data: {
      name: '役場担当者',
      email: 'government@test.com',
      password: hashedPassword,
      role: 'GOVERNMENT',
      avatarColor: '#06B6D4',
    },
  });

  // P1: テストユーザー追加（協力隊2名+役場1名）- upsertで安全に追加
  const testMember1 = await prisma.user.upsert({
    where: { email: 'sato.taro@test.com' },
    update: {},
    create: {
      name: '佐藤太郎',
      email: 'sato.taro@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EF4444',
    },
  });

  const testMember2 = await prisma.user.upsert({
    where: { email: 'suzuki.hanako@test.com' },
    update: {},
    create: {
      name: '鈴木花子',
      email: 'suzuki.hanako@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'MISSION',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#10B981',
    },
  });

  const testGovernment = await prisma.user.upsert({
    where: { email: 'tanaka.ichiro@test.com' },
    update: {},
    create: {
      name: '田中一郎',
      email: 'tanaka.ichiro@test.com',
      password: hashedPassword,
      role: 'GOVERNMENT',
      avatarColor: '#F59E0B',
    },
  });

  console.log('✅ Created users:', {
    master: master.email,
    member1: member1.email,
    member2: member2.email,
    member3: member3.email,
    support: support.email,
    government: government.email,
    testMember1: testMember1.email,
    testMember2: testMember2.email,
    testGovernment: testGovernment.email,
  });

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
      userId: member1.id,
      date: today,
      startTime: '09:00',
      endTime: '17:00',
      locationText: 'ながぬまホワイトベース',
      activityDescription: 'ウェブサイト更新作業',
      freeNote: '新しいコンテンツの追加',
      isPending: false,
    },
  });

  await prisma.schedule.create({
    data: {
      userId: member2.id,
      date: today,
      startTime: '10:00',
      endTime: '16:00',
      locationText: '役場',
      activityDescription: '会議参加',
      freeNote: '月次報告の準備',
      isPending: false,
    },
  });

  console.log('✅ Created sample schedules');

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
