import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import prisma from '../lib/prisma';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/** Puppeteer 用: ネットワーク不要で日本語表示（@fontsource/noto-sans-jp の japanese サブセットを base64 埋め込み） */
let cachedEmbeddedNotoStyle: string | null = null;

function getEmbeddedNotoSansJpStyle(): string {
  if (cachedEmbeddedNotoStyle) return cachedEmbeddedNotoStyle;
  try {
    const dir = path.join(process.cwd(), 'node_modules/@fontsource/noto-sans-jp/files');
    const p400 = path.join(dir, 'noto-sans-jp-japanese-400-normal.woff2');
    const p700 = path.join(dir, 'noto-sans-jp-japanese-700-normal.woff2');
    const b64 = (p: string) => fs.readFileSync(p).toString('base64');
    cachedEmbeddedNotoStyle = `<style>
@font-face{font-family:'Noto Sans JP';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${b64(p400)}) format('woff2');}
@font-face{font-family:'Noto Sans JP';font-style:normal;font-weight:700;font-display:swap;src:url(data:font/woff2;base64,${b64(p700)}) format('woff2');}
</style>`;
  } catch (e) {
    console.warn('Noto Sans JP embed failed:', e);
    cachedEmbeddedNotoStyle =
      '<style>body{font-family:system-ui,sans-serif;}</style>';
  }
  return cachedEmbeddedNotoStyle;
}

function escapeHtmlForPdf(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPlainTextForPdf(value?: string | null): string {
  return escapeHtmlForPdf(value || '').replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
}

function renderRichTextForPdf(value?: string | null): string {
  return (value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function stripHtmlForPdf(value?: string | null): string {
  return (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * HTML文字列からPDFを生成
 */
async function resolveChromeExecutable(): Promise<string | undefined> {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;
  try {
    if (typeof puppeteer.executablePath === 'function') {
      const p = puppeteer.executablePath();
      if (p && typeof p === 'string') return p;
    }
  } catch (e) {
    console.warn('puppeteer.executablePath() failed:', e);
  }
  return undefined;
}

async function generatePDFFromHTML(html: string): Promise<Buffer> {
  let browser;
  try {
    const executablePath = await resolveChromeExecutable();
    console.log(
      'Starting PDF generation...',
      executablePath ? `executablePath=${executablePath}` : 'no executablePath (launch may download/fail)',
    );

    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--font-render-hinting=none',
      ],
      timeout: 90000,
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
    // networkidle0 は外部フォント待ちで Render 等でタイムアウトしやすいため domcontentloaded を使用
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    try {
      await page.evaluate('document.fonts.ready');
    } catch {
      /* フォント待ち失敗時も PDF は生成を試行 */
    }

    console.log('Page content set, generating PDF...');

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
      timeout: 90000,
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
export async function generateNudgePDF(fiscalYear?: number): Promise<Buffer> {
  let document;
  
  if (fiscalYear) {
    document = await prisma.nudgeDocument.findUnique({
      where: { fiscalYear },
      include: {
        updater: true,
      },
    });
  } else {
    document = await prisma.nudgeDocument.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        updater: true,
      },
    });
  }

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
      ${getEmbeddedNotoSansJpStyle()}
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
          font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', 'MS Gothic', sans-serif;
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

  return await generatePDFFromHTML(html);
}

/**
 * 復命書PDF生成
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

  const plain = (htmlish: string) =>
    escapeHtmlForPdf((htmlish || '').replace(/<[^>]*>/g, '').replace(/\r\n/g, '\n')).replace(/\n/g, '<br/>');

  const participantsExtra =
    Array.isArray(inspection.participants) && inspection.participants.length > 0
      ? '、' + inspection.participants.map((p) => escapeHtmlForPdf(String(p))).join('、')
      : '';

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      ${getEmbeddedNotoSansJpStyle()}
      <style>
        body { font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; font-size: 12pt; margin: 40px; color: #111; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 30px; font-weight: 700; }
        .section { margin: 25px 0; page-break-inside: avoid; }
        .label { font-weight: bold; margin-bottom: 8px; background-color: #f0f0f0; padding: 5px; }
        .content { margin-left: 15px; white-space: pre-wrap; line-height: 1.8; }
        .info { margin: 10px 0; }
      </style>
    </head>
    <body>
      <h1>復命書</h1>

      <div class="info">
        <strong>日付:</strong> ${escapeHtmlForPdf(format(new Date(inspection.date), 'yyyy年MM月dd日(E)', { locale: ja }))}
      </div>

      <div class="info">
        <strong>視察先:</strong> ${escapeHtmlForPdf(inspection.destination)}
      </div>

      <div class="info">
        <strong>参加者:</strong> ${escapeHtmlForPdf(inspection.user.name)}${participantsExtra}
      </div>

      ${inspection.project ? `
      <div class="info">
        <strong>関連プロジェクト:</strong> ${escapeHtmlForPdf(inspection.project.projectName)}
      </div>
      ` : ''}

      <div class="section">
        <div class="label">1. 視察目的</div>
        <div class="content">${plain(inspection.inspectionPurpose || '')}</div>
      </div>

      <div class="section">
        <div class="label">2. 視察内容</div>
        <div class="content">${plain(inspection.inspectionContent || '')}</div>
      </div>

      <div class="section">
        <div class="label">3. 所感</div>
        <div class="content">${plain(inspection.reflection || '')}</div>
      </div>

      <div class="section">
        <div class="label">4. 今後のアクション</div>
        <div class="content">${plain(inspection.futureAction || '')}</div>
      </div>

      <div style="margin-top: 60px; text-align: right;">
        <div>${escapeHtmlForPdf(format(new Date(), 'yyyy年MM月dd日'))}</div>
        <div style="margin-top: 10px;">${escapeHtmlForPdf(inspection.user.name)}</div>
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

  const template = await prisma.documentTemplate.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  const weeklyTemplate = {
    recipient: template?.weeklyReportRecipient || '○○市役所　○○課長　様',
    title: template?.weeklyReportTitle || '地域おこし協力隊活動報告',
    activityLabel: template?.weeklyReportActivityLabel || '活動内容',
    nextPlanLabel: template?.weeklyReportNextPlanLabel || '来週の予定',
    reflectionLabel: template?.weeklyReportReflectionLabel || '振り返り・所感',
    noteLabel: template?.weeklyReportNoteLabel || '備考',
  };

  const activities = report.thisWeekActivities as Array<{
    date: string;
    activity: string;
    projectName?: string;
  }>;
  const groupedActivities = activities.reduce<Array<{ projectName: string; items: typeof activities }>>((groups, activity) => {
    const projectName = activity.projectName?.trim() || '未紐づけ';
    const group = groups.find((item) => item.projectName === projectName);
    if (group) {
      group.items.push(activity);
    } else {
      groups.push({ projectName, items: [activity] });
    }
    return groups;
  }, []).map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
  }));

  const weekStart = (() => {
    const match = report.week.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const firstIsoMonday = new Date(jan4);
    firstIsoMonday.setDate(jan4.getDate() - jan4Day + 1);
    const result = new Date(firstIsoMonday);
    result.setDate(firstIsoMonday.getDate() + (weekNum - 1) * 7);
    return result;
  })();
  const weekLabel = weekStart
    ? `${format(weekStart, 'yyyy年M月d日(E)', { locale: ja })}週`
    : report.week;

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      ${getEmbeddedNotoSansJpStyle()}
      <style>
        body { font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; font-size: 12pt; margin: 40px; color: #111; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 30px; }
        .section { margin: 25px 0; }
        .label { font-weight: bold; background-color: #f0f0f0; padding: 5px; margin-bottom: 10px; }
        .project-group { margin: 14px 0 18px; page-break-inside: avoid; }
        .project-title { font-weight: bold; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td, th { border: 1px solid #000; padding: 8px; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .content { white-space: pre-wrap; line-height: 1.8; margin-left: 15px; }
      </style>
    </head>
    <body>
      <div style="text-align: right; margin-bottom: 24px;">${escapeHtmlForPdf(format(new Date(), 'yyyy年MM月dd日'))}</div>
      <div style="margin-bottom: 24px;">${renderPlainTextForPdf(weeklyTemplate.recipient)}</div>
      <h1>${escapeHtmlForPdf(weeklyTemplate.title)}</h1>

      <div style="margin-bottom: 30px;">
        <div><strong>報告者:</strong> ${escapeHtmlForPdf(report.user.name)}</div>
        <div><strong>対象週:</strong> ${escapeHtmlForPdf(report.week)}（${escapeHtmlForPdf(weekLabel)}）</div>
        <div><strong>提出日:</strong> ${report.submittedAt ? escapeHtmlForPdf(format(new Date(report.submittedAt), 'yyyy年MM月dd日')) : '未提出'}</div>
      </div>

      <div class="section">
        <div class="label">1. ${escapeHtmlForPdf(weeklyTemplate.activityLabel)}</div>
        ${groupedActivities.length > 0 ? groupedActivities.map((group) => `
        <div class="project-group">
          <div class="project-title">${escapeHtmlForPdf(group.projectName)}</div>
          <table>
            <tr>
              <th style="width: 30%;">日時</th>
              <th>活動内容</th>
            </tr>
            ${group.items.map(activity => `
              <tr>
                <td>${escapeHtmlForPdf(activity.date || '')}</td>
                <td>${escapeHtmlForPdf(activity.activity || '')}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        `).join('') : '<p>活動内容がありません</p>'}
      </div>

      ${report.nextWeekPlan ? `
      <div class="section">
        <div class="label">2. ${escapeHtmlForPdf(weeklyTemplate.nextPlanLabel)}</div>
        <div class="content">${renderPlainTextForPdf(report.nextWeekPlan)}</div>
      </div>
      ` : ''}

      ${report.reflection ? `
      <div class="section">
        <div class="label">3. ${escapeHtmlForPdf(weeklyTemplate.reflectionLabel)}</div>
        <div class="content">${renderPlainTextForPdf(report.reflection)}</div>
      </div>
      ` : ''}

      ${report.note ? `
      <div class="section">
        <div class="label">4. ${escapeHtmlForPdf(weeklyTemplate.noteLabel)}</div>
        <div class="content">${renderRichTextForPdf(report.note)}</div>
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
 * 月次報告PDF生成
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

    const template = await prisma.documentTemplate.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    const monthDate = new Date(`${report.month}-01`);
    const monthLabel = format(monthDate, 'yyyy年M月', { locale: ja });
    const reportDate = report.submittedAt
      ? format(new Date(report.submittedAt), 'yyyy年M月d日', { locale: ja })
      : format(new Date(), 'yyyy年M月d日', { locale: ja });
    const reiwaYear = monthDate.getFullYear() - 2018;
    const monthNum = monthDate.getMonth() + 1;
    const dayNum = new Date().getDate();
    const memberSheets = Array.isArray(report.memberSheets) ? report.memberSheets as any[] : [];

    const titleTemplate = template?.monthlyReportTitle || '長沼町地域おこし協力隊サポート業務月次報告（{month}）';
    const title = titleTemplate.includes('{month}')
      ? titleTemplate.replace('{month}', monthLabel)
      : `${titleTemplate}（${monthLabel}）`;
    const text1 = template?.monthlyReportText1 || '表記業務の結果について別紙のとおり報告いたします。';
    const text2 = (template?.monthlyReportText2 || '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表')
      .replace('{count}', String(memberSheets.length))
      .replace('◯名分', `${memberSheets.length}名分`);
    const contact = template?.monthlyReportContact || '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org';

    const renderActivityItems = (items: unknown) => {
      if (!Array.isArray(items) || items.length === 0) {
        return '<p class="empty">活動内容がありません</p>';
      }
      return `<ul>${items.map((item) => {
        if (typeof item === 'string') {
          return `<li>${renderPlainTextForPdf(stripHtmlForPdf(item))}</li>`;
        }
        const row = item as { date?: string; description?: string; activity?: string };
        const date = row.date ? `${row.date}: ` : '';
        const body = stripHtmlForPdf(row.description || row.activity || '');
        return `<li>${renderPlainTextForPdf(`${date}${body}`)}</li>`;
      }).join('')}</ul>`;
    };

    const renderTextSection = (value?: string | null) => {
      const text = stripHtmlForPdf(value);
      return text ? renderPlainTextForPdf(text) : '（未記入）';
    };

    const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      ${getEmbeddedNotoSansJpStyle()}
      <style>
        @page { size: A4; margin: 20mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Noto Sans JP', 'Yu Mincho', 'Hiragino Mincho ProN', 'Meiryo', serif;
          font-size: 11pt;
          line-height: 1.8;
          color: #111;
          background: #fff;
        }
        .page { min-height: 257mm; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .right { text-align: right; }
        h1 { text-align: center; font-size: 17pt; margin: 36px 0; font-weight: 700; }
        h2 { text-align: center; font-size: 15pt; margin: 0 0 28px; font-weight: 700; }
        .cover-date { text-align: right; margin-bottom: 28px; }
        .recipient { margin-bottom: 22px; white-space: pre-wrap; }
        .sender { text-align: right; margin: 24px 0 38px; }
        .content-block { white-space: pre-wrap; margin-bottom: 24px; }
        .center-marker { text-align: center; font-size: 14pt; font-weight: 700; margin: 30px 0; }
        .end-marker { text-align: right; font-size: 13pt; font-weight: 700; margin: 32px 0 48px; }
        .contact { margin-top: 56px; white-space: pre-wrap; }
        .sheet-header { text-align: right; margin-bottom: 28px; }
        .member-name { font-size: 13pt; font-weight: 700; margin-bottom: 6px; }
        .section { margin: 22px 0; page-break-inside: avoid; }
        .label { background: #f0f0f0; padding: 7px 9px; font-weight: 700; margin-bottom: 10px; }
        ul { margin: 6px 0 0 20px; padding: 0; }
        li { margin-bottom: 4px; }
        .body-text { margin-left: 14px; white-space: pre-wrap; }
        .support-record { margin-bottom: 18px; page-break-inside: avoid; }
        .support-user { font-weight: 700; font-size: 12.5pt; margin-bottom: 5px; }
        .empty { color: #666; font-style: italic; margin-left: 14px; }
      </style>
    </head>
    <body>
      <section class="page">
        <div class="cover-date">${escapeHtmlForPdf(reportDate)}</div>
        <div class="recipient">${renderPlainTextForPdf(report.coverRecipient)}</div>
        <div class="sender">${renderRichTextForPdf(report.coverSender)}</div>
        <h1>${escapeHtmlForPdf(title)}</h1>
        <div class="content-block">${renderPlainTextForPdf(text1)}</div>
        <div class="center-marker">記</div>
        <div class="content-block">${renderPlainTextForPdf(text2)}</div>
        <div class="end-marker">以上</div>
        <div class="contact">${renderPlainTextForPdf(contact)}</div>
      </section>

      ${memberSheets.map((sheet, index) => `
        <section class="page">
          <div class="sheet-header">協力隊活動ヒアリングシート</div>
          <div style="margin-bottom: 28px;">
            <div class="member-name">氏名　${escapeHtmlForPdf(sheet.userName || `隊員${index + 1}`)}　${escapeHtmlForPdf(monthLabel)}分</div>
            <div>令和${escapeHtmlForPdf(String(reiwaYear))}年　${escapeHtmlForPdf(String(monthNum))}月　${escapeHtmlForPdf(String(dayNum))}日</div>
          </div>

          <div class="section">
            <div class="label">【今月の主な活動内容】</div>
            ${renderActivityItems(sheet.thisMonthActivities)}
          </div>

          <div class="section">
            <div class="label">【翌月以降の活動予定】</div>
            <div class="body-text">${renderTextSection(sheet.nextMonthPlan)}</div>
          </div>

          <div class="section">
            <div class="label">【振り返り・所感】</div>
            <div class="body-text">${renderTextSection(sheet.reflectionNotes)}</div>
          </div>

          <div class="section">
            <div class="label">【勤務に関する質問など】</div>
            <div class="body-text">${renderTextSection(sheet.workQuestions)}</div>
          </div>

          <div class="section">
            <div class="label">【生活面の留意事項その他】</div>
            <div class="body-text">${renderTextSection(sheet.lifeNotes)}</div>
          </div>
        </section>
      `).join('')}

      <section class="page">
        <div class="right" style="margin-bottom: 28px;">${escapeHtmlForPdf(format(new Date(), 'yyyy年M月d日'))}</div>
        <h2>一般社団法人まおいのはこの支援内容（${escapeHtmlForPdf(monthLabel)}）</h2>
        <div>
          ${report.supportRecords.length > 0 ? report.supportRecords.map((record) => `
            <div class="support-record">
              <div class="support-user">【${escapeHtmlForPdf(record.user.name)}】</div>
              <ul>
                <li>
                  ${escapeHtmlForPdf(format(new Date(record.supportDate), 'yyyy年M月d日', { locale: ja }))}: ${renderPlainTextForPdf(stripHtmlForPdf(record.supportContent))}
                  ${record.supportBy ? `（支援者: ${escapeHtmlForPdf(record.supportBy)}）` : ''}
                </li>
              </ul>
            </div>
          `).join('') : '<p class="empty">支援記録がありません</p>'}
        </div>
      </section>
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
