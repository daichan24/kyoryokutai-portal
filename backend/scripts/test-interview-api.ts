import prisma from '../src/lib/prisma';

async function testInterviewApi() {
  console.log('🔍 Testing interview API data for a sample member...\n');

  // Get first member
  const member = await prisma.user.findFirst({
    where: { role: 'MEMBER' },
    select: { id: true, name: true },
  });

  if (!member) {
    console.log('❌ No members found');
    return;
  }

  console.log(`👤 Testing with: ${member.name} (${member.id})\n`);

  // Simulate the API query
  const allProjects = await prisma.project.findMany({
    where: {
      OR: [{ userId: member.id }, { members: { some: { userId: member.id } } }],
    },
    include: {
      tasks: true,
      relatedTasks: { select: { id: true, title: true, status: true } },
      mission: { select: { id: true, missionName: true } },
    },
  });

  console.log(`📊 Total projects found: ${allProjects.length}\n`);

  allProjects.forEach((p, index) => {
    console.log(`${index + 1}. ${p.projectName}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Phase: ${p.phase}`);
    console.log(`   Mission: ${p.mission?.missionName || 'None'}`);
    console.log(`   Theme Color: ${p.themeColor}`);
    console.log(`   Start Date: ${p.startDate}`);
    console.log(`   End Date: ${p.endDate || 'None'}`);
    console.log(`   Tasks: ${p.tasks.length}`);
    console.log(`   Related Tasks: ${p.relatedTasks.length}`);
    console.log('');
  });

  await prisma.$disconnect();
}

testInterviewApi().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
