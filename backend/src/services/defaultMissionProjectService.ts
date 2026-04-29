import prisma from '../lib/prisma';

/**
 * 新規メンバー作成時にデフォルトのミッションとプロジェクトを作成
 */
export async function createDefaultMissionsAndProjects(userId: string) {
  console.log(`🎯 Creating default missions and projects for user ${userId}`);

  // 1. 協力隊業務ミッションを作成
  const kyoryokutaiMission = await prisma.mission.create({
    data: {
      userId,
      missionName: '協力隊業務',
      missionType: 'PRIMARY',
      displayOrder: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
    },
  });

  // 2. 役場業務ミッションを作成
  const yakubaMission = await prisma.mission.create({
    data: {
      userId,
      missionName: '役場業務',
      missionType: 'SECONDARY',
      displayOrder: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
    },
  });

  // 3. 協力隊業務プロジェクトを作成（ミッションに紐づける）
  const kyoryokutaiProject = await prisma.project.create({
    data: {
      userId,
      projectName: '協力隊業務',
      phase: 'EXECUTION',
      missionId: kyoryokutaiMission.id,
      themeColor: '#3B82F6', // 青色
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      displayOrder: 0,
    },
  });

  // 4. 役場業務プロジェクトを作成（ミッションに紐づける）
  const yakubaProject = await prisma.project.create({
    data: {
      userId,
      projectName: '役場業務',
      phase: 'EXECUTION',
      missionId: yakubaMission.id,
      themeColor: '#10B981', // 緑色
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      displayOrder: 1,
    },
  });

  console.log(`✅ Created default missions and projects for user ${userId}`);
  console.log(`  - Mission: ${kyoryokutaiMission.missionName} (${kyoryokutaiMission.id})`);
  console.log(`  - Project: ${kyoryokutaiProject.projectName} (${kyoryokutaiProject.id})`);
  console.log(`  - Mission: ${yakubaMission.missionName} (${yakubaMission.id})`);
  console.log(`  - Project: ${yakubaProject.projectName} (${yakubaProject.id})`);

  return {
    kyoryokutaiMission,
    yakubaMission,
    kyoryokutaiProject,
    yakubaProject,
  };
}

/**
 * 既存のメンバーにデフォルトのミッションとプロジェクトを作成（マイグレーション用）
 */
export async function createDefaultMissionsAndProjectsForExistingMembers() {
  console.log('🔄 Creating default missions and projects for existing members...');

  const members = await prisma.user.findMany({
    where: { role: 'MEMBER' },
    select: { id: true, name: true, email: true },
  });

  for (const member of members) {
    // 既に「協力隊業務」ミッションが存在するかチェック
    const existingKyoryokutaiMission = await prisma.mission.findFirst({
      where: {
        userId: member.id,
        missionName: '協力隊業務',
      },
    });

    // 既に「役場業務」ミッションが存在するかチェック
    const existingYakubaMission = await prisma.mission.findFirst({
      where: {
        userId: member.id,
        missionName: '役場業務',
      },
    });

    if (existingKyoryokutaiMission && existingYakubaMission) {
      console.log(`  ℹ️ ${member.name} already has default missions`);

      // ミッションは存在するが、プロジェクトが存在しない場合は作成
      const existingKyoryokutaiProject = await prisma.project.findFirst({
        where: {
          userId: member.id,
          projectName: '協力隊業務',
        },
      });

      const existingYakubaProject = await prisma.project.findFirst({
        where: {
          userId: member.id,
          projectName: '役場業務',
        },
      });

      if (!existingKyoryokutaiProject) {
        await prisma.project.create({
          data: {
            userId: member.id,
            projectName: '協力隊業務',
            phase: 'EXECUTION',
            missionId: existingKyoryokutaiMission.id,
            themeColor: '#3B82F6',
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            displayOrder: 0,
          },
        });
        console.log(`  ✅ Created 協力隊業務 project for ${member.name}`);
      }

      if (!existingYakubaProject) {
        await prisma.project.create({
          data: {
            userId: member.id,
            projectName: '役場業務',
            phase: 'EXECUTION',
            missionId: existingYakubaMission.id,
            themeColor: '#10B981',
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            displayOrder: 1,
          },
        });
        console.log(`  ✅ Created 役場業務 project for ${member.name}`);
      }

      continue;
    }

    // デフォルトミッションとプロジェクトを作成
    await createDefaultMissionsAndProjects(member.id);
    console.log(`  ✅ Created default missions and projects for ${member.name}`);
  }

  console.log('✅ Finished creating default missions and projects for existing members');
}
