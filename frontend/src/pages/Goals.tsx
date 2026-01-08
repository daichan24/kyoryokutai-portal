import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Goal {
  id: string;
  goalName: string;
  goalType: 'PRIMARY' | 'SUB';
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
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  progress: number;
  deadline?: string;
}

export const Goals: React.FC = () => {
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedMidGoals, setExpandedMidGoals] = useState<Set<string>>(new Set());
  const [expandedSubGoals, setExpandedSubGoals] = useState<Set<string>>(new Set());

  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const response = await api.get('/api/goals');
      return response.data;
    }
  });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">起業準備進捗管理</h1>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          + 新規目標
        </button>
      </div>

      {/* 目標一覧 */}
      <div className="space-y-4">
        {goals?.map((goal) => (
          <div key={goal.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* 目標ヘッダー */}
            <div
              className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleGoal(goal.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button className="text-gray-400 hover:text-gray-600">
                    {expandedGoals.has(goal.id) ? '▼' : '▶'}
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">{goal.goalName}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    goal.goalType === 'PRIMARY' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {goal.goalType === 'PRIMARY' ? 'メイン目標' : 'サブ目標'}
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

            {/* 中目標一覧 */}
            {expandedGoals.has(goal.id) && (
              <div className="bg-gray-50 px-5 pb-5">
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
                                {subGoal.tasks.map((task) => (
                                  <div key={task.id} className="mt-2 p-2 bg-white border border-gray-200 rounded">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-700">{task.name}</span>
                                      <span className="text-sm font-medium text-gray-900">{task.progress}%</span>
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
            )}
          </div>
        ))}
      </div>

      {/* 空状態 */}
      {goals?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          目標がまだ設定されていません
        </div>
      )}
    </div>
  );
};