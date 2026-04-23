import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TaskModal } from '../components/project/TaskModal';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { Button } from '../components/common/Button';
import { UserFilter } from '../components/common/UserFilter';
import { UsageGuideModal } from '../components/common/UsageGuideModal';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, Calendar, Filter, ArrowUpDown, HelpCircle, LayoutGrid, List, X, GripVertical } from 'lucide-react';
import { Task, Project, Mission } from '../types';

export const Tasks: React.FC = () => {
  const { user } = useAuthStore();
  const { isStaff, workspaceMode } = useStaffWorkspace();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [previewTask, setPreviewTask] = useState<Task | null>(null); // プレビュー表示用
  
  // フィルタ・ソート状態
  const [filterProject, setFilterProject] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('deadline');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('card');
  const [isUsageGuideOpen, setIsUsageGuideOpen] = useState(false);

  const viewMode: 'view' | 'create' =
    user?.role === 'MEMBER'
      ? 'view'
      : isStaff
        ? workspaceMode === 'browse'
          ? 'view'
          : 'create'
        : 'view';

  // プロジェクト一覧を取得（Taskの紐づき情報用）
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', selectedUserId, viewMode, user?.id, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      let url = '/api/projects';
      
      // 閲覧モード: メンバー全員のプロジェクトを表示
      if (viewMode === 'view') {
        if (user?.role === 'MEMBER') {
          // メンバーは自分のプロジェクトのみ
          url = `/api/projects?userId=${user.id}`;
        } else if (selectedUserId) {
          // 非メンバーは選択したユーザーのプロジェクト
          url = `/api/projects?userId=${selectedUserId}`;
        } else {
          // 非メンバーでユーザー未選択の場合は、メンバー全員のプロジェクトを取得
          const membersResponse = await api.get('/api/users');
          const members = (membersResponse.data || []).filter((u: any) => 
            u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
          );
          if (members.length > 0) {
            // 各メンバーのプロジェクトを取得して結合
            const allProjects: Project[] = [];
            for (const member of members) {
              try {
                const memberResponse = await api.get<Project[]>(`/api/projects?userId=${member.id}`);
                allProjects.push(...(memberResponse.data || []));
              } catch (error) {
                console.error(`Failed to fetch projects for member ${member.id}:`, error);
              }
            }
            return allProjects;
          } else {
            return [];
          }
        }
      } else {
        // 作成モード: 自分のプロジェクトのみ表示
        if (!user?.id) {
          return [];
        }
        url = `/api/projects?userId=${user.id}`;
      }
      
      const response = await api.get(url);
      return response.data;
    },
    enabled: !!user?.id || viewMode === 'view', // user?.idが存在するか、閲覧モードの場合のみ有効化
  });

  // ミッション一覧を取得（breadcrumb用）
  const { data: missions = [] } = useQuery<Mission[]>({
    queryKey: ['missions', 'tasks-page', user?.id, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      let url = '/api/missions';
      if (user?.role === 'MEMBER') {
        url = `/api/missions?userId=${user.id}`;
      } else if (isStaff && workspaceMode === 'personal') {
        url = `/api/missions?userId=${user!.id}`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });

  // タスク一覧を直接ミッションAPIから取得
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', 'all', selectedUserId, user?.id, user?.role, viewMode, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      // 対象ユーザーのミッション一覧を取得してから、各ミッションのタスクを取得
      let targetUserIds: string[] = [];

      if (user?.role === 'MEMBER') {
        targetUserIds = [user.id];
      } else if (viewMode === 'view' && selectedUserId) {
        targetUserIds = [selectedUserId];
      } else if (viewMode === 'create' && user?.id) {
        targetUserIds = [user.id];
      } else if (viewMode === 'view') {
        // 全メンバーのタスクを取得
        const membersResponse = await api.get('/api/users');
        const members = (membersResponse.data || []).filter((u: any) =>
          u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
        );
        targetUserIds = members.map((u: any) => u.id);
      }

      if (targetUserIds.length === 0) return [];

      const allTasksList: Task[] = [];
      for (const uid of targetUserIds) {
        try {
          // そのユーザーのミッション一覧を取得
          const missionsRes = await api.get(`/api/missions?userId=${uid}`);
          const userMissions = missionsRes.data || [];
          // 各ミッションのタスクを取得
          for (const mission of userMissions) {
            try {
              const tasksRes = await api.get(`/api/missions/${mission.id}/tasks`);
              allTasksList.push(...(tasksRes.data || []));
            } catch (e) {
              console.error(`Failed to fetch tasks for mission ${mission.id}:`, e);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch missions for user ${uid}:`, e);
        }
      }
      return allTasksList;
    },
    enabled: !!user?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // フィルタリング・ソート
  const filteredAndSortedTasks = React.useMemo(() => {
    let filtered = allTasks.filter(task => {
      const matchesProject = filterProject === 'all' || task.projectId === filterProject;
      return matchesProject;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'project':
          return (a.project?.projectName || '').localeCompare(b.project?.projectName || '');
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'deadline':
        default:
          // 期限がない場合は最後に
          if (!a.project?.endDate && !b.project?.endDate) return 0;
          if (!a.project?.endDate) return 1;
          if (!b.project?.endDate) return -1;
          return new Date(a.project.endDate).getTime() - new Date(b.project.endDate).getTime();
      }
    });

    return filtered;
  }, [allTasks, filterProject, sortBy]);

  const handleCreateTask = (projectId?: string) => {
    setSelectedTask(null);
    let targetProjectId = projectId;
    if (!targetProjectId && projects.length > 0) {
      targetProjectId = projects[0].id;
    }

    if (targetProjectId) {
      const project = projects.find((p) => p.id === targetProjectId);
      setSelectedProjectId(project?.missionId || missions[0]?.id || null);
    } else if (projects.length > 0) {
      const first = projects[0];
      setSelectedProjectId(first.missionId || missions[0]?.id || null);
    } else {
      setSelectedProjectId(missions[0]?.id || null);
    }
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    // missionIdを設定（TaskModalはmissionIdを必要とする）
    if (task.missionId) {
      setSelectedProjectId(task.missionId);
    } else {
      // missionIdがない場合は、プロジェクトから取得を試みる
      const project = projects.find(p => p.id === task.projectId);
      if (project?.missionId) {
        setSelectedProjectId(project.missionId);
      } else {
        setSelectedProjectId(null);
      }
    }
    setIsModalOpen(true);
  };

  const handleDuplicateTask = async (task: Task) => {
    if (!task.missionId) {
      alert('ミッション情報が見つかりません');
      return;
    }
    if (!confirm(`「${task.title}」を複製しますか？`)) return;
    try {
      await api.post(`/api/missions/${task.missionId}/tasks`, {
        title: `${task.title}（コピー）`,
        description: task.description,
        status: 'NOT_STARTED',
        projectId: task.projectId || null,
        linkKind: task.linkKind,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : null,
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Failed to duplicate task:', error);
      alert('複製に失敗しました');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm('このタスクを削除しますか？')) return;
    if (!task.projectId) {
      alert('プロジェクト情報が見つかりません');
      return;
    }
    try {
      // 現在のAPI構造では、TaskはMission配下にあるため、missionIdが必要
      // 暫定的に、Project経由で削除
      if (task.missionId) {
        await api.delete(`/api/missions/${task.missionId}/tasks/${task.id}`);
      } else {
        throw new Error('Mission ID not found');
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('削除に失敗しました');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      if (!task.missionId) {
        throw new Error('Mission ID not found');
      }
      await api.put(`/api/missions/${task.missionId}/tasks/${task.id}`, {
        status: 'COMPLETED',
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('完了処理に失敗しました');
    }
  };

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setIsModalOpen(false);
    setSelectedTask(null);
    setSelectedProjectId(null);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const taskId = result.draggableId;
    const task = filteredAndSortedTasks.find(t => t.id === taskId);
    
    if (!task || !task.missionId) {
      alert('タスク情報が見つかりません');
      return;
    }
    
    try {
      await api.post(`/api/missions/${task.missionId}/tasks/${taskId}/reorder-to`, {
        newIndex: destinationIndex,
        oldIndex: sourceIndex,
      });
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      console.error('Reorder error:', error);
      alert(error.response?.data?.error || '順番の入れ替えに失敗しました');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'IN_PROGRESS':
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '完了';
      case 'IN_PROGRESS':
        return '進行中';
      default:
        return '未着手';
    }
  };

  const getMissionName = (task: Task): string | null => {
    // タスクに mission が含まれている場合はそれを使用
    if ((task as any).mission?.missionName) return (task as any).mission.missionName;
    // フォールバック: プロジェクト経由
    if (!task.projectId) return null;
    const project = projects.find(p => p.id === task.projectId);
    if (!project?.missionId) return null;
    const mission = missions.find(m => m.id === project.missionId);
    return mission?.missionName || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const canCreate = user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER';
  const isNonMember = user?.role !== 'MEMBER';
  const showCreateButton = canCreate && (user?.role === 'MEMBER' || viewMode === 'create');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            タスク
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
          {isNonMember && isStaff && (
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md text-right">
              閲覧／個人はダッシュボードに連動（現在: {workspaceMode === 'browse' ? '閲覧' : '個人'}）
            </p>
          )}
          {showCreateButton && (
            <Button 
              onClick={() => {
                if (missions.length === 0) {
                  alert('タスクを作成するには、ミッション（目標）が必要です。');
                  return;
                }
                handleCreateTask();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              新規タスク
            </Button>
          )}
        </div>
      </div>

      {/* フィルタ・ソート＆タスク一覧（全モード共通） */}
      <>
          {/* フィルタ・ソート */}
          <div className="flex gap-4 flex-wrap items-center justify-between">
            <div className="flex gap-4 flex-wrap items-center">
              {isNonMember && viewMode === 'view' && (
                <UserFilter
                  selectedUserId={selectedUserId}
                  onUserChange={setSelectedUserId}
                  label="担当者"
                />
              )}
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">全てのプロジェクト</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.projectName}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="deadline">期限順</option>
                  <option value="project">プロジェクト順</option>
                  <option value="created">作成日順</option>
                </select>
              </div>
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

          {/* タスク一覧 */}
          {displayMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedTasks.map((task, index) => {
          const missionName = getMissionName(task);
          return (
            <div
              key={task.id}
              className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-5 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setPreviewTask(task)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex-1">
                    {task.title}
                  </h3>
                </div>
                {canCreate && viewMode === 'create' && (
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col gap-1 mr-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderTask(task, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="上に移動"
                      >
                        <ArrowUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderTask(task, 'down');
                        }}
                        disabled={index === filteredAndSortedTasks.length - 1}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="下に移動"
                      >
                        <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTask(task);
                      }}
                      title="編集"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      編集
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTask(task);
                      }}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      削除
                    </Button>
                  </div>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* プロジェクト情報 */}
              {task.project && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    プロジェクト: 
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 ml-1">
                    {task.project.projectName}
                  </span>
                </div>
              )}
              {!task.projectId && (
                <div className="mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {task.linkKind === 'KYORYOKUTAI_WORK'
                      ? '協力隊業務（プロジェクトなし）'
                      : task.linkKind === 'YAKUBA_WORK'
                        ? '役場業務（プロジェクトなし）'
                        : task.linkKind === 'TRIAGE_PENDING'
                          ? 'あとで振り分け（当日メモ・保留）'
                          : '未設定（プロジェクトなし）'}
                  </span>
                </div>
              )}

              {/* ミッション（薄く表示） */}
              {missionName && (
                <div className="mb-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ミッション: {missionName}
                  </span>
                </div>
              )}

              {/* 担当者情報（メンバー以外の時のみ表示） */}
              {isNonMember && task.project?.user && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    担当者: 
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 ml-1">
                    {task.project.user.name}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {viewMode === 'create' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleTask(task);
                        setIsScheduleModalOpen(true);
                      }}
                      title="スケジュールに追加"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      スケジュール
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
          </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">タスク名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">プロジェクト</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ミッション</th>
                    {viewMode === 'view' && isNonMember && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">担当者</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">期日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAndSortedTasks.map((task) => {
                    const missionName = getMissionName(task);
                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => setPreviewTask(task)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{task.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {task.project?.projectName || 'プロジェクトなし'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {missionName || '-'}
                        </td>
                        {viewMode === 'view' && isNonMember && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {task.project?.user?.name || '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ja-JP') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredAndSortedTasks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {filterProject !== 'all' ? '条件に一致するタスクがありません' : 'タスクがありません'}
        </div>
      )}
        </>

      {/* タスクプレビューモーダル */}
      {previewTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewTask(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{previewTask.title}</h3>
              </div>
              <button onClick={() => setPreviewTask(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="h-5 w-5" /></button>
            </div>

            {/* メモ */}
            {previewTask.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">{previewTask.description}</p>
            )}

            {/* 詳細情報 */}
            <div className="space-y-2 text-sm">
              {previewTask.dueDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">期日</span>
                  <span className="text-gray-900 dark:text-gray-100">{new Date(previewTask.dueDate).toLocaleDateString('ja-JP')}</span>
                  {(previewTask as any).startTime && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {(previewTask as any).startTime}〜{(previewTask as any).endTime || ''}
                    </span>
                  )}
                </div>
              )}
              {(previewTask as any).locationText && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">場所</span>
                  <span className="text-gray-900 dark:text-gray-100">{(previewTask as any).locationText}</span>
                </div>
              )}
              {previewTask.project && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">プロジェクト</span>
                  <span className="text-gray-900 dark:text-gray-100">{previewTask.project.projectName}</span>
                </div>
              )}
              {(() => {
                const mName = getMissionName(previewTask);
                return mName ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">ミッション</span>
                    <span className="text-gray-900 dark:text-gray-100">{mName}</span>
                  </div>
                ) : null;
              })()}
              {!previewTask.projectId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">連携</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {previewTask.linkKind === 'KYORYOKUTAI_WORK' ? '協力隊業務' : previewTask.linkKind === 'YAKUBA_WORK' ? '役場業務' : previewTask.linkKind === 'TRIAGE_PENDING' ? 'あとで振り分け' : '未設定'}
                  </span>
                </div>
              )}
            </div>

            {canCreate && (
              <div className="flex justify-end gap-2 pt-2 border-t dark:border-gray-700">
                <Button variant="outline" size="sm" onClick={() => { setPreviewTask(null); handleEditTask(previewTask); }}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" />編集
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* タスクモーダル */}
      {isModalOpen && selectedProjectId && (
        <TaskModal
          missionId={selectedProjectId}
          task={selectedTask}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
            setSelectedProjectId(null);
          }}
          onSaved={handleTaskSaved}
          onDuplicate={handleDuplicateTask}
          readOnly={selectedTask ? (viewMode === 'view' && isNonMember) : false}
        />
      )}

      {/* スケジュールモーダル */}
      {isScheduleModalOpen && scheduleTask && (
        <ScheduleModal
          defaultTaskId={scheduleTask.id}
          defaultProjectId={scheduleTask.projectId || null}
          defaultActivityDescription={scheduleTask.title}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setScheduleTask(null);
          }}
          onSaved={() => {
            setIsScheduleModalOpen(false);
            setScheduleTask(null);
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
          }}
        />
      )}

      <UsageGuideModal
        isOpen={isUsageGuideOpen}
        onClose={() => setIsUsageGuideOpen(false)}
      />
    </div>
  );
};

