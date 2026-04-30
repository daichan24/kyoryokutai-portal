import prisma from '../src/lib/prisma';

async function verifyDefaultProjects() {
  console.log('🔍 Verifying default projects for all members...\n');

  const members = await prisma.user.findMany({
    where: { role: 'MEMBER' },
    select: { id: true, name: true },
  });

  for (const member of members) {
    console.log(`\n👤 ${member.name} (${member.id})`);

    // Check for 協力隊業務 project
    const kyoryokutaiProject = await prisma.project.findFirst({
      where: {
        userId: member.id,
        projectName: '協力隊業務',
      },
      include: {
        mission: { select: { missionName: true } },
      },
    });

    // Check for 役場業務 project
    const yakubaProject = await prisma.project.findFirst({
      where: {
        userId: member.id,
        projectName: '役場業務',
      },
      include: {
        mission: { select: { missionName: true } },
      },
    });

    if (kyoryokutaiProject) {
      console.log(`  ✅ 協力隊業務 project exists (ID: ${kyoryokutaiProject.id})`);
      console.log(`     Mission: ${kyoryokutaiProject.mission?.missionName || 'None'}`);
    } else {
      console.log(`  ❌ 協力隊業務 project NOT FOUND`);
    }

    if (yakubaProject) {
      console.log(`  ✅ 役場業務 project exists (ID: ${yakubaProject.id})`);
      console.log(`     Mission: ${yakubaProject.mission?.missionName || 'None'}`);
    } else {
      console.log(`  ❌ 役場業務 project NOT FOUND`);
    }

    // Count all projects for this member
    const allProjects = await prisma.project.findMany({
      where: {
        OR: [{ userId: member.id }, { members: { some: { userId: member.id } } }],
      },
      select: { id: true, projectName: true },
    });

    console.log(`  📊 Total projects: ${allProjects.length}`);
    if (allProjects.length > 0) {
      console.log(`     Projects: ${allProjects.map(p => p.projectName).join(', ')}`);
    }
  }

  await prisma.$disconnect();
}

verifyDefaultProjects().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
