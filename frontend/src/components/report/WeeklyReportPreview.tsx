import React from 'react';
import { WeeklyReport } from '../../types';
import { parseWeekString, formatDate } from '../../utils/date';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface WeeklyReportPreviewProps {
  report: WeeklyReport;
}

export const WeeklyReportPreview: React.FC<WeeklyReportPreviewProps> = ({ report }) => {
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
    <div className="bg-white text-gray-900" style={{ 
      width: '210mm', 
      minHeight: '297mm',
      padding: '20mm',
      fontFamily: "'MS Gothic', 'Yu Gothic', 'Meiryo', monospace",
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
        marginBottom: '40px'
      }}>
        週次報告書
      </h1>

      {/* 宛先 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>宛先</strong>　○○市役所　○○課長　様
        </div>
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

      {/* 1. 今週の活動内容 */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '15px'
        }}>
          1. 今週の活動内容
        </div>
        {Array.isArray(report.thisWeekActivities) && report.thisWeekActivities.length > 0 ? (
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            marginTop: '10px',
            border: '1px solid #000'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ 
                  border: '1px solid #000', 
                  padding: '8px',
                  width: '30%',
                  textAlign: 'left'
                }}>
                  日時
                </th>
                <th style={{ 
                  border: '1px solid #000', 
                  padding: '8px',
                  textAlign: 'left'
                }}>
                  活動内容
                </th>
              </tr>
            </thead>
            <tbody>
              {report.thisWeekActivities.map((activity, index) => (
                <tr key={index}>
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
        ) : (
          <p style={{ marginLeft: '15px', marginTop: '10px' }}>
            活動内容がありません
          </p>
        )}
      </div>

      {/* 2. 来週の予定 */}
      {report.nextWeekPlan && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
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
            {report.nextWeekPlan}
          </div>
        </div>
      )}

      {/* 3. 備考 */}
      {report.note && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
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

