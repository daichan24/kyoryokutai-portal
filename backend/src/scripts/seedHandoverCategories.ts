import prisma from '../lib/prisma';

async function seedHandoverCategories() {
  console.log('🌱 Seeding handover categories...');

  const categories = [
    {
      id: 'cat-activity-report',
      name: '活動報告会',
      type: 'EVENT' as const,
      description: '年度ごとの活動報告会の準備・実施記録',
      sortOrder: 1,
    },
    {
      id: 'cat-trial-tour',
      name: '協力隊お試しツアー',
      type: 'EVENT' as const,
      description: '協力隊体験ツアーの企画・運営記録',
      sortOrder: 2,
    },
    {
      id: 'cat-yuuyake-market',
      name: '夕やけ市',
      type: 'EVENT' as const,
      description: '夕やけ市の出店・運営記録',
      sortOrder: 3,
    },
    {
      id: 'cat-maoi-festival',
      name: 'ながぬまマオイ夢祭り',
      type: 'EVENT' as const,
      description: 'マオイ夢祭りの参加・協力記録',
      sortOrder: 4,
    },
    {
      id: 'cat-internship',
      name: 'インターンシップ',
      type: 'EVENT' as const,
      description: 'インターンシップの受け入れ記録',
      sortOrder: 5,
    },
    {
      id: 'cat-team-meeting',
      name: '協力隊MTG',
      type: 'MEETING' as const,
      description: '協力隊ミーティングの議事録',
      sortOrder: 100,
    },
  ];

  for (const category of categories) {
    await prisma.handoverCategory.upsert({
      where: { id: category.id },
      update: {},
      create: category,
    });
    console.log(`✅ Created/Updated: ${category.name}`);
  }

  console.log('✨ Seeding completed!');
}

seedHandoverCategories()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
