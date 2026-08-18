import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { InspectionAttachmentImage } from './InspectionAttachmentImage';

/** 全角スペース（テンプレート内の字間調整に使用）。テンプレートリテラル/JSXテキストへ直接埋め込むとlintのno-irregular-whitespaceに触れるため変数経由で使う */
const IDEOGRAPHIC_SPACE = '　';

interface InspectionAttachment {
  id: string;
  fileName: string;
  mimeType: string;
}

interface Inspection {
  id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  destination: string;
  purpose: string;
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  participants: string[];
  user: { id: string; name: string; department?: string | null; missionType?: 'FREE' | 'MISSION' | null };
  project?: { id: string; projectName: string };
  attachments?: InspectionAttachment[];
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

/** 西暦の日付を和暦（令和）表記に変換する（復命書は公文書のため和暦で表記する） */
function toReiwaDateLabel(date: Date, withWeekday = false): string {
  const reiwaYear = date.getFullYear() - 2018; // 2019年 = 令和元年
  const yearLabel = reiwaYear === 1 ? '元' : String(reiwaYear);
  const base = `令和${yearLabel}年${date.getMonth() + 1}月${date.getDate()}日`;
  if (!withWeekday) return base;
  return `${base}（${format(date, 'E', { locale: ja })}）`;
}

export const InspectionPreview: React.FC<InspectionPreviewProps> = ({ inspection }) => {
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const now = new Date();
  const inspectionDate = new Date(inspection.date);

  useEffect(() => {
    fetchTemplateSettings();
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
          text1: 'このたび、出張を命ぜられましたので、次のとおり復命します。',
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
  const titleSpaced = Array.from(title).join('　');
  // ユーザーのdepartmentを使用、なければテンプレート設定のnamePrefixを使用
  const department = inspection.user.department || '';
  const namePrefixTemplate = templateSettings?.inspection.namePrefix || '〇〇課　地域おこし協力隊';
  const namePrefix = department ? `${department}${IDEOGRAPHIC_SPACE}地域おこし協力隊` : namePrefixTemplate;
  const text1 = templateSettings?.inspection.text1 || 'このたび、出張を命ぜられましたので、次のとおり復命します。';

  const timeRange = inspection.startTime && inspection.endTime
    ? `${IDEOGRAPHIC_SPACE}${inspection.startTime}〜${inspection.endTime}`
    : inspection.startTime
    ? `${IDEOGRAPHIC_SPACE}${inspection.startTime}〜`
    : '';

  const participantsNote = inspection.participants.length > 0
    ? `（参加者：${inspection.user.name}、${inspection.participants.join('、')}）`
    : '';

  const item4Text = (() => {
    const paragraphs = [inspection.inspectionPurpose, inspection.inspectionContent, inspection.reflection]
      .map((v) => stripHtml(v || '').trim())
      .filter(Boolean);
    if (paragraphs.length > 0) return paragraphs.join('\n');
    return templateSettings?.inspection.item6 || '（参考: 処理の経過や結果を記入してください）';
  })();

  const item5Text = stripHtml(inspection.futureAction || '').trim()
    || templateSettings?.inspection.item7
    || '（参考: 所感や今後の予定を記入してください）';

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
      {/* タイトル */}
      <h1 style={{
        textAlign: 'center',
        fontSize: '20pt',
        fontWeight: 'bold',
        marginBottom: '24px',
        letterSpacing: '4px',
        color: '#1F2937'
      }}>
        {titleSpaced}
      </h1>

      {/* 日付 */}
      <div style={{ textAlign: 'right', marginBottom: '24px' }}>
        {toReiwaDateLabel(now)}
      </div>

      {/* 宛先 */}
      <div style={{ marginBottom: '20px' }}>
        {recipient}
      </div>

      {/* 発信者（部署・氏名・印） */}
      <div style={{ textAlign: 'right', marginBottom: '24px' }}>
        <div>{namePrefix}</div>
        <div>{inspection.user.name}{'　'}㊞</div>
      </div>

      {/* テキスト1 */}
      <div style={{ marginBottom: '20px' }}>
        {text1}
      </div>

      {/* 記（中央揃え） */}
      <div style={{
        textAlign: 'center',
        margin: '24px 0',
        fontSize: '14pt',
        fontWeight: 'bold'
      }}>
        記
      </div>

      {/* 1 日時 */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
          1{IDEOGRAPHIC_SPACE}日時
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap' }}>
          {toReiwaDateLabel(inspectionDate, true)}{timeRange}
        </div>
      </div>

      {/* 2 場所 */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
          2{IDEOGRAPHIC_SPACE}場所
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap' }}>
          {inspection.destination || templateSettings?.inspection.item2 || '（参考: 視察先の場所を記入してください）'}
        </div>
      </div>

      {/* 3 用務 */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
          3{IDEOGRAPHIC_SPACE}用務
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap' }}>
          {(inspection.purpose || templateSettings?.inspection.item3 || '（参考: 視察の用務内容を記入してください）')}
          {participantsNote}
        </div>
      </div>

      {/* 4 処理てん末 */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
          4{IDEOGRAPHIC_SPACE}処理てん末
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap' }}>
          {item4Text}
        </div>
      </div>

      {/* 5 今後の処理 */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
          5{IDEOGRAPHIC_SPACE}今後の処理
        </div>
        <div style={{ marginLeft: '15px', whiteSpace: 'pre-wrap' }}>
          {item5Text}
        </div>
      </div>

      {/* 添付資料 */}
      {inspection.attachments && inspection.attachments.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#1F2937', padding: '8px', marginBottom: '10px' }}>
            添付資料
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginLeft: '15px' }}>
            {inspection.attachments.map((a) => (
              <InspectionAttachmentImage
                key={a.id}
                inspectionId={inspection.id}
                attachmentId={a.id}
                alt={a.fileName}
                style={{ width: '220px', height: '220px', border: '1px solid #ccc', objectFit: 'contain' }}
              />
            ))}
          </div>
        </div>
      )}

      {/* フッター */}
      <div style={{ marginTop: '40px', textAlign: 'right' }}>
        以上
      </div>
    </div>
  );
};
