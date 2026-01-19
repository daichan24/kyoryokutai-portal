import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';

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

interface TemplateSettings {
  monthlyReport: {
    recipient: string;
    sender: string;
    title: string;
    text1: string;
    text2: string;
    contact: string;
  };
}

export const MonthlyReportPreview: React.FC<MonthlyReportPreviewProps> = ({ report }) => {
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });
  const monthStr = report.month ? format(new Date(`${report.month}-01`), 'yyyy年M月', { locale: ja }) : '';
  const reportDate = report.submittedAt 
    ? format(new Date(report.submittedAt), 'yyyy年M月d日', { locale: ja })
    : currentDate;

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
      const response = await api.get<{ monthlyReport: TemplateSettings['monthlyReport'] }>('/api/document-templates');
      setTemplateSettings({ monthlyReport: response.data.monthlyReport });
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
      // デフォルト値を使用
      setTemplateSettings({
        monthlyReport: {
          recipient: '長沼町長　齋　藤　良　彦　様',
          sender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
          title: '長沼町地域おこし協力隊サポート業務月次報告',
          text1: '表記業務の結果について別紙のとおり報告いたします。',
          text2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
          contact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
        },
      });
    }
  };

  // HTMLコンテンツをテキストに変換（簡易版）
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // テンプレート設定から値を取得（置換処理）
  const recipient = report.coverRecipient || templateSettings?.monthlyReport.recipient || '長沼町長　齋　藤　良　彦　様';
  const sender = report.coverSender || templateSettings?.monthlyReport.sender || '一般社団法人まおいのはこ<br>代表理事　坂本　一志';
  const titleTemplate = templateSettings?.monthlyReport.title || '長沼町地域おこし協力隊サポート業務月次報告（{month}）';
  const title = titleTemplate.replace('{month}', monthStr);
  const text1 = templateSettings?.monthlyReport.text1 || '表記業務の結果について別紙のとおり報告いたします。';
  const text2Template = templateSettings?.monthlyReport.text2 || '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表';
  const text2 = text2Template.replace('{count}', String(report.memberSheets?.length || 0)).replace('◯名分', `${report.memberSheets?.length || 0}名分`);
  const contact = templateSettings?.monthlyReport.contact || '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org';

  if (!templateSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">テンプレート設定を読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 表紙（1ページ目） */}
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ 
        width: '210mm', 
        minHeight: '297mm',
        padding: '20mm',
        fontFamily: "'MS Gothic', 'Yu Gothic', 'Meiryo', monospace",
        fontSize: '12pt',
        lineHeight: '1.8',
        margin: '0 auto',
        boxSizing: 'border-box',
        pageBreakAfter: 'always'
      }}>
        {/* 報告日（右寄せ） */}
        <div style={{ textAlign: 'right', marginBottom: '30px' }}>
          {reportDate}
        </div>

        {/* 宛先 */}
        <div style={{ marginBottom: '20px' }}>
          {recipient}
        </div>

        {/* 差出人（右寄せ） */}
        <div style={{ textAlign: 'right', marginBottom: '40px' }}>
          {sender.split('<br>').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < sender.split('<br>').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {/* タイトル */}
        <h1 style={{ 
          textAlign: 'center', 
          fontSize: '18pt', 
          fontWeight: 'bold',
          marginBottom: '40px'
        }}>
          {title}
        </h1>

        {/* テキスト1 */}
        <div style={{ marginBottom: '30px' }}>
          {text1}
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

        {/* テキスト2 */}
        <div style={{ 
          marginBottom: '30px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.8'
        }}>
          {text2}
        </div>

        {/* 以上（右寄せ） */}
        <div style={{ 
          textAlign: 'right',
          marginTop: '40px',
          marginBottom: '40px',
          fontSize: '14pt',
          fontWeight: 'bold'
        }}>
          以上
        </div>

        {/* 担当者情報 */}
        <div style={{ 
          marginTop: '60px',
          textAlign: 'left',
          lineHeight: '1.8'
        }}>
          {contact}
        </div>
      </div>

      {/* 隊員別シート（各隊員1ページずつ） */}
      {Array.isArray(report.memberSheets) && report.memberSheets.length > 0 && (
        report.memberSheets.map((sheet: any, index: number) => {
          const sheetDate = format(new Date(`${report.month}-01`), 'yyyy年M月', { locale: ja });
          const reiwaYear = new Date(`${report.month}-01`).getFullYear() - 2018; // 令和年計算
          const monthNum = new Date(`${report.month}-01`).getMonth() + 1;
          const dayNum = new Date(`${report.month}-01`).getDate();
          
          return (
            <div key={index} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" style={{ 
              width: '210mm', 
              minHeight: '297mm',
              padding: '20mm',
              fontFamily: "'MS Gothic', 'Yu Gothic', 'Meiryo', monospace",
              fontSize: '12pt',
              lineHeight: '1.8',
              margin: '0 auto',
              boxSizing: 'border-box',
              pageBreakAfter: index < report.memberSheets.length - 1 ? 'always' : 'auto'
            }}>
              {/* 協力隊活動ヒアリングシート（右寄せ） */}
              <div style={{ textAlign: 'right', marginBottom: '30px' }}>
                協力隊活動ヒアリングシート
              </div>

              {/* 氏名と月 */}
              <div style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '10px' }}>
                  氏名{sheet.userName || `隊員${index + 1}`}　{sheetDate}分
                </div>
                <div>
                  令和{reiwaYear}年　{monthNum}月　{dayNum}日
                </div>
              </div>

              {/* 今月の主な活動内容 */}
              <div style={{ marginBottom: '30px' }}>
                <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
                  fontWeight: 'bold', 
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0', 
                  padding: '8px',
                  marginBottom: '15px'
                }}>
                  【今月の主な活動内容】
                </div>
                {sheet.thisMonthActivities && sheet.thisMonthActivities.length > 0 ? (
                  <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                    {sheet.thisMonthActivities.map((activity: any, i: number) => (
                      <li key={i} style={{ marginBottom: '5px' }}>
                        {activity.date}: {activity.description}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ marginLeft: '15px', color: '#666', fontStyle: 'italic' }}>活動内容がありません</p>
                )}
              </div>

              {/* 翌月以降の活動予定 */}
              <div style={{ marginBottom: '30px' }}>
                <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
                  fontWeight: 'bold', 
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0', 
                  padding: '8px',
                  marginBottom: '15px'
                }}>
                  【翌月以降の活動予定】
                </div>
                <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {sheet.nextMonthPlan || '（未記入）'}
                </div>
              </div>

              {/* 勤務に関する質問など */}
              <div style={{ marginBottom: '30px' }}>
                <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
                  fontWeight: 'bold', 
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0', 
                  padding: '8px',
                  marginBottom: '15px'
                }}>
                  【勤務に関する質問など】
                </div>
                <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {sheet.workQuestions || '（未記入）'}
                </div>
              </div>

              {/* 生活面の留意事項その他 */}
              <div style={{ marginBottom: '30px' }}>
                <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
                  fontWeight: 'bold', 
                  backgroundColor: isDarkMode ? '#374151' : '#f0f0f0', 
                  padding: '8px',
                  marginBottom: '15px'
                }}>
                  【生活面の留意事項その他】
                </div>
                <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
                  {sheet.lifeNotes || '（未記入）'}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* 支援内容（最終ページ） */}
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
        <div style={{ textAlign: 'right', marginBottom: '30px' }}>
          {currentDate}
        </div>

        <h2 style={{ 
          textAlign: 'center', 
          fontSize: '16pt', 
          fontWeight: 'bold',
          marginBottom: '40px'
        }}>
          一般社団法人まおいのはこの支援内容（{monthStr}）
        </h2>

        <div style={{ marginLeft: '15px' }}>
          {report.supportRecords && report.supportRecords.length > 0 ? (
            report.supportRecords.map((record, index) => (
              <div key={record.id} style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13pt' }}>
                  【{record.user.name}】
                </div>
                <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <li style={{ marginBottom: '5px' }}>
                    {format(new Date(record.supportDate), 'yyyy年M月d日', { locale: ja })}: {stripHtml(record.supportContent)}
                    {record.supportBy && `（支援者: ${record.supportBy}）`}
                  </li>
                </ul>
              </div>
            ))
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>支援記録がありません</p>
          )}
        </div>
      </div>
    </div>
  );
};
