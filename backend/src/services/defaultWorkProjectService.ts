import prisma from '../lib/prisma';

type WorkLinkKind = 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK';

const WORK_PROJECT_META: Record<WorkLinkKind, {
  name: string;
  missionType: 'PRIMARY' | 'SUB';
  color: string;
  order: number;
}> = {
  KYORYOKUTAI_WORK: {
    name: '協力隊業務',
    missionType: 'PRIMARY',
    color: '#3B82F6',
    order: 0,
  },
  YAKUBA_WORK: {
    name: '役場業務',
    missionType: 'SUB',
    color: '#10B981',
    order: 1,
  },
};

export function isDefaultWorkLinkKind(value: unknown): value is WorkLinkKind {
  return value === 'KYORYOKUTAI_WORK' || value === 'YAKUBA_WORK';
}

export async function ensureDefaultWorkMissionProject(userId: string, linkKind: WorkLinkKind) {
  const meta = WORK_PROJECT_META[linkKind];

  let mission = await prisma.mission.findFirst({
    where: { userId, missionName: meta.name },
    orderBy: { createdAt: 'asc' },
  });

  if (!mission) {
    mission = await prisma.mission.create({
      data: {
        userId,
        missionName: meta.name,
        missionType: meta.missionType,
        order: meta.order,
        startDate: new Date(),
        endDate: null,
      },
    });
  }

  let project = await prisma.project.findFirst({
    where: { userId, projectName: meta.name },
    orderBy: { createdAt: 'asc' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        userId,
        projectName: meta.name,
        phase: 'EXECUTION',
        missionId: mission.id,
        themeColor: meta.color,
        startDate: new Date(),
        endDate: null,
        order: meta.order,
      },
    });
  } else if (project.missionId !== mission.id) {
    project = await prisma.project.update({
      where: { id: project.id },
      data: { missionId: mission.id },
    });
  }

  return { mission, project };
}
