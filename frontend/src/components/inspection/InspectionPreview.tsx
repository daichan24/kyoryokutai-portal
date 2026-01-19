import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';

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

interface TemplateSettings {
  inspection: {
    recipient: string;
    title: string;
    namePrefix: string;
    text1: string;
    item1: string;
    item2: string;
    item3: string;
    item4: string;
    item5: string;
    item6: string;
    item7: string;
    item8: string;
  };
}

export const InspectionPreview: React.FC<InspectionPreviewProps> = ({ inspection }) => {
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const currentDate = format(new Date(), 'yyyy年M月d日', { locale: ja });
  const inspectionDate = format(new Date(inspection.date), 'yyyy年M月d日', { locale: ja });
  const inspectionTime = ''; // 時間情報があれば使用

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
      const response = await api.get<{ inspection: TemplateSettings['inspection'] }>('/api/document-templates');
      setTemplateSettings({ inspection: response.data.inspection });
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
      // デフォルト値を使用
      setTemplateSettings({
        inspection: {
          recipient: '長沼町長　齋　藤　良　彦　様',
          title: '復命書',
          namePrefix: '〇〇課　地域おこし協力隊',
          text1: '次の通り復命します。',
          item1: '（参考: 視察日時を記入してください）',
          item2: '（参考: 視察先の場所を記入してください）',
          item3: '（参考: 視察の用務内容を記入してください）',
          item4: '（参考: 視察の目的を記入してください）',
          item5: '（参考: 視察の内容を記入してください）',
          item6: '（参考: 処理の経過や結果を記入してください）',
          item7: '（参考: 所感や今後の予定を記入してください）',
          item8: '（参考: その他の報告事項があれば記入してください）',
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

  // テンプレート設定から値を取得
  const recipient = templateSettings?.inspection.recipient || '長沼町長　齋　藤　良　彦　様';
  const title = templateSettings?.inspection.title || '復命書';
  const namePrefix = templateSettings?.inspection.namePrefix || '〇〇課　地域おこし協力隊';
  const userName = `${namePrefix}　${inspection.user.name}`;
  const text1 = templateSettings?.inspection.text1 || '次の通り復命します。';

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
        {title}
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
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          1. 日時
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspectionDate}{inspectionTime ? ` ${inspectionTime}` : ''}
          {!inspection.inspectionPurpose && templateSettings?.inspection.item1 && `\n${templateSettings.inspection.item1}`}
        </div>
      </div>

      {/* 2. 場所 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          2. 場所
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.destination || templateSettings?.inspection.item2 || '（参考: 視察先の場所を記入してください）'}
        </div>
      </div>

      {/* 3. 用務 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          3. 用務
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.purpose || templateSettings?.inspection.item3 || '（参考: 視察の用務内容を記入してください）'}
        </div>
      </div>

      {/* 4. 目的 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          4. 目的
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.inspectionPurpose) || templateSettings?.inspection.item4 || '（参考: 視察の目的を記入してください）'}
        </div>
      </div>

      {/* 5. 内容 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          5. 内容
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.inspectionContent) || templateSettings?.inspection.item5 || '（参考: 視察の内容を記入してください）'}
        </div>
      </div>

      {/* 6. 処理てん末 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          6. 処理てん末
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.reflection) || templateSettings?.inspection.item6 || '（参考: 処理の経過や結果を記入してください）'}
        </div>
      </div>

      {/* 7. 所感・今後 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          7. 所感・今後
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {stripHtml(inspection.futureAction) || templateSettings?.inspection.item7 || '（参考: 所感や今後の予定を記入してください）'}
        </div>
      </div>

      {/* 8. その他報告 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          fontWeight: 'bold', 
          backgroundColor: isDarkMode ? '#374151' : '#f0f0f0',
          color: isDarkMode ? '#f3f4f6' : '#000000',
          padding: '8px',
          marginBottom: '10px'
        }}>
          8. その他報告
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
          {inspection.participants.length > 0 
            ? `参加者: ${inspection.user.name}、${inspection.participants.join('、')}`
            : templateSettings?.inspection.item8 || '（参考: その他の報告事項があれば記入してください）'}
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


