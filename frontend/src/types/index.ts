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

export interface ScheduleParticipant {
  id: string;
  scheduleId: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  respondedAt?: string;
  user?: User;
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
  projectId?: string;
  project?: Project;
  taskId?: string;
  task?: Task;
  scheduleParticipants?: ScheduleParticipant[];
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
  missionId?: string;
  mission?: Mission;
  relatedTasks?: Task[]; // このプロジェクトに関連するタスク（小目標、任意）
  taskProgress?: number; // プロジェクト配下のタスクの進捗率
}

// ミッション（旧：起業準備進捗 / Goal）
export interface Mission {
  id: string;
  userId: string;
  user?: User;
  missionName: string;
  missionType: 'PRIMARY' | 'SUB';
  targetPercentage: number;
  approvalStatus: ApprovalStatus;
  approvalComment?: string;
  approvedBy?: string;
  approvedAt?: string;
  progress?: number;
  midGoals?: MidGoal[];
  projects?: Project[];
  tasks?: Task[]; // タスク（小目標）
  createdAt: string;
  updatedAt: string;
}

// 中目標
export interface MidGoal {
  id: string;
  missionId: string;
  name: string;
  weight: number;
  weightMethod: 'EQUAL' | 'PERIOD' | 'MANUAL';
  startDate?: string;
  endDate?: string;
  order: number;
  progress?: number;
  subGoals?: SubGoal[];
  createdAt: string;
  updatedAt: string;
}

// 小目標
export interface SubGoal {
  id: string;
  midGoalId: string;
  name: string;
  weight: number;
  weightMethod: 'EQUAL' | 'PERIOD' | 'MANUAL';
  startDate?: string;
  endDate?: string;
  order: number;
  progress?: number;
  tasks?: GoalTask[];
  createdAt: string;
  updatedAt: string;
}

// 目標タスク（ミッション階層内のタスク）
export interface GoalTask {
  id: string;
  subGoalId: string;
  name: string;
  weight: number;
  progress: number;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  startDate?: string;
  endDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// タスク（ミッション配下の小目標、プロジェクトは任意）
export interface Task {
  id: string;
  missionId: string;
  mission?: Mission;
  projectId?: string | null; // プロジェクトへの紐付けは任意
  project?: Project;
  title: string;
  description?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 後方互換性のため残す
export interface Goal extends Mission {}

export interface ProjectTask {
  id: string;
  taskName: string;
  progress: number;
}

// 依頼（旧：タスク依頼）
export interface Request {
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

// 後方互換性のため残す
export interface TaskRequest extends Request {}

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
  | 'EVENT_REMINDER'
  | 'SCHEDULE_INVITE'
  | 'SCHEDULE_INVITE_APPROVED'
  | 'SCHEDULE_INVITE_REJECTED';

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
