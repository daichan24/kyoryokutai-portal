import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DataPoint {
  date: string; // YYYY-MM-DD
  count: number;
  postType: 'STORY' | 'FEED';
}

interface FollowerGraphProps {
  posts: Array<{
    postedAt: string;
    followerCount?: number | null;
    postType: 'STORY' | 'FEED';
  }>;
  accountName?: string;
}

export const FollowerGraph: React.FC<FollowerGraphProps> = ({ posts, accountName }) => {
  const dataPoints = useMemo(() => {
    return posts
      .filter((p) => p.followerCount != null)
      .map((p) => ({
        date: p.postedAt.slice(0, 10),
        count: p.followerCount!,
        postType: p.postType,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [posts]);

  if (dataPoints.length === 0) return null;

  const maxCount = Math.max(...dataPoints.map((d) => d.count));
  const minCount = Math.min(...dataPoints.map((d) => d.count));
  const range = maxCount - minCount || 1;

  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xStep = dataPoints.length > 1 ? innerW / (dataPoints.length - 1) : innerW;

  const toX = (i: number) => PAD.left + (dataPoints.length > 1 ? i * xStep : innerW / 2);
  const toY = (v: number) => PAD.top + innerH - ((v - minCount) / range) * innerH;

  // 折れ線パス
  const linePath = dataPoints
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.count)}`)
    .join(' ');

  // Y軸の目盛り（3本）
  const yTicks = [minCount, Math.round((minCount + maxCount) / 2), maxCount];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        フォロワー数推移{accountName ? ` — ${accountName}` : ''}
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: '300px', maxHeight: '200px' }}>
          {/* グリッド線 */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={toY(tick)}
                x2={W - PAD.right}
                y2={toY(tick)}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
              <text
                x={PAD.left - 6}
                y={toY(tick) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#9ca3af"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          ))}

          {/* 折れ線 */}
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />

          {/* データポイント */}
          {dataPoints.map((d, i) => (
            <g key={i}>
              <circle
                cx={toX(i)}
                cy={toY(d.count)}
                r="4"
                fill={d.postType === 'FEED' ? '#3b82f6' : '#8b5cf6'}
                stroke="white"
                strokeWidth="1.5"
              />
              {/* X軸ラベル（間引き） */}
              {(dataPoints.length <= 8 || i % Math.ceil(dataPoints.length / 8) === 0) && (
                <text
                  x={toX(i)}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                >
                  {format(new Date(d.date), 'M/d', { locale: ja })}
                </text>
              )}
              {/* ホバー用透明エリア（title） */}
              <title>{`${d.date} ${d.postType === 'FEED' ? 'フィード' : 'ストーリーズ'}: ${d.count.toLocaleString()}人`}</title>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />フィード
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />ストーリーズ
        </span>
        <span className="ml-auto">最新: {dataPoints[dataPoints.length - 1]?.count.toLocaleString()}人</span>
      </div>
    </div>
  );
};
