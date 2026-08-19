import React, { useMemo, useState, useEffect } from 'react';
import { WeeklyReport } from '../../types';
import { parseWeekString } from '../../utils/date';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';

interface WeeklyReportPreviewProps {
  report: WeeklyReport;
}

interface TemplateSettings {
  weeklyReport: {
    recipient: string;
    title: string;
    activityLabel: string;
    nextPlanLabel: string;
    reflectionLabel: string;
    noteLabel: string;
  };
}

function stripHtml(value?: string | null) {
  return (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ report }) => {
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);

  useEffect(() => {
    fetchTemplateSettings();
  }, []);

  const fetchTemplateSettings = async () => {
    try {
      const response = await api.get<TemplateSettings>('/api/document-templates');
      setTemplateSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
      // デフォルト値を使用
      setTemplateSettings({
        weeklyReport: {
          recipient: '○○市役所　○○課長　様',
          title: '地域おこし協力隊活動報告',
          activityLabel: '活動内容',
          nextPlanLabel: '来週の予定',
          reflectionLabel: '振り返り・所感',
          noteLabel: '備考',
        },
      });
    }
  };
  let weekStart: Date;
  try {
    weekStart = parseWeekString(report.week);
  } catch (error) {
    weekStart = new Date();
  }

  const weekStartLabel = isNaN(weekStart.getTime())
    ? report.week
    : format(weekStart, 'M/d', { locale: ja });

  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });

  const groupedByDate = useMemo(() => {
    if (!Array.isArray(report.thisWeekActivities)) return [];
    const map = new Map<string, typeof report.thisWeekActivities>();
    report.thisWeekActivities.forEach((activity) => {
      if (!activity.date) return;
      if (!map.has(activity.date)) map.set(activity.date, []);
      map.get(activity.date)!.push(activity);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => {
        const latestEndDate = items.reduce<string | undefined>((max, item) => {
          if (!item.endDate) return max;
          return !max || item.endDate > max ? item.endDate : max;
        }, undefined);
        return { date, endDate: latestEndDate, items };
      });
  }, [report.thisWeekActivities]);

  const formatDateHeader = (dateStr: string, endDateStr?: string) => {
    try {
      const start = new Date(`${dateStr}T00:00:00`);
      const startLabel = format(start, 'M月d日（EEE）', { locale: ja });
      if (!endDateStr) return startLabel;
      const end = new Date(`${endDateStr}T00:00:00`);
      return `${startLabel}〜${format(end, 'M月d日（EEE）', { locale: ja })}`;
    } catch (error) {
      return dateStr;
    }
  };

  const nextScheduleItems = (report.nextWeekPlan || '')
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="bg-white text-gray-900" style={{
      width: '210mm',
      minHeight: '297mm',
      padding: '20mm',
      fontFamily: "'MS Mincho', 'Yu Mincho', 'Mincho', serif",
      fontSize: '12pt',
      lineHeight: '1.8',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* ヘッダー（日付・報告者） */}
      <div style={{ textAlign: 'right', marginBottom: '4px' }}>{currentDate}</div>
      <div style={{ textAlign: 'right', marginBottom: '30px' }}>{report.user?.name || ''}</div>

      {/* タイトル */}
      <h1 style={{
        textAlign: 'center',
        fontSize: '18pt',
        fontWeight: 'bold',
        marginBottom: '36px',
        color: '#1F2937'
      }}>
        {templateSettings?.weeklyReport.title || '地域おこし協力隊活動報告'}
      </h1>

      {/* ■週振り返り */}
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        ■{weekStartLabel}週振り返り
      </div>
      <div style={{ marginBottom: '18px' }}>
        先週行った主な活動内容をご報告いたします。
      </div>

      {groupedByDate.length > 0 ? (
        <div style={{ marginBottom: '30px' }}>
          {groupedByDate.map((group) => (
            <div key={group.date} style={{ marginBottom: '14px', pageBreakInside: 'avoid' }}>
              <div style={{ fontWeight: 'bold' }}>
                ・{formatDateHeader(group.date, group.endDate)}
              </div>
              {group.items.map((activity, index) => (
                <div key={index} style={{ marginLeft: '1.6em', whiteSpace: 'pre-wrap' }}>
                  {activity.activity || ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ marginLeft: '15px', marginBottom: '30px' }}>
          活動内容がありません
        </p>
      )}

      {/* ■今後の主なスケジュール */}
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        ■今後の主なスケジュール
      </div>
      <div style={{ marginBottom: '30px' }}>
        {nextScheduleItems.length > 0 ? (
          nextScheduleItems.map((item, index) => (
            <div
              key={index}
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {item}
            </div>
          ))
        ) : (
          <p style={{ marginLeft: '15px' }}>（未記入）</p>
        )}
      </div>

      {/* 振り返り・所感 */}
      {report.reflection && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            ■{templateSettings?.weeklyReport.reflectionLabel || '振り返り・所感'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {report.reflection}
          </div>
        </div>
      )}

      {/* 備考 */}
      {report.note && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            ■{templateSettings?.weeklyReport.noteLabel || '備考'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {stripHtml(report.note)}
          </div>
        </div>
      )}

      {/* フッター（提出日など） */}
      <div style={{
        marginTop: '60px',
        textAlign: 'right'
      }}>
        {report.submittedAt && (
          <div style={{ marginBottom: '10px' }}>
            <strong>提出日:</strong> {format(new Date(report.submittedAt), 'yyyy年M月d日', { locale: ja })}
          </div>
        )}
      </div>
    </div>
  );
};
