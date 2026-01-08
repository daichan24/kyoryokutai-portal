export type Role = 'MASTER' | 'MEMBER' | 'SUPPORT' | 'GOVERNMENT';
export type MissionType = 'FREE' | 'MISSION';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  missionType?: MissionType;
  department?: string;
  termStart?: string;
  termEnd?: string;
  avatarColor: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Schedule {
  id: string;
  userId: string;
  user?: User;
  date: string;
  startTime: string;
  endTime: string;
  locationText?: string;
  activityDescription: string;
  freeNote?: string;
  isPending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReport {
  id: string;
  userId: string;
  user?: User;
  week: string;
  thisWeekActivities: Array<{
    date: string;
    activity: string;
  }>;
  nextWeekPlan?: string;
  note?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Phase 3 Types
export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'IGNORED';

export interface ScheduleSuggestion {
  id: string;
  scheduleId: string;
  schedule: Schedule;
  suggestedTo: string;
  user: User;
  status: SuggestionStatus;
  conflictingSchedules?: Array<{
    id: string;
    startTime: string;
    endTime: string;
    description: string;
  }>;
  createdAt: string;
  respondedAt?: string;
}

export interface ParsedSchedule {
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  participants: string[];
  projectId: string | null;
  description: string;
  missingFields: string[];
}

export interface DashboardWidget {
  id: string;
  name: string;
  isVisible: boolean;
  order: number;
  isFixed?: boolean;
}

export interface DashboardSettings {
  userId: string;
  widgets: DashboardWidget[];
}

// Phase 4 Types
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Project {
  id: string;
  projectName: string;
}

export interface ProjectTask {
  id: string;
  taskName: string;
  progress: number;
}

export interface TaskRequest {
  id: string;
  requestedBy: string;
  requester: User;
  requestedTo: string;
  requestee: User;
  requestTitle: string;
  requestDescription: string;
  deadline?: string;
  projectId?: string;
  project?: Project;
  approvalStatus: ApprovalStatus;
  approvalNote?: string;
  approvedAt?: string;
  createdTaskId?: string;
  createdTask?: ProjectTask;
  createdAt: string;
  updatedAt: string;
}

export interface Inspection {
  id: string;
  userId: string;
  user: User;
  date: string;
  destination: string;
  purpose: string;
  participants: string[];
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  projectId?: string;
  project?: Project;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalProject {
  id: string;
  userId: string;
  user: User;
  projectName: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  tasks: PersonalTask[];
  schedules: PersonalSchedule[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTask {
  id: string;
  projectId: string;
  taskName: string;
  progress: number;
  deadline?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalSchedule {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  projectId?: string;
  project?: PersonalProject;
  activityDescription: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'SCHEDULE_SUGGESTION'
  | 'TASK_REQUEST'
  | 'PROJECT_APPROVED'
  | 'PROJECT_REJECTED'
  | 'WEEKLY_REMINDER'
  | 'SNS_REMINDER'
  | 'PENDING_SCHEDULE'
  | 'EVENT_REMINDER';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}
