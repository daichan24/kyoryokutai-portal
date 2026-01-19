import React from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface MonthlyReport {
  id: string;
  month: string;
  coverRecipient: string;
  coverSender: string;
  memberSheets: any[];
  supportRecords: Array<{
    id: string;
    supportDate: string;
    supportContent: string;
    supportBy: string;
    user: {
      id: string;
      name: string;
    };
  }>;
  submittedAt: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string;
  };
}

interface MonthlyReportPreviewProps {
  report: MonthlyReport;
}

export const MonthlyReportPreview: React.FC<MonthlyReportPreviewProps> = ({ report }) => {
  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });
  const monthStr = report.month ? format(new Date(`${report.month}-01`), 'yyyy年M月', { locale: ja }) : '';

  // HTMLコンテンツをテキストに変換（簡易版）
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ 
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
        月次報告書
      </h1>

      {/* 宛先・差出人 */}
      <div style={{ marginBottom: '20px' }}>
        {report.coverRecipient && (
          <div style={{ marginBottom: '10px' }}>
            <strong>宛先</strong>　{report.coverRecipient}
          </div>
        )}
        {report.coverSender && (
          <div>
            <strong>差出人</strong>　{report.coverSender}
          </div>
        )}
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

      {/* 対象月 */}
      {monthStr && (
        <div style={{ marginBottom: '30px' }}>
          <strong>対象月:</strong> {monthStr}
        </div>
      )}

      {/* 支援内容 */}
      <div style={{ marginBottom: '30px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '15px'
        }}>
          1. 支援内容
        </div>
        <div style={{ marginLeft: '15px' }}>
          {report.supportRecords && report.supportRecords.length > 0 ? (
            report.supportRecords.map((record, index) => (
              <div key={record.id} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < report.supportRecords.length - 1 ? '1px solid #ddd' : 'none' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>{record.user.name}</strong>　
                  <span>{format(new Date(record.supportDate), 'yyyy年M月d日', { locale: ja })}</span>
                  {record.supportBy && (
                    <span style={{ marginLeft: '10px' }}>（支援者: {record.supportBy}）</span>
                  )}
                </div>
                <div style={{ 
                  marginLeft: '15px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.8'
                }}>
                  {stripHtml(record.supportContent)}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>支援記録がありません</p>
          )}
        </div>
      </div>

      {/* 隊員別シート */}
      <div style={{ marginBottom: '30px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '15px'
        }}>
          2. 隊員別活動報告
        </div>
        <div style={{ marginLeft: '15px' }}>
          {Array.isArray(report.memberSheets) && report.memberSheets.length > 0 ? (
            report.memberSheets.map((sheet: any, index: number) => (
              <div key={index} style={{ 
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: index < report.memberSheets.length - 1 ? '1px solid #ddd' : 'none'
              }}>
                <h3 style={{ 
                  fontSize: '14pt',
                  fontWeight: 'bold',
                  marginBottom: '10px'
                }}>
                  {sheet.userName || `隊員${index + 1}`}
                </h3>

                {sheet.thisMonthActivities && sheet.thisMonthActivities.length > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>今月の活動:</div>
                    <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                      {sheet.thisMonthActivities.map((activity: any, i: number) => (
                        <li key={i} style={{ marginBottom: '5px' }}>
                          {activity.date}: {activity.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sheet.nextMonthPlan && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>来月の予定:</div>
                    <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                      {sheet.nextMonthPlan}
                    </div>
                  </div>
                )}

                {sheet.workQuestions && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>業務上の質問・相談:</div>
                    <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                      {sheet.workQuestions}
                    </div>
                  </div>
                )}

                {sheet.lifeNotes && (
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>生活面の備考:</div>
                    <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                      {sheet.lifeNotes}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>隊員別シートがありません</p>
          )}
        </div>
      </div>

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
          {report.creator.name}
        </div>
      </div>
    </div>
  );
};

