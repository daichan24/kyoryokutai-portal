import type { Prisma } from '@prisma/client';

// Preserve profile/preferences previously returned by raw User relations; never fetch credentials.
export const publicUserSelect = {
  id: true, name: true, email: true, role: true, missionType: true,
  department: true, termStart: true, termEnd: true, avatarColor: true,
  avatarLetter: true, darkMode: true, displayOrder: true, wishesEnabled: true,
  notepadEnabled: true, contactsSidebarEnabled: true, emailNotificationsEnabled: true,
  scheduleWeekStartsOn: true, scheduleHiddenLocationIds: true, personalModeEnabled: true,
  dashboardConfigJson: true, snsLinks: true, createdAt: true, updatedAt: true,
  isTestAccount: true, pdfFileNameTemplates: true,
} satisfies Prisma.UserSelect;
