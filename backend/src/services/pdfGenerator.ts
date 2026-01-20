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
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close().catch(err => console.error('Browser close error:', err));
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'MS Gothic', monospace; font-size: 12pt; margin: 40px; line-height: 1.8; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 30px; }
        .header { margin-bottom: 30px; text-align: right; }
        .content { white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>${format(new Date(), 'yyyy年MM月dd日')}</div>
      </div>
      <h1>${document.title}</h1>
      <div class="content">${document.content.replace(/<[^>]*>/g, '').replace(/\n/g, '<br>')}</div>
      <div style="margin-top: 60px; text-align: right;">
        <div>${document.updater.name}</div>
      </div>
    </body>
    </html>
  `;

  return await generatePDFFromHTML(html);
}

/**
 * 視察復命書PDF生成
 */
export async function generateInspectionPDF(inspectionId: string): Promise<Buffer> {
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

  return await generatePDFFromHTML(html);
}

/**
 * 週次報告PDF生成
 */
export async function generateWeeklyReportPDF(userId: string, week: string): Promise<Buffer> {
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

  return await generatePDFFromHTML(html);
}

/**
 * 月次報告PDF生成（簡易版）
 */
export async function generateMonthlyReportPDF(reportId: string): Promise<Buffer> {
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

  return await generatePDFFromHTML(html);
}
