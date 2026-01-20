import puppeteer from 'puppeteer';
import prisma from '../lib/prisma';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * HTML文字列からPDFを生成
 */
async function generatePDFFromHTML(html: string): Promise<Buffer> {
  let browser;
  try {
    console.log('Starting PDF generation...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      timeout: 60000,
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();
    
    // ページのエラーをキャッチ
    page.on('error', (error) => {
      console.error('Page error:', error);
    });

    page.on('pageerror', (error) => {
      console.error('Page error:', error);
    });

    // 日本語フォント対応のための設定
    console.log('Setting page content...');
    await page.setContent(html, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });

    console.log('Page content set, waiting for fonts...');

    // フォント読み込みを待つ（ブラウザコンテキスト内で実行）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => {
      // @ts-ignore - document is available in browser context
      return document.fonts.ready;
    });

    console.log('Fonts loaded, generating PDF...');

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 60000,
    });

    console.log('PDF generated successfully, size:', pdf.length);

    return Buffer.from(pdf);
  } catch (error) {
    console.error('PDF generation error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw new Error(`PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (err) {
        console.error('Browser close error:', err);
      }
    }
  }
}

/**
 * 協力隊催促PDF生成
 */
export async function generateNudgePDF(): Promise<Buffer> {
  const document = await prisma.nudgeDocument.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      updater: true,
    },
  });

  if (!document) {
    throw new Error('Nudge document not found');
  }

  // HTMLコンテンツからHTMLタグを除去し、改行を保持
  const cleanContent = document.content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n/g, '<br>');

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Noto Sans CJK JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', 'MS Gothic', sans-serif;
          font-size: 12pt;
          line-height: 1.8;
          color: #000;
          background: #fff;
        }
        
        h1 {
          text-align: center;
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 30px;
          page-break-after: avoid;
        }
        
        .header {
          margin-bottom: 30px;
          text-align: right;
          font-size: 11pt;
        }
        
        .content {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          line-height: 1.8;
        }
        
        .content br {
          line-height: 1.8;
        }
        
        .footer {
          margin-top: 60px;
          text-align: right;
          font-size: 11pt;
        }
        
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>${format(new Date(), 'yyyy年MM月dd日')}</div>
      </div>
      <h1>${document.title}</h1>
      <div class="content">${cleanContent}</div>
      <div class="footer">
        <div>${document.updater.name}</div>
      </div>
    </body>
    </html>
  `;

    console.log('Monthly report HTML generated, calling generatePDFFromHTML...');
    return await generatePDFFromHTML(html);
  } catch (error) {
    console.error('Error in generateMonthlyReportPDF:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * 視察復命書PDF生成
 */
export async function generateInspectionPDF(inspectionId: string): Promise<Buffer> {
  try {
    console.log('Generating inspection PDF for ID:', inspectionId);
    
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        user: true,
        project: true,
      },
    });

    if (!inspection) {
      throw new Error('Inspection not found');
    }

    // Ensure user.name is available
    if (!inspection.user || !inspection.user.name) {
      throw new Error('Inspection user information is missing for PDF generation.');
    }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'MS Gothic', monospace; font-size: 12pt; margin: 40px; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 30px; }
        .section { margin: 25px 0; page-break-inside: avoid; }
        .label { font-weight: bold; margin-bottom: 8px; background-color: #f0f0f0; padding: 5px; }
        .content { margin-left: 15px; white-space: pre-wrap; line-height: 1.8; }
        .info { margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>視察復命書</h1>

      <div class="info">
        <strong>視察日:</strong> ${format(new Date(inspection.date), 'yyyy年MM月dd日(E)', { locale: ja })}
      </div>

      <div class="info">
        <strong>視察先:</strong> ${inspection.destination}
      </div>

      <div class="info">
        <strong>参加者:</strong> ${inspection.user.name}${Array.isArray(inspection.participants) && inspection.participants.length > 0 ? '、' + inspection.participants.join('、') : ''}
      </div>

      ${inspection.project ? `
      <div class="info">
        <strong>関連プロジェクト:</strong> ${inspection.project.projectName}
      </div>
      ` : ''}

      <div class="section">
        <div class="label">1. 視察目的</div>
        <div class="content">${(inspection.inspectionPurpose || '').replace(/<[^>]*>/g, '').replace(/\n/g, '<br>')}</div>
      </div>

      <div class="section">
        <div class="label">2. 視察内容</div>
        <div class="content">${(inspection.inspectionContent || '').replace(/<[^>]*>/g, '').replace(/\n/g, '<br>')}</div>
      </div>

      <div class="section">
        <div class="label">3. 所感</div>
        <div class="content">${(inspection.reflection || '').replace(/<[^>]*>/g, '').replace(/\n/g, '<br>')}</div>
      </div>

      <div class="section">
        <div class="label">4. 今後のアクション</div>
        <div class="content">${(inspection.futureAction || '').replace(/<[^>]*>/g, '').replace(/\n/g, '<br>')}</div>
      </div>

      <div style="margin-top: 60px; text-align: right;">
        <div>${format(new Date(), 'yyyy年MM月dd日')}</div>
        <div style="margin-top: 10px;">${inspection.user.name}</div>
      </div>
    </body>
    </html>
  `;

    console.log('Inspection HTML generated, calling generatePDFFromHTML...');
    return await generatePDFFromHTML(html);
  } catch (error) {
    console.error('Error in generateInspectionPDF:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * 週次報告PDF生成
 */
export async function generateWeeklyReportPDF(userId: string, week: string): Promise<Buffer> {
  try {
    console.log('Generating weekly report PDF for userId:', userId, 'week:', week);
    
    const report = await prisma.weeklyReport.findUnique({
      where: {
        userId_week: {
          userId,
          week,
        }
      },
      include: { user: true },
    });

    if (!report) {
      throw new Error('Weekly report not found');
    }

    if (!report.user || !report.user.name) {
      throw new Error('Weekly report user information is missing for PDF generation.');
    }

  const activities = report.thisWeekActivities as Array<{
    date: string;
    activity: string;
  }>;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'MS Gothic', monospace; font-size: 12pt; margin: 40px; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 30px; }
        .section { margin: 25px 0; }
        .label { font-weight: bold; background-color: #f0f0f0; padding: 5px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td, th { border: 1px solid #000; padding: 8px; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .content { white-space: pre-wrap; line-height: 1.8; margin-left: 15px; }
      </style>
    </head>
    <body>
      <h1>週次報告書</h1>

      <div style="margin-bottom: 30px;">
        <div><strong>報告者:</strong> ${report.user.name}</div>
        <div><strong>対象週:</strong> ${report.week}</div>
        <div><strong>提出日:</strong> ${report.submittedAt ? format(new Date(report.submittedAt), 'yyyy年MM月dd日') : '未提出'}</div>
      </div>

      <div class="section">
        <div class="label">今週の活動内容</div>
        ${activities && activities.length > 0 ? `
        <table>
          <tr>
            <th style="width: 30%;">日時</th>
            <th>活動内容</th>
          </tr>
          ${activities.map(activity => `
            <tr>
              <td>${activity.date || ''}</td>
              <td>${activity.activity || ''}</td>
            </tr>
          `).join('')}
        </table>
        ` : '<p>活動内容がありません</p>'}
      </div>

      ${report.nextWeekPlan ? `
      <div class="section">
        <div class="label">来週の予定</div>
        <div class="content">${report.nextWeekPlan}</div>
      </div>
      ` : ''}

      ${report.note ? `
      <div class="section">
        <div class="label">備考</div>
        <div class="content">${report.note}</div>
      </div>
      ` : ''}
    </body>
    </html>
  `;

    console.log('Weekly report HTML generated, calling generatePDFFromHTML...');
    return await generatePDFFromHTML(html);
  } catch (error) {
    console.error('Error in generateWeeklyReportPDF:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * 月次報告PDF生成（簡易版）
 */
export async function generateMonthlyReportPDF(reportId: string): Promise<Buffer> {
  try {
    console.log('Generating monthly report PDF for ID:', reportId);
    
    const report = await prisma.monthlyReport.findUnique({
      where: { id: reportId },
      include: {
        creator: true,
        supportRecords: {
          include: { user: true },
          orderBy: { supportDate: 'asc' },
        },
      },
    });

    if (!report) {
      throw new Error('Monthly report not found');
    }

    if (!report.creator || !report.creator.name) {
      throw new Error('Monthly report creator information is missing for PDF generation.');
    }

  // サポート記録をユーザーごとにグループ化
  const groupedRecords: { [userId: string]: any[] } = {};
  report.supportRecords.forEach((record) => {
    if (!groupedRecords[record.userId]) {
      groupedRecords[record.userId] = [];
    }
    groupedRecords[record.userId].push(record);
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'MS Gothic', monospace; font-size: 11pt; margin: 30px; }
        h1 { text-align: center; font-size: 16pt; }
        h2 { font-size: 14pt; margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 5px; }
        .section { margin: 20px 0; page-break-inside: avoid; }
        .user-section { margin: 15px 0; }
        .record { margin-left: 20px; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin: 50px 0;">
        <div style="margin: 20px 0;">${format(new Date(), 'yyyy年M月d日')}</div>
        <div style="margin: 20px 0;">${report.coverRecipient || '長沼町長 斎藤良彦様'}</div>
        <div style="margin: 40px 0; text-align: right; padding-right: 50px;">
          ${(report.coverSender || '一般社団法人まおいのはこ 代表理事 坂本一志').split('\n').map(line => `<div>${line}</div>`).join('')}
        </div>
        <h1>長沼町地域おこし協力隊サポート業務月次報告（${report.month}）</h1>
      </div>

      ${Object.keys(groupedRecords).length > 0 ? `
      <div style="page-break-before: always;">
        <h2>一般社団法人まおいのはこの支援内容（${report.month}）</h2>
        ${Object.entries(groupedRecords).map(([userId, records]) => `
          <div class="user-section">
            <strong>【${records[0].user.name}】</strong>
            ${records.map(record => `
              <div class="record">
                ・${format(new Date(record.supportDate), 'M/d')} ${(record.supportContent || '').replace(/<[^>]*>/g, '').replace(/\n/g, ' ')}（${record.supportBy}）
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </body>
    </html>
  `;

    console.log('Monthly report HTML generated, calling generatePDFFromHTML...');
    return await generatePDFFromHTML(html);
  } catch (error) {
    console.error('Error in generateMonthlyReportPDF:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}
