import React, { useState, useEffect } from 'react';
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
  };
}

export const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ report }) => {
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    fetchTemplateSettings();
    // ダークモードの検出
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
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

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ 
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

      {/* タイトル */}
      <h1 style={{ 
        textAlign: 'center', 
        fontSize: '18pt', 
        fontWeight: 'bold',
        marginBottom: '40px',
        color: isDarkMode ? '#1f2937' : '#000000'
      }}>
        {templateSettings?.weeklyReport.title || '地域おこし協力隊活動報告'}
      </h1>

      {/* 報告者 */}
      <div style={{ marginBottom: '20px' }}>
        <div>
          <strong>報告者</strong>　{report.user?.name || ''}
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
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '15px'
        }}>
          1. 活動内容（{weekStartStr}週の振り返り）
        </div>
        {Array.isArray(report.thisWeekActivities) && report.thisWeekActivities.length > 0 ? (
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            marginTop: '10px',
            border: '1px solid #000'
          }}>
            <thead>
              <tr className="dark:bg-gray-700">
                <th className="dark:border-gray-600 dark:text-gray-100" style={{ 
                  border: '1px solid #000', 
                  padding: '8px',
                  width: '30%',
                  textAlign: 'left',
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0'
                }}>
                  日時
                </th>
                <th className="dark:border-gray-600 dark:text-gray-100" style={{ 
                  border: '1px solid #000', 
                  padding: '8px',
                  textAlign: 'left',
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0'
                }}>
                  活動内容
                </th>
              </tr>
            </thead>
            <tbody>
              {report.thisWeekActivities.map((activity, index) => (
                <tr key={index}>
                  <td className="dark:border-gray-600" style={{ 
                    border: '1px solid #000', 
                    padding: '8px'
                  }}>
                    {activity.date || ''}
                  </td>
                  <td className="dark:border-gray-600" style={{ 
                    border: '1px solid #000', 
                    padding: '8px'
                  }}>
                    {activity.activity || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '15px'
        }}>
          2. 来週の予定
        </div>
        <div style={{ 
          marginLeft: '15px', 
          marginTop: '10px',
          whiteSpace: 'pre-wrap'
        }}>
          {report.nextWeekPlan || '（未記入）'}
        </div>
      </div>

      {/* 3. 備考 */}
      {report.note && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            fontWeight: 'bold', 
            backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
            color: isDarkMode ? '#f3f4f6' : '#000000',
            padding: '8px',
            marginBottom: '15px'
          }}>
            3. 備考
          </div>
          <div style={{ 
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap'
          }}>
            {report.note}
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

