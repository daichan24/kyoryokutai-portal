import React from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { X } from 'lucide-react';

interface InterviewParticipantUser {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
}

interface InterviewSchedule {
  id: string;
  startDate: string;
  endDate: string;
  date: string;
  startTime: string;
  endTime: string;
  shortTitle: string | null;
  activityDescription: string;
  freeNote: string | null;
  locationText: string | null;
  location: { id: string; name: string } | null;
  project: { id: string; projectName: string; themeColor: string | null } | null;
  scheduleParticipants: Array<{
    userId: string;
    user: InterviewParticipantUser;
  }>;
  legacyParticipantUsers: InterviewParticipantUser[];
}

interface SchedulePreviewModalProps {
  date: Date;
  schedules: InterviewSchedule[];
  onClose: () => void;
}

export const SchedulePreviewModal: React.FC<SchedulePreviewModalProps> = ({ date, schedules, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {format(date, 'M月d日（EEE）', { locale: ja })}の予定
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {schedules.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">この日の予定はありません</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => {
                const people = [
                  ...s.scheduleParticipants.map((p) => p.user),
                  ...s.legacyParticipantUsers,
                ];
                const uniquePeople = Array.from(
                  new Map(people.map((p) => [p.id, p])).values()
                );

                return (
                  <div
                    key={s.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                        {s.startTime} - {s.endTime}
                      </span>
                      {s.project && (
                        <span
                          className="text-xs px-2 py-1 rounded-full font-medium text-white"
                          style={{ backgroundColor: s.project.themeColor || '#6366f1' }}
                        >
                          {s.project.projectName}
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {s.shortTitle?.trim() || s.activityDescription?.trim()?.split(/\n/)?.[0]?.slice(0, 80) || '（タイトルなし）'}
                    </h4>

                    {s.activityDescription?.trim() && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">
                        {s.activityDescription}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      {(s.location?.name || s.locationText) && (
                        <span className="px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          📍 {s.location?.name || s.locationText}
                        </span>
                      )}
                      {uniquePeople.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>

                    {s.freeNote?.trim() && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 border-t border-dashed border-gray-200 dark:border-gray-600 pt-2">
                        メモ: {s.freeNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
