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
  const inspectionTime = ''; // 時間情報があれば使用

  // HTMLコンテンツをテキストに変換（簡易版）
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // デフォルト値（テンプレート設定から取得する場合は後で実装）
  const recipient = '長沼町長　齋　藤　良　彦　様';
  const userName = `${inspection.user.name}`; // 〇〇課　地域おこし協力隊　氏名の形式にする場合は後で実装
  const text1 = '次の通り復命します。';

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
        復命書
      </h1>

      {/* 宛先 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          {recipient}
        </div>
        <div>
          氏名　{userName}
        </div>
      </div>

      {/* テキスト1 */}
      <div style={{ marginBottom: '20px' }}>
        {text1}
      </div>

      {/* 記（中央揃え、前後に改行） */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '30px', 
        marginBottom: '30px',
        fontSize: '14pt',
        fontWeight: 'bold'
      }}>
        記
      </div>

      {/* 1. 日時 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          1. 日時
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspectionDate}{inspectionTime ? ` ${inspectionTime}` : ''}
          {!inspection.inspectionPurpose && '（参考: 視察日時を記入してください）'}
        </div>
      </div>

      {/* 2. 場所 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          2. 場所
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.destination || '（参考: 視察先の場所を記入してください）'}
        </div>
      </div>

      {/* 3. 用務 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          3. 用務
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.purpose || '（参考: 視察の用務内容を記入してください）'}
        </div>
      </div>

      {/* 4. 目的 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          4. 目的
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.inspectionPurpose) || '（参考: 視察の目的を記入してください）'}
        </div>
      </div>

      {/* 5. 内容 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          5. 内容
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.inspectionContent) || '（参考: 視察の内容を記入してください）'}
        </div>
      </div>

      {/* 6. 処理てん末 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          6. 処理てん末
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.reflection) || '（参考: 処理の経過や結果を記入してください）'}
        </div>
      </div>

      {/* 7. 所感・今後 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          7. 所感・今後
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.futureAction) || '（参考: 所感や今後の予定を記入してください）'}
        </div>
      </div>

      {/* 8. その他報告 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="dark:bg-gray-800 dark:text-gray-100" style={{ 
          fontWeight: 'bold', 
          backgroundColor: '#f0f0f0', 
          padding: '8px',
          marginBottom: '10px'
        }}>
          8. その他報告
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.participants.length > 0 
            ? `参加者: ${inspection.user.name}、${inspection.participants.join('、')}`
            : '（参考: その他の報告事項があれば記入してください）'}
        </div>
      </div>

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


