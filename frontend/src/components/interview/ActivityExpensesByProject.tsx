import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityExpenseEntry {
  id: string;
  spentAt: string;
  description: string;
  amount: number;
  project?: { id: string; projectName: string; themeColor: string | null } | null;
}

interface ActivityExpensesByProjectProps {
  entries: ActivityExpenseEntry[];
}

function formatYen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

export const ActivityExpensesByProject: React.FC<ActivityExpensesByProjectProps> = ({ entries }) => {
  const byProject = useMemo(() => {
    const map = new Map<string, { project: { id: string; projectName: string; themeColor: string | null } | null; entries: ActivityExpenseEntry[]; total: number }>();
    
    entries.forEach((entry) => {
      const key = entry.project?.id || '__none__';
      if (!map.has(key)) {
        map.set(key, { project: entry.project || null, entries: [], total: 0 });
      }
      const group = map.get(key)!;
      group.entries.push(entry);
      group.total += entry.amount;
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return 0;
      });
  }, [entries]);

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">支出記録がありません</p>;
  }

  return (
    <div className="space-y-3">
      {byProject.map(([key, { project, entries: projectEntries, total }]) => (
        <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div
            className="px-3 py-2 text-sm font-medium text-white flex items-center justify-between"
            style={{ backgroundColor: project?.themeColor || '#64748b' }}
          >
            <span>{project?.projectName || 'プロジェクト未設定'}</span>
            <span className="font-bold tabular-nums">{formatYen(total)}</span>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800/60">
            {projectEntries.map((entry) => (
              <li key={entry.id} className="px-3 py-2 flex items-center justify-between text-sm">
                <div className="flex-1">
                  <span className="text-gray-500 dark:text-gray-400 mr-2">
                    {format(parseISO(entry.spentAt.slice(0, 10)), 'M月d日', { locale: ja })}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">{entry.description}</span>
                </div>
                <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100 ml-3">
                  {formatYen(entry.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
