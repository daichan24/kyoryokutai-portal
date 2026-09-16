import React from 'react';
import { X, MapPin, Clock, Calendar as CalendarIcon, Link as LinkIcon, Users, Briefcase } from 'lucide-react';
import { Schedule as ScheduleType } from '../../types';
import { formatDate, formatTime } from '../../utils/date';

interface ScheduleReadOnlyPreviewModalProps {
  schedule: ScheduleType;
  onClose: () => void;
}

/**
 * 他人のスケジュールをプレビュー表示する専用モーダル。編集フォームをグレーアウト
 * するのではなく、必要な情報だけを読みやすく表示する。
 */
export const ScheduleReadOnlyPreviewModal: React.FC<ScheduleReadOnlyPreviewModalProps> = ({
  schedule,
  onClose,
}) => {
  const owner = schedule.user;
  const title = schedule.title || schedule.activityDescription || '(タイトルなし)';
  const missionName = schedule.task?.mission?.missionName;
  const projectName = schedule.project?.projectName || schedule.task?.project?.projectName;
  const participants = (schedule.scheduleParticipants || []).filter((p) => p.status !== 'REJECTED');
  const isAllDay = !!schedule.isAllDay;
  const isTimeUnspecified = !!schedule.isTimeUnspecified;

  const startDateStr = schedule.startDate || schedule.date;
  const endDateStr = schedule.endDate || startDateStr;
  const isMultiDay = formatDate(startDateStr, 'yyyy-MM-dd') !== formatDate(endDateStr, 'yyyy-MM-dd');
  const dateRangeText = isMultiDay
    ? `${formatDate(startDateStr, 'yyyy年M月d日(E)')} 〜 ${formatDate(endDateStr, 'M月d日(E)')}`
    : formatDate(startDateStr, 'yyyy年M月d日(E)');

  const memoText = schedule.freeNote?.trim()
    || (schedule.activityDescription?.trim() && schedule.activityDescription.trim() !== title.trim()
      ? schedule.activityDescription.trim()
      : '');

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full sm:m-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
              style={{ backgroundColor: owner?.avatarColor || '#6B7280' }}
            >
              {(owner?.avatarLetter || owner?.name || '').charAt(0)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
              {owner?.name || '不明'}さんの予定
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{title}</h2>

          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <CalendarIcon className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
              <span>{dateRangeText}</span>
            </div>
            {!isAllDay && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <span>
                  {isTimeUnspecified
                    ? '時間未定'
                    : `${formatTime(schedule.startTime)} 〜 ${formatTime(schedule.endTime)}`}
                </span>
              </div>
            )}
            {isAllDay && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <span>終日</span>
              </div>
            )}
            {schedule.locationText && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <span className="break-words">{schedule.locationText}</span>
              </div>
            )}
            {(missionName || projectName) && (
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <span className="break-words">{[missionName, projectName].filter(Boolean).join(' / ')}</span>
              </div>
            )}
            {participants.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <span className="break-words">
                  {participants.map((p) => p.user?.name).filter(Boolean).join('、')}
                </span>
              </div>
            )}
          </div>

          {memoText && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">メモ</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {memoText}
              </p>
            </div>
          )}

          {schedule.referenceUrl && (
            <a
              href={schedule.referenceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              関連リンクを開く
            </a>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
