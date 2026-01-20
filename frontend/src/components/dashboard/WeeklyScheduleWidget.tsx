import React from 'react';
import { Link } from 'react-router-dom';
import { Schedule } from '../../types';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface WeeklyScheduleWidgetProps {
  schedules: Schedule[];
  loading: boolean;
  displayCount: 3 | 5 | 10;
}

export const WeeklyScheduleWidget: React.FC<WeeklyScheduleWidgetProps> = ({
  schedules,
  loading,
  displayCount,
}) => {
  const displayedSchedules = schedules.slice(0, displayCount);

  // 3と5の場合は横並び、10の場合は5個のサイズで横スクロール
  const isScrollable = displayCount === 10;
  // スマホサイズでは1列、タブレット以上では3/5列
  const gridCols = displayCount === 3 
    ? 'grid-cols-1 sm:grid-cols-3' 
    : displayCount === 5 
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-5' 
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-5';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">今週のスケジュール</h2>
        <Link to="/schedule">
          <Button variant="outline" size="sm">
            すべて見る
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : schedules.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8 flex-1 flex items-center justify-center">
          今週のスケジュールはありません
        </p>
      ) : (
        <div className={`flex-1 ${isScrollable ? 'overflow-x-auto' : ''}`}>
          <div className={`grid ${gridCols} gap-3 ${isScrollable ? 'min-w-max' : 'w-full'}`}>
            {displayedSchedules.map((schedule) => {
              const participantCount = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
              // カードのサイズを調整（3件の場合は少し大きめ、5件と10件の場合は同じサイズ）
              const cardWidth = displayCount === 3 ? 'w-full' : displayCount === 5 ? 'w-full' : 'w-[180px] flex-shrink-0';
              return (
                <div
                  key={schedule.id}
                  className={`bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${cardWidth} aspect-square flex flex-col`}
                >
                  <div className="flex-1 flex flex-col space-y-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 flex-shrink-0">
                      {schedule.activityDescription}
                    </p>
                    <div className="flex-1 flex flex-col justify-end space-y-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(schedule.date, 'M/d')}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {schedule.startTime} - {schedule.endTime}
                      </p>
                      {schedule.locationText && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {schedule.locationText}
                        </p>
                      )}
                      {participantCount > 0 && (
                        <span className="inline-block text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded mt-1 w-fit">
                          +{participantCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

