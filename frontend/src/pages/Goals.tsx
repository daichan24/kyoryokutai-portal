import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { GoalModal } from '../components/goal/GoalModal';
import { MidGoalModal } from '../components/goal/MidGoalModal';
import { SubGoalModal } from '../components/goal/SubGoalModal';
import { GoalTaskModal } from '../components/goal/GoalTaskModal';
import { MissionDetailContent } from '../components/mission/MissionDetailContent';
import { Button } from '../components/common/Button';
import { UserFilter } from '../components/common/UserFilter';
import { UsageGuideModal } from '../components/common/UsageGuideModal';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, HelpCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Task, Project } from '../types';

interface Goal {
  id: string;
  goalName?: string; // 後方互換性
  missionName?: string;
  goalType?: 'PRIMARY' | 'SUB'; // 後方互換性
  missionType?: 'PRIMARY' | 'SUB';
  targetPercentage: number;
  progress: number;
  startDate?: string;
  endDate?: string;
  achievementBorder?: string;
  approvalStatus?: string;
  user: { id: string; name: string; avatarColor?: string };
  midGoals: MidGoal[];
}

interface MidGoal {
  id: string;
  name: string;
  progress: number;
  weight: number;
  subGoals: SubGoal[];
}

interface SubGoal {
  id: string;
  name: string;
  progress: number;
  weight: number;
  tasks: GoalTask[];
}

interface GoalTask {
  id: string;
  name: string;
  weight: number;
  progress: number;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  deadline?: string;
}

export const Goals: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedMidGoals, setExpandedMidGoals] = useState<Set<string>>(new Set());
  const [expandedSubGoals, setExpandedSubGoals] = useState<Set<string>>(new Set());
  
  // モーダル状態
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isMidGoalModalOpen, setIsMidGoalModalOpen] = useState(false);
  const [isSubGoalModalOpen, setIsSubGoalModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  
  // 選択状態
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedMidGoalId, setSelectedMidGoalId] = useState<string>('');
  const [selectedSubGoalId, setSelectedSubGoalId] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<GoalTask | null>(null);
  const [selectedNewTask, setSelectedNewTask] = useState<Task | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');
  const [isUsageGuideOpen, setIsUsageGuideOpen] = useState(false);

  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['missions', user?.id, selectedUserId, viewMode],
    queryFn: async () => {
      let url = '/api/missions';
      
      // 閲覧モード: メンバーのミッションのみ表示
      if (viewMode === 'view') {
        if (user?.role === 'MEMBER') {
          // メンバーは自分のミッションのみ
          url = `/api/missions?userId=${user.id}`;
        } else if (selectedUserId) {
          // 非メンバーは選択したユーザーのミッション
          url = `/api/missions?userId=${selectedUserId}`;
        } else {
          // 非メンバーでユーザー未選択の場合は、メンバーのミッションのみ取得
          // まずメンバー一覧を取得して、最初のメンバーのミッションを表示
          const membersResponse = await api.get('/api/users');
          const members = (membersResponse.data || []).filter((u: any) => 
            u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
          );
          if (members.length > 0) {
            url = `/api/missions?userId=${members[0].id}`;
          } else {
            // メンバーがいない場合は空配列を返す
            return [];
          }
        }
      } else {
        // 作成モード: 自分のミッションのみ表示
        if (!user?.id) {
          return [];
        }
        url = `/api/missions?userId=${user.id}`;
      }
      
      const response = await api.get(url);
      return response.data;
    },
    enabled: !!user?.id || viewMode === 'view', // user?.idが存在するか、閲覧モードの場合のみ有効化
  });

  // 各ミッションのプロジェクトとタスクを取得
  const fetchProjectsForMission = async (missionId: string): Promise<Project[]> => {
    try {
      const response = await api.get(`/api/projects?missionId=${missionId}`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      return [];
    }
  };

  const fetchTasksForMission = async (missionId: string): Promise<Task[]> => {
    try {
      const response = await api.get(`/api/missions/${missionId}/tasks`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  };

  const toggleGoal = (id: string) => {
    const newSet = new Set(expandedGoals);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedGoals(newSet);
  };

  const toggleMidGoal = (id: string) => {
    const newSet = new Set(expandedMidGoals);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedMidGoals(newSet);
  };

  const toggleSubGoal = (id: string) => {
    const newSet = new Set(expandedSubGoals);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSubGoals(newSet);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const handleCreateGoal = () => {
    setSelectedGoal(null);
    setIsGoalModalOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleCreateMidGoal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setIsMidGoalModalOpen(true);
  };

  const handleCreateSubGoal = (midGoalId: string) => {
    setSelectedMidGoalId(midGoalId);
    setIsSubGoalModalOpen(true);
  };

  const handleCreateTask = (subGoalId: string) => {
    setSelectedSubGoalId(subGoalId);
    setSelectedTask(null);
    setIsTaskModalOpen(true);
  };

  const handleUpdateTaskProgress = (task: GoalTask, subGoalId: string) => {
    setSelectedTask(task);
    setSelectedSubGoalId(subGoalId);
    setIsTaskModalOpen(true);
  };

  const handleCloseModals = () => {
    setIsGoalModalOpen(false);
    setIsMidGoalModalOpen(false);
    setIsSubGoalModalOpen(false);
    setIsTaskModalOpen(false);
    setSelectedGoal(null);
    setSelectedGoalId('');
    setSelectedMidGoalId('');
    setSelectedSubGoalId('');
    setSelectedTask(null);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    handleCloseModals();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const isNonMember = user?.role !== 'MEMBER';

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ミッション管理
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUsageGuideOpen(true)}
            title="使い方を見る"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            使い方
          </Button>
        </div>
        <div className="flex gap-3">
          {isNonMember && (
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('view')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'view'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                閲覧
              </button>
              <button
                onClick={() => setViewMode('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                個人
              </button>
            </div>
          )}
          {((user?.role === 'MEMBER') || (isNonMember && viewMode === 'create')) && (
            <Button onClick={handleCreateGoal}>
              <Plus className="h-4 w-4 mr-2" />
              新規ミッション
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'view' && (
        <>
          {isNonMember && (
            <UserFilter
              selectedUserId={selectedUserId}
              onUserChange={setSelectedUserId}
              label="担当者"
            />
          )}

          {/* 目標一覧 */}
      <div className="space-y-4">
        {goals?.map((goal) => (
          <div key={goal.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* 目標ヘッダー */}
            <div
              className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleGoal(goal.id)}
            >
              {(viewMode === 'create' || (viewMode === 'view' && user?.id === goal.user.id)) && (
                <div className="flex justify-end mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditGoal(goal);
                    }}
                  >
                    編集
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                    {expandedGoals.has(goal.id) ? '▼' : '▶'}
                  </button>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{goal.missionName || goal.goalName}</h2>
                    {viewMode === 'view' && isNonMember && !selectedUserId && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        （{goal.user.name}）
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (goal.missionType || goal.goalType) === 'PRIMARY' 
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {(goal.missionType || goal.goalType) === 'PRIMARY' ? 'メインミッション' : 'サブミッション'}
                  </span>
                </div>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{goal.progress}%</span>
              </div>

              {/* プログレスバー */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(goal.progress)}`}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>

            {/* ミッション詳細 */}
            {expandedGoals.has(goal.id) && (
              <div className="bg-gray-50 dark:bg-gray-800 px-5 pb-5">
                {/* プロジェクト（タスクはプロジェクト配下に表示） */}
                <MissionDetailContent missionId={goal.id} viewMode={viewMode} />
              </div>
            )}
          </div>
        ))}
      </div>

          {/* 空状態 */}
          {goals?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              ミッションがまだ設定されていません
            </div>
          )}
        </>
      )}

      {viewMode === 'create' && (
        <div className="text-center py-12 text-gray-500">
          新規ミッションを作成するには、右上の「新規ミッション」ボタンをクリックしてください。
        </div>
      )}

      {/* モーダル */}
      {isGoalModalOpen && (
        <GoalModal
          goal={selectedGoal}
          onClose={handleCloseModals}
          onSaved={handleSaved}
        />
      )}

      {isMidGoalModalOpen && selectedGoalId && (
        <MidGoalModal
          goalId={selectedGoalId}
          onClose={handleCloseModals}
          onSaved={handleSaved}
        />
      )}

      {isSubGoalModalOpen && selectedMidGoalId && (
        <SubGoalModal
          midGoalId={selectedMidGoalId}
          onClose={handleCloseModals}
          onSaved={handleSaved}
        />
      )}

      {isTaskModalOpen && selectedSubGoalId && (
        <GoalTaskModal
          subGoalId={selectedSubGoalId}
          task={selectedTask}
          onClose={handleCloseModals}
          onSaved={handleSaved}
        />
      )}

      <UsageGuideModal
        isOpen={isUsageGuideOpen}
        onClose={() => setIsUsageGuideOpen(false)}
      />
    </div>
  );
};