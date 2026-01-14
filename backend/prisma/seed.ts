import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data (スケジュールとレポートのみ)
  await prisma.weeklyReport.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.location.deleteMany();
  
  // 不要なユーザーを削除（古いメールアドレスやリストにないユーザー）
  const emailsToDelete = [
    'member@test.com',
    'member2@test.com',
    'member3@test.com',
    'support@test.com',
    'government@test.com',
    'sato.taro@test.com', // 佐藤太郎
    'suzuki.hanako@test.com', // 鈴木花子
    'tanaka.ichiro@test.com', // 田中一郎
    'takada@test.com', // 追加: takada@test.comを削除
  ];
  
  // 高田和孝が複数いる場合、古いメールアドレスの方を削除
  const oldTakadaEmail = 'government@test.com'; // デフォルトでいた方
  
  for (const email of emailsToDelete) {
    await prisma.user.deleteMany({
      where: { email },
    });
  }
  
  // 高田和孝が古いメールアドレスで存在する場合は削除
  const oldTakada = await prisma.user.findFirst({
    where: { 
      email: oldTakadaEmail,
      name: { contains: '高田' }
    },
  });
  if (oldTakada) {
    await prisma.user.delete({
      where: { id: oldTakada.id },
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. マスター（メールアドレスはmaster@test.comのまま）
  const master = await prisma.user.upsert({
    where: { email: 'master@test.com' },
    update: { name: '佐藤大地' },
    create: {
      name: '佐藤大地',
      email: 'master@test.com',
      password: hashedPassword,
      role: 'MASTER',
      avatarColor: '#3B82F6',
    },
  });

  // 2. サポート（2名）
  const support1 = await prisma.user.upsert({
    where: { email: 'sakamoto.isshi@test.com' },
    update: { name: '坂本一志' },
    create: {
      name: '坂本一志',
      email: 'sakamoto.isshi@test.com',
      password: hashedPassword,
      role: 'SUPPORT',
      avatarColor: '#F59E0B',
    },
  });

  const support2 = await prisma.user.upsert({
    where: { email: 'masuda.kenji@test.com' },
    update: { name: '増田健司' },
    create: {
      name: '増田健司',
      email: 'masuda.kenji@test.com',
      password: hashedPassword,
      role: 'SUPPORT',
      avatarColor: '#F97316',
    },
  });

  // 3. 行政（2名）
  const government1 = await prisma.user.upsert({
    where: { email: 'takada.kazutaka@test.com' },
    update: { name: '高田和孝' },
    create: {
      name: '高田和孝',
      email: 'takada.kazutaka@test.com',
      password: hashedPassword,
      role: 'GOVERNMENT',
      avatarColor: '#06B6D4',
    },
  });

  const government2 = await prisma.user.upsert({
    where: { email: 'makino.shiori@test.com' },
    update: { name: '牧野栞里' },
    create: {
      name: '牧野栞里',
      email: 'makino.shiori@test.com',
      password: hashedPassword,
      role: 'GOVERNMENT',
      avatarColor: '#8B5CF6',
    },
  });

  // 4. メンバー（11名 - メールアドレスを名前ベースに変更）
  const member1 = await prisma.user.upsert({
    where: { email: 'eto.seiyo@test.com' },
    update: { name: '江藤誠洋' },
    create: {
      name: '江藤誠洋',
      email: 'eto.seiyo@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#10B981',
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'tokudome.masaya@test.com' },
    update: { name: '徳留正也' },
    create: {
      name: '徳留正也',
      email: 'tokudome.masaya@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#8B5CF6',
    },
  });

  const member3 = await prisma.user.upsert({
    where: { email: 'arima.keisuke@test.com' },
    update: { name: '有馬圭亮' },
    create: {
      name: '有馬圭亮',
      email: 'arima.keisuke@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '観光課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EC4899',
    },
  });

  const member4 = await prisma.user.upsert({
    where: { email: 'okada.ayaka@test.com' },
    update: { name: '岡田彩葵' },
    create: {
      name: '岡田彩葵',
      email: 'okada.ayaka@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EF4444',
    },
  });

  const member5 = await prisma.user.upsert({
    where: { email: 'kanayama.masahiro@test.com' },
    update: { name: '金山真大' },
    create: {
      name: '金山真大',
      email: 'kanayama.masahiro@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#F59E0B',
    },
  });

  const member6 = await prisma.user.upsert({
    where: { email: 'sou.guanyu@test.com' },
    update: { name: '曹冠宇' },
    create: {
      name: '曹冠宇',
      email: 'sou.guanyu@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '観光課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#06B6D4',
    },
  });

  const member7 = await prisma.user.upsert({
    where: { email: 'ogawa.sayaka@test.com' },
    update: { name: '小川紗綾佳' },
    create: {
      name: '小川紗綾佳',
      email: 'ogawa.sayaka@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#8B5CF6',
    },
  });

  const member8 = await prisma.user.upsert({
    where: { email: 'kanematsu.seigo@test.com' },
    update: { name: '兼松成伍' },
    create: {
      name: '兼松成伍',
      email: 'kanematsu.seigo@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#10B981',
    },
  });

  const member9 = await prisma.user.upsert({
    where: { email: 'tanaka.natsuko@test.com' },
    update: { name: '田中奈都子' },
    create: {
      name: '田中奈都子',
      email: 'tanaka.natsuko@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '観光課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EC4899',
    },
  });

  const member10 = await prisma.user.upsert({
    where: { email: 'maeno.sumire@test.com' },
    update: { name: '前野寿美麗' },
    create: {
      name: '前野寿美麗',
      email: 'maeno.sumire@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '企画課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#EF4444',
    },
  });

  const member11 = await prisma.user.upsert({
    where: { email: 'nakamura.kurumi@test.com' },
    update: { name: '中村来実' },
    create: {
      name: '中村来実',
      email: 'nakamura.kurumi@test.com',
      password: hashedPassword,
      role: 'MEMBER',
      missionType: 'FREE',
      department: '総務課',
      termStart: new Date('2024-04-01'),
      termEnd: new Date('2027-03-31'),
      avatarColor: '#F59E0B',
    },
  });

  console.log('✅ Created/Updated users:', {
    master: '***',
    support1: support1.name,
    support2: support2.name,
    government1: government1.name,
    government2: government2.name,
    members: [
      member1.name,
      member2.name,
      member3.name,
      member4.name,
      member5.name,
      member6.name,
      member7.name,
      member8.name,
      member9.name,
      member10.name,
      member11.name,
    ],
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
