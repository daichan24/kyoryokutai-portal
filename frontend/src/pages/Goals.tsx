import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
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
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, HelpCircle, GripVertical, LayoutGrid, List } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
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
  const { isStaff, workspaceMode } = useStaffWorkspace();
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
  const [isUsageGuideOpen, setIsUsageGuideOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('card');

  const viewMode: 'view' | 'create' =
    user?.role === 'MEMBER'
      ? 'view'
      : isStaff
        ? workspaceMode === 'browse'
          ? 'view'
          : 'create'
        : 'view';

  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['missions', user?.id, selectedUserId, viewMode, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      let url = '/api/missions';
      
      // 閲覧モード: メンバー全員のミッションを表示
      if (viewMode === 'view') {
        if (user?.role === 'MEMBER') {
          // メンバーは自分のミッションのみ
          url = `/api/missions?userId=${user.id}`;
        } else if (selectedUserId) {
          // 非メンバーは選択したユーザーのミッション
          url = `/api/missions?userId=${selectedUserId}`;
        } else {
          // 非メンバーでユーザー未選択の場合は、メンバー全員のミッションを取得
          const membersResponse = await api.get('/api/users');
          const members = (membersResponse.data || []).filter((u: any) => 
            u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
          );
          if (members.length > 0) {
            // 各メンバーのミッションを取得して結合
            const allMissions: Goal[] = [];
            for (const member of members) {
              try {
                const memberResponse = await api.get<Goal[]>(`/api/missions?userId=${member.id}`);
                allMissions.push(...(memberResponse.data || []));
              } catch (error) {
                console.error(`Failed to fetch missions for member ${member.id}:`, error);
              }
            }
            return allMissions;
          } else {
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
      const missions = response.data || [];
      
      // デフォルト項目を追加（協力隊業務、役場業務）
      const defaultMissions: Goal[] = [
        {
          id: '__KYORYOKUTAI__',
          missionName: '協力隊業務',
          missionType: 'PRIMARY',
          targetPercentage: 100,
          progress: 0,
          user: user || { id: '', name: '', avatarColor: '#3B82F6' },
          midGoals: [],
        },
        {
          id: '__YAKUBA__',
          missionName: '役場業務',
          missionType: 'PRIMARY',
          targetPercentage: 100,
          progress: 0,
          user: user || { id: '', name: '', avatarColor: '#3B82F6' },
          midGoals: [],
        },
      ];
      
      // デフォルト項目を先頭に配置
      return [...defaultMissions, ...missions];
    },
    enabled: !!user?.id, // user?.idが存在する場合のみ有効化（作成モードと閲覧モードの両方で）
    refetchOnMount: true, // マウント時に再取得
    refetchOnWindowFocus: false, // ウィンドウフォーカス時は再取得しない
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
    // viewModeに関係なく、すべてのmissionsクエリを無効化
    queryClient.invalidateQueries({ queryKey: ['missions'] });
    // ウィジェット用のクエリも無効化
    queryClient.invalidateQueries({ queryKey: ['goals-widget'] });
    handleCloseModals();
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const missionId = result.draggableId;
    
    // デフォルトミッションはドラッグ不可（念のためチェック）
    const mission = goals?.find(g => g.id === missionId);
    if (mission && (mission.missionName === '協力隊業務' || mission.missionName === '役場業務')) {
      alert('デフォルトミッションの順番は変更できません');
      return;
    }
    
    try {
      await api.post(`/api/missions/${missionId}/reorder-to`, {
        newIndex: destinationIndex,
        oldIndex: sourceIndex,
      });
      
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    } catch (error: any) {
      console.error('Reorder error:', error);
      alert(error.response?.data?.error || '順番の入れ替えに失敗しました');
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const isNonMember = user?.role !== 'MEMBER';

  // デフォルトミッション（協力隊業務・役場業務）を除外したリスト
  const draggableGoals = goals?.filter(g => 
    g.missionName !== '協力隊業務' && g.missionName !== '役場業務'
  ) || [];

  // デフォルトミッションのみ
  const defaultGoals = goals?.filter(g => 
    g.missionName === '協力隊業務' || g.missionName === '役場業務'
  ) || [];

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
        <div className="flex gap-3 items-center">
          {isNonMember && isStaff && (
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md text-right">
              閲覧／個人はダッシュボードの表示モードに連動（現在:{' '}
              {workspaceMode === 'browse' ? '閲覧' : '個人'}）
            </p>
          )}
          {((user?.role === 'MEMBER') || (isNonMember && viewMode === 'create')) && (
            <Button onClick={handleCreateGoal}>
              <Plus className="h-4 w-4 mr-2" />
              新規ミッション
            </Button>
          )}
        </div>
      </div>

      {/* フィルタ・表示切り替え */}
      <div className="flex gap-4 flex-wrap items-center justify-between">
        <div className="flex gap-4 flex-wrap items-center">
          {isNonMember && viewMode === 'view' && (
            <UserFilter
              selectedUserId={selectedUserId}
              onUserChange={setSelectedUserId}
              label="担当者"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDisplayMode('card')}
            className={`p-2 rounded-lg transition-colors ${
              displayMode === 'card'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="カード表示"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDisplayMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              displayMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="リスト表示"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'view' && (
        <>
          {/* ミッション一覧 */}
          <div className="space-y-4">
            {/* デフォルトミッション（ドラッグ不可） */}
            {defaultGoals.map((goal) => (
              <div key={goal.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* 目標ヘッダー */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => toggleGoal(goal.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                        {expandedGoals.has(goal.id) ? '▼' : '▶'}
                      </button>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{goal.missionName || goal.goalName}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          デフォルト項目
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ミッション詳細 */}
                {expandedGoals.has(goal.id) && (
                  <div className="bg-gray-50 dark:bg-gray-800 px-5 pb-5">
                    <div className="py-4 text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        {goal.id === '__KYORYOKUTAI__' 
                          ? 'スケジュール入力時に「協力隊業務」を選択すると、このミッションに紐づけられます。プロジェクトに紐づかない協力隊としての一般的な業務に使用してください。'
                          : 'スケジュール入力時に「役場業務」を選択すると、このミッションに紐づけられます。役場の業務に使用してください。'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ドラッグ可能なミッション */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="missions-view">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-4"
                  >
                    {draggableGoals.map((goal, index) => (
                      <Draggable key={goal.id} draggableId={goal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : ''
                            }`}
                          >
                            {/* 目標ヘッダー */}
                            <div className="p-5">
                              <div className="flex items-start gap-2 mb-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing pt-1">
                                  <GripVertical className="h-5 w-5 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div 
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded -m-2 p-2"
                                    onClick={() => toggleGoal(goal.id)}
                                  >
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

                                  {/* 編集ボタン */}
                                  {(viewMode === 'view' && user?.id === goal.user.id) && (
                                    <div className="flex justify-end mt-2">
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
                                </div>
                              </div>

                              {/* ミッション詳細 */}
                              {expandedGoals.has(goal.id) && (
                                <div className="bg-gray-50 dark:bg-gray-800 px-5 pb-5 -mx-5 -mb-5 mt-3">
                                  <MissionDetailContent missionId={goal.id} viewMode={viewMode} />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
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
        <>
          {/* ミッション一覧 */}
          <div className="space-y-4">
            {/* デフォルトミッション（ドラッグ不可） */}
            {defaultGoals.map((goal) => (
              <div key={goal.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* 目標ヘッダー */}
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => toggleGoal(goal.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                        {expandedGoals.has(goal.id) ? '▼' : '▶'}
                      </button>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{goal.missionName || goal.goalName}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          デフォルト項目
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ミッション詳細 */}
                {expandedGoals.has(goal.id) && (
                  <div className="bg-gray-50 dark:bg-gray-800 px-5 pb-5">
                    <div className="py-4 text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        {goal.id === '__KYORYOKUTAI__' 
                          ? 'スケジュール入力時に「協力隊業務」を選択すると、このミッションに紐づけられます。プロジェクトに紐づかない協力隊としての一般的な業務に使用してください。'
                          : 'スケジュール入力時に「役場業務」を選択すると、このミッションに紐づけられます。役場の業務に使用してください。'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ドラッグ可能なミッション */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="missions-create">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-4"
                  >
                    {draggableGoals.map((goal, index) => (
                      <Draggable key={goal.id} draggableId={goal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
                              snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500' : ''
                            }`}
                          >
                            {/* 目標ヘッダー */}
                            <div className="p-5">
                              <div className="flex items-start gap-2 mb-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing pt-1">
                                  <GripVertical className="h-5 w-5 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
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
                                  <div 
                                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded -m-2 p-2"
                                    onClick={() => toggleGoal(goal.id)}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                                          {expandedGoals.has(goal.id) ? '▼' : '▶'}
                                        </button>
                                        <div className="flex items-center gap-2">
                                          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{goal.missionName || goal.goalName}</h2>
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
                                </div>
                              </div>

                              {/* ミッション詳細 */}
                              {expandedGoals.has(goal.id) && (
                                <div className="bg-gray-50 dark:bg-gray-800 px-5 pb-5 -mx-5 -mb-5 mt-3">
                                  <MissionDetailContent missionId={goal.id} viewMode={viewMode} />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* 空状態 */}
          {goals?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              新規ミッションを作成するには、右上の「新規ミッション」ボタンをクリックしてください。
            </div>
          )}
        </>
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