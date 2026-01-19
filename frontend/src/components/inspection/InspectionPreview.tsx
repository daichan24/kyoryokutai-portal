import React from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Inspection {
  id: string;
  date: string;
  destination: string;
  purpose: string;
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  participants: string[];
  user: { id: string; name: string };
  project?: { id: string; projectName: string };
}

interface InspectionPreviewProps {
  inspection: Inspection;
}

export const InspectionPreview: React.FC<InspectionPreviewProps> = ({ inspection }) => {
  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });
  const inspectionDate = format(new Date(inspection.date), 'yyyy年M月d日', { locale: ja });

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
        視察復命書
      </h1>

      {/* 宛先 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>宛先</strong>　○○市役所　○○課長　様
        </div>
        <div>
          <strong>報告者</strong>　{inspection.user.name}
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

      {/* 基本情報 */}
      <div style={{ marginBottom: '30px' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          marginBottom: '15px'
        }}>
          <tbody>
            <tr>
              <td className="dark:bg-gray-700 dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px',
                width: '30%',
                backgroundColor: '#f0f0f0',
                fontWeight: 'bold'
              }}>
                視察日
              </td>
              <td className="dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px'
              }}>
                {inspectionDate}
              </td>
            </tr>
            <tr>
              <td className="dark:bg-gray-700 dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px',
                backgroundColor: '#f0f0f0',
                fontWeight: 'bold'
              }}>
                視察先
              </td>
              <td className="dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px'
              }}>
                {inspection.destination}
              </td>
            </tr>
            {inspection.project && (
              <tr>
                <td className="dark:bg-gray-700 dark:border-gray-600" style={{ 
                  border: '1px solid #000', 
                  padding: '8px',
                  backgroundColor: '#f0f0f0',
                  fontWeight: 'bold'
                }}>
                  関連プロジェクト
                </td>
                <td className="dark:border-gray-600" style={{ 
                  border: '1px solid #000', 
                  padding: '8px'
                }}>
                  {inspection.project.projectName}
                </td>
              </tr>
            )}
            <tr>
              <td className="dark:bg-gray-700 dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px',
                backgroundColor: '#f0f0f0',
                fontWeight: 'bold'
              }}>
                参加者
              </td>
              <td className="dark:border-gray-600" style={{ 
                border: '1px solid #000', 
                padding: '8px'
              }}>
                {inspection.user.name}
                {inspection.participants.length > 0 && `、${inspection.participants.join('、')}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 1. 視察目的 */}
      {inspection.inspectionPurpose && (
        <div style={{ marginBottom: '30px' }}>
          <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
            padding: '8px',
            marginBottom: '15px'
          }}>
            1. 視察目的
          </div>
          <div style={{ 
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.8'
          }}>
            {stripHtml(inspection.inspectionPurpose)}
          </div>
        </div>
      )}

      {/* 2. 視察内容 */}
      {inspection.inspectionContent && (
        <div style={{ marginBottom: '30px' }}>
          <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
            padding: '8px',
            marginBottom: '15px'
          }}>
            2. 視察内容
          </div>
          <div style={{ 
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.8'
          }}>
            {stripHtml(inspection.inspectionContent)}
          </div>
        </div>
      )}

      {/* 3. 所感 */}
      {inspection.reflection && (
        <div style={{ marginBottom: '30px' }}>
          <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
            padding: '8px',
            marginBottom: '15px'
          }}>
            3. 所感
          </div>
          <div style={{ 
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.8'
          }}>
            {stripHtml(inspection.reflection)}
          </div>
        </div>
      )}

      {/* 4. 今後のアクション */}
      {inspection.futureAction && (
        <div style={{ marginBottom: '30px' }}>
          <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
            fontWeight: 'bold', 
            backgroundColor: '#f0f0f0', 
            padding: '8px',
            marginBottom: '15px'
          }}>
            4. 今後のアクション
          </div>
          <div style={{ 
            marginLeft: '15px', 
            marginTop: '10px',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.8'
          }}>
            {stripHtml(inspection.futureAction)}
          </div>
        </div>
      )}

      {/* フッター */}
      <div style={{ 
        marginTop: '60px',
        textAlign: 'right'
      }}>
        <div>
          {currentDate}
        </div>
        <div style={{ marginTop: '10px' }}>
          {inspection.user.name}
        </div>
      </div>
    </div>
  );
};

