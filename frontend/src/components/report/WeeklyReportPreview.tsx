import React, { useMemo, useState, useEffect } from 'react';
import { WeeklyReport } from '../../types';
import { parseWeekString, formatDate } from '../../utils/date';
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

  const weekStartStr = isNaN(weekStart.getTime()) 
    ? report.week 
    : formatDate(weekStart, 'yyyy年M月d日');
  
  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });
  const groupedActivities = useMemo(() => {
    if (!Array.isArray(report.thisWeekActivities)) return [];
    const groups = new Map<string, typeof report.thisWeekActivities>();
    report.thisWeekActivities.forEach((activity) => {
      const projectName = activity.projectName?.trim() || '未紐づけ';
      if (!groups.has(projectName)) groups.set(projectName, []);
      groups.get(projectName)!.push(activity);
    });
    return Array.from(groups.entries()).map(([projectName, items]) => ({
      projectName,
      items: [...items].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    }));
  }, [report.thisWeekActivities]);

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
      {/* ヘッダー（日付） */}
      <div style={{ textAlign: 'right', marginBottom: '30px' }}>
        {currentDate}
      </div>

      <div style={{ marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
        {templateSettings?.weeklyReport.recipient || '○○市役所　○○課長　様'}
      </div>

      {/* タイトル */}
      <h1 style={{
        textAlign: 'center', 
        fontSize: '18pt', 
        fontWeight: 'bold',
        marginBottom: '40px',
        color: '#1F2937'
      }}>
        {templateSettings?.weeklyReport.title || '地域おこし協力隊活動報告'}
      </h1>

      {/* 報告者 */}
      <div style={{ marginBottom: '20px' }}>
        <div>
          <strong>報告者</strong>{'\u3000'}{report.user?.name || ''}
        </div>
      </div>

      {/* 記 */}
      <div style={{
        textAlign: 'center', 
        marginTop: '30px', 
        marginBottom: '30px',
        fontSize: '14pt',
        fontWeight: 'bold'
      }}>
        記
      </div>

      {/* 対象週 */}
      <div style={{ marginBottom: '30px' }}>
        <strong>対象週:</strong> {report.week}（{weekStartStr}週）
      </div>

      {/* 1. 活動内容（先週の振り返り） */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0',
          color: '#1F2937',
          padding: '8px',
          marginBottom: '15px'
        }}>
          1. {templateSettings?.weeklyReport.activityLabel || '活動内容'}（{weekStartStr}週）
        </div>
        {groupedActivities.length > 0 ? (
          <div style={{ marginTop: '10px' }}>
            {groupedActivities.map((group) => (
              <div key={group.projectName} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                <div style={{ fontWeight: 'bold', margin: '6px 0' }}>
                  {group.projectName}
                </div>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #000'
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        border: '1px solid #000',
                        padding: '8px',
                        width: '30%',
                        textAlign: 'left',
                        backgroundColor: '#f0f0f0'
                      }}>
                        日時
                      </th>
                      <th style={{
                        border: '1px solid #000',
                        padding: '8px',
                        textAlign: 'left',
                        backgroundColor: '#f0f0f0'
                      }}>
                        活動内容
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((activity, index) => (
                      <tr key={`${group.projectName}-${index}`}>
                        <td style={{
                          border: '1px solid #000',
                          padding: '8px'
                        }}>
                          {activity.date || ''}
                        </td>
                        <td style={{
                          border: '1px solid #000',
                          padding: '8px'
                        }}>
                          {activity.activity || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginLeft: '15px', marginTop: '10px' }}>
            活動内容がありません
          </p>
        )}
      </div>

      {/* 2. 来週の予定（nullの場合でも項目自体は表示） */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0',
          color: '#1F2937',
          padding: '8px',
          marginBottom: '15px'
        }}>
          2. {templateSettings?.weeklyReport.nextPlanLabel || '来週の予定'}
        </div>
        <div style={{
          marginLeft: '15px', 
          marginTop: '10px',
          whiteSpace: 'pre-wrap'
        }}>
          {report.nextWeekPlan || '（未記入）'}
        </div>
      </div>

      {/* 3. 振り返り・所感 */}
      {report.reflection && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            fontWeight: 'bold',
            backgroundColor: '#f0f0f0',
            color: '#1F2937',
            padding: '8px',
            marginBottom: '15px'
          }}>
            3. {templateSettings?.weeklyReport.reflectionLabel || '振り返り・所感'}
          </div>
          <div style={{
            marginLeft: '15px',
            marginTop: '10px',
            whiteSpace: 'pre-wrap'
          }}>
            {report.reflection}
          </div>
        </div>
      )}

      {/* 4. 備考 */}
      {report.note && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0',
            color: '#1F2937',
            padding: '8px',
            marginBottom: '15px'
          }}>
            4. {templateSettings?.weeklyReport.noteLabel || '備考'}
          </div>
          <div style={{
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap'
          }}
          dangerouslySetInnerHTML={{ __html: report.note }}
          />
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
        <div>
          {currentDate}
        </div>
        <div style={{ marginTop: '10px' }}>
          {report.user?.name || ''}
        </div>
      </div>
    </div>
  );
};
