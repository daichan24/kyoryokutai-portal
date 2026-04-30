import prisma from '../src/lib/prisma';
import { calculateProjectProgress } from '../src/services/progressCalculator';

async function testApiResponse() {
  console.log('🔍 Simulating full API response for interview page...\n');

  // Get first member
  const member = await prisma.user.findFirst({
    where: { role: 'MEMBER' },
    select: { id: true, name: true },
  });

  if (!member) {
    console.log('❌ No members found');
    return;
  }

  console.log(`👤 Testing with: ${member.name} (${member.id})`);
  console.log(`📅 Month: 2026-04\n`);

  const userId = member.id;

  // Simulate the exact query from the API
  const allProjects = await prisma.project.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    include: {
      tasks: true,
      relatedTasks: { select: { id: true, title: true, status: true } },
      mission: { select: { id: true, missionName: true } },
    },
  });

  console.log(`📊 allProjects query returned: ${allProjects.length} projects\n`);

  const projectsKpi = await Promise.all(
    allProjects.map(async (p) => {
      const progress = await calculateProjectProgress(p.id);
      const pts = p.tasks;
      const rt = p.relatedTasks;
      return {
        id: p.id,
        projectName: p.projectName,
        phase: p.phase,
        themeColor: p.themeColor,
        startDate: p.startDate,
        endDate: p.endDate,
        mission: p.mission,
        progress: Math.round(progress * 100) / 100,
        projectTasks: {
          total: pts.length,
          completed: pts.filter((x) => x.progress >= 100).length,
        },
        relatedTasks: {
          total: rt.length,
          completed: rt.filter((x) => x.status === 'COMPLETED').length,
        },
      };
    }),
  );

  console.log(`📊 projectsKpi array has: ${projectsKpi.length} items\n`);

  projectsKpi.forEach((p, index) => {
    console.log(`${index + 1}. ${p.projectName}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Phase: ${p.phase}`);
    console.log(`   Theme Color: ${p.themeColor}`);
    console.log(`   Mission: ${p.mission?.missionName || 'None'}`);
    console.log(`   Progress: ${p.progress}%`);
    console.log(`   Project Tasks: ${p.projectTasks.completed}/${p.projectTasks.total}`);
    console.log(`   Related Tasks: ${p.relatedTasks.completed}/${p.relatedTasks.total}`);
    console.log('');
  });

  console.log('\n✅ This is what the API should return in projectsKpi field');

  await prisma.$disconnect();
}

testApiResponse().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
