import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface PostData {
  postedAt: string;
  followerCount?: number | null;
  postType: 'STORY' | 'FEED';
  accountId?: string | null;
}

interface DataPoint {
  date: string;
  count: number;
  postType: 'STORY' | 'FEED';
}

interface SeriesData {
  accountId: string | null;
  accountName: string;
  points: DataPoint[];
}

interface FollowerGraphProps {
  posts: PostData[];
  /** アカウント名マップ: accountId -> 表示名 */
  accountNames?: Record<string, string>;
  /** 単一アカウント表示時のアカウント名（accountNamesがない場合のフォールバック） */
  accountName?: string;
}

// アカウントごとの色（最大6アカウント）
const SERIES_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const FollowerGraph: React.FC<FollowerGraphProps> = ({ posts, accountNames, accountName }) => {
  // アカウントごとにデータを分割
  const series = useMemo<SeriesData[]>(() => {
    const withFollower = posts.filter(p => p.followerCount != null);
    if (withFollower.length === 0) return [];

    // accountIdでグループ化
    const map = new Map<string, PostData[]>();
    withFollower.forEach(p => {
      const key = p.accountId ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });

    return Array.from(map.entries()).map(([key, ps]) => {
      const accId = key === '__none__' ? null : key;
      const name = accId
        ? (accountNames?.[accId] ?? accountName ?? accId)
        : (accountName ?? 'アカウント');
      const points = ps
        .map(p => ({ date: p.postedAt.slice(0, 10), count: p.followerCount!, postType: p.postType }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { accountId: accId, accountName: name, points };
    });
  }, [posts, accountNames, accountName]);

  if (series.length === 0) return null;

  // 全データポイントを結合してスケール計算
  const allPoints = series.flatMap(s => s.points);
  const maxCount = Math.max(...allPoints.map(d => d.count));
  const minCount = Math.min(...allPoints.map(d => d.count));
  const range = maxCount - minCount || 1;

  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // 全日付を収集してX軸を統一
  const allDates = Array.from(new Set(allPoints.map(d => d.date))).sort();
  const toX = (date: string) => {
    if (allDates.length <= 1) return PAD.left + innerW / 2;
    const idx = allDates.indexOf(date);
    return PAD.left + (idx / (allDates.length - 1)) * innerW;
  };
  const toY = (v: number) => PAD.top + innerH - ((v - minCount) / range) * innerH;

  const yTicks = [minCount, Math.round((minCount + maxCount) / 2), maxCount];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">フォロワー数推移</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: '300px', maxHeight: '200px' }}>
          {/* グリッド線 */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} y1={toY(tick)} x2={W - PAD.right} y2={toY(tick)} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 2" />
              <text x={PAD.left - 6} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{tick.toLocaleString()}</text>
            </g>
          ))}

          {/* アカウントごとの折れ線 */}
          {series.map((s, si) => {
            const color = SERIES_COLORS[si % SERIES_COLORS.length];
            const linePath = s.points.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.date)} ${toY(d.count)}`).join(' ');
            return (
              <g key={s.accountId ?? 'none'}>
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" opacity="0.7" />
                {s.points.map((d, i) => (
                  <g key={i}>
                    <circle
                      cx={toX(d.date)}
                      cy={toY(d.count)}
                      r="4"
                      fill={d.postType === 'FEED' ? '#22c55e' : '#3b82f6'}
                      stroke={color}
                      strokeWidth="1.5"
                    />
                    {(s.points.length <= 8 || i % Math.ceil(s.points.length / 8) === 0) && (
                      <text x={toX(d.date)} y={H - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">
                        {format(new Date(d.date), 'M/d', { locale: ja })}
                      </text>
                    )}
                    <title>{`${s.accountName} ${d.date} ${d.postType === 'FEED' ? 'フィード' : 'ストーリーズ'}: ${d.count.toLocaleString()}人`}</title>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
        {series.map((s, si) => (
          <span key={s.accountId ?? 'none'} className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: SERIES_COLORS[si % SERIES_COLORS.length] }} />
            {s.accountName}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />フィード
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />ストーリーズ
        </span>
        {series.length === 1 && (
          <span className="ml-auto">最新: {series[0].points[series[0].points.length - 1]?.count.toLocaleString()}人</span>
        )}
      </div>
    </div>
  );
};
