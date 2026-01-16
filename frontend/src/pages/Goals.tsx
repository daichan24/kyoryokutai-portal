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
      
      // 閲覧モード: 選択したユーザーのミッションを表示（MEMBERは自分のみ）
      if (viewMode === 'view') {
        if (user?.role === 'MEMBER') {
          url = `/api/missions?userId=${user.id}`;
        } else if (selectedUserId) {
          url = `/api/missions?userId=${selectedUserId}`;
        }
      } else {
        // 作成モード: 自分のミッションのみ表示
        url = `/api/missions?userId=${user?.id}`;
      }
      
      const response = await api.get(url);
      return response.data;
    }
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
          <h1 className="text-2xl font-bold text-gray-900">
            ミッション管理
            {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 ml-2">（自分のミッション）</span>}
            {isNonMember && viewMode === 'create' && <span className="text-lg font-normal text-gray-500 ml-2">（作成）</span>}
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
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                閲覧
              </button>
              <button
                onClick={() => setViewMode('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                作成
              </button>
            </div>
          )}
          {(user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && (
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
          <div key={goal.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* 目標ヘッダー */}
            <div
              className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleGoal(goal.id)}
            >
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 hover:text-gray-600">
                    {expandedGoals.has(goal.id) ? '▼' : '▶'}
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">{goal.missionName || goal.goalName}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (goal.missionType || goal.goalType) === 'PRIMARY' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {(goal.missionType || goal.goalType) === 'PRIMARY' ? 'メインミッション' : 'サブミッション'}
                  </span>
                </div>
                <span className="text-xl font-bold text-gray-900">{goal.progress}%</span>
              </div>

              {/* プログレスバー */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getProgressColor(goal.progress)}`}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>

            {/* ミッション詳細 */}
            {expandedGoals.has(goal.id) && (
              <div className="bg-gray-50 px-5 pb-5">
                {/* プロジェクト（中目標）とタスク（小目標）を並列表示 */}
                <MissionDetailContent missionId={goal.id} />
                
                {/* 中目標階層（既存の階層構造） */}
                <div className="mt-6 pt-6 border-t border-gray-300">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">中目標階層（詳細管理）</h4>
                  <div className="mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateMidGoal(goal.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      中目標を追加
                    </Button>
                  </div>
                {goal.midGoals.map((midGoal) => (
                  <div key={midGoal.id} className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* 中目標ヘッダー */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMidGoal(midGoal.id);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button className="text-gray-400 hover:text-gray-600">
                            {expandedMidGoals.has(midGoal.id) ? '▼' : '▶'}
                          </button>
                          <h3 className="font-medium text-gray-900">{midGoal.name}</h3>
                          <span className="text-xs text-gray-500">重み: {midGoal.weight}%</span>
                        </div>
                        <span className="font-semibold text-gray-900">{midGoal.progress}%</span>
                      </div>

                      <div className="ml-7 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getProgressColor(midGoal.progress)}`}
                          style={{ width: `${midGoal.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 小目標一覧 */}
                    {expandedMidGoals.has(midGoal.id) && (
                      <div className="bg-gray-50 px-4 pb-4">
                        <div className="mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateSubGoal(midGoal.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            小目標を追加
                          </Button>
                        </div>
                        {midGoal.subGoals.map((subGoal) => (
                          <div key={subGoal.id} className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                            {/* 小目標ヘッダー */}
                            <div
                              className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSubGoal(subGoal.id);
                              }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <button className="text-gray-400 hover:text-gray-600 text-sm">
                                    {expandedSubGoals.has(subGoal.id) ? '▼' : '▶'}
                                  </button>
                                  <span className="text-sm font-medium text-gray-900">{subGoal.name}</span>
                                  <span className="text-xs text-gray-500">重み: {subGoal.weight}%</span>
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{subGoal.progress}%</span>
                              </div>

                              <div className="ml-6 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${getProgressColor(subGoal.progress)}`}
                                  style={{ width: `${subGoal.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* タスク一覧 */}
                            {expandedSubGoals.has(subGoal.id) && (
                              <div className="bg-gray-50 px-3 pb-3">
                                <div className="mb-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCreateTask(subGoal.id)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    タスクを追加
                                  </Button>
                                </div>
                                {subGoal.tasks.map((task) => (
                                  <div key={task.id} className="mt-2 p-2 bg-white border border-gray-200 rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-700">{task.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">{task.progress}%</span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleUpdateTaskProgress(task, subGoal.id)}
                                        >
                                          進捗更新
                                        </Button>
                                      </div>
                                    </div>
                                    {task.deadline && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        期限: {new Date(task.deadline).toLocaleDateString('ja-JP')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                </div>
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