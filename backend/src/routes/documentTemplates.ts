import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// テンプレート設定初期化（デフォルト値を保存）
router.post('/init', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    let existing = null;
    try {
      existing = await prisma.documentTemplate.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      // テーブルが存在しない場合はエラーを返す
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        return res.status(500).json({ 
          error: 'DocumentTemplateテーブルが存在しません。マイグレーションを実行してください。' 
        });
      }
      throw error;
    }

    if (existing) {
      return res.json({ message: 'テンプレート設定は既に存在します' });
    }

    const template = await prisma.documentTemplate.create({
      data: {
        templateType: 'weekly_report',
        weeklyReportRecipient: '○○市役所　○○課長　様',
        weeklyReportTitle: '地域おこし協力隊活動報告',
        monthlyReportRecipient: '長沼町長　齋　藤　良　彦　様',
        monthlyReportSender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
        monthlyReportTitle: '長沼町地域おこし協力隊サポート業務月次報告',
        monthlyReportText1: '表記業務の結果について別紙のとおり報告いたします。',
        monthlyReportText2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
        monthlyReportContact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
        inspectionRecipient: '長沼町長　齋　藤　良　彦　様',
        inspectionTitle: '復命書',
        inspectionNamePrefix: '〇〇課　地域おこし協力隊',
        inspectionText1: '次の通り復命します。',
        inspectionItem1: '（参考: 視察日時を記入してください）',
        inspectionItem2: '（参考: 視察先の場所を記入してください）',
        inspectionItem3: '（参考: 視察の用務内容を記入してください）',
        inspectionItem4: '（参考: 視察の目的を記入してください）',
        inspectionItem5: '（参考: 視察の内容を記入してください）',
        inspectionItem6: '（参考: 処理の経過や結果を記入してください）',
        inspectionItem7: '（参考: 所感や今後の予定を記入してください）',
        inspectionItem8: '（参考: その他の報告事項があれば記入してください）',
        updatedBy: req.user!.id,
      },
    });

    res.json(template);
  } catch (error) {
    console.error('Init document templates error:', error);
    res.status(500).json({ error: 'Failed to initialize document templates' });
  }
});

// テンプレート設定取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    let templates = [];
    try {
      templates = await prisma.documentTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      // テーブルが存在しない場合はデフォルト値を返す
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        return res.json({
          weeklyReport: {
            recipient: '○○市役所　○○課長　様',
            title: '地域おこし協力隊活動報告',
          },
          monthlyReport: {
            recipient: '長沼町長　齋　藤　良　彦　様',
            sender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
            title: '長沼町地域おこし協力隊サポート業務月次報告',
            text1: '表記業務の結果について別紙のとおり報告いたします。',
            text2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
            contact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
          },
          inspection: {
            recipient: '長沼町長　齋　藤　良　彦　様',
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
      throw error;
    }

    // テンプレートが存在しない場合はデフォルト値を返す
    if (templates.length === 0) {
      return res.json({
        weeklyReport: {
          recipient: '○○市役所　○○課長　様',
          title: '地域おこし協力隊活動報告',
        },
        monthlyReport: {
          recipient: '長沼町長　齋　藤　良　彦　様',
          sender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
          title: '長沼町地域おこし協力隊サポート業務月次報告',
          text1: '表記業務の結果について別紙のとおり報告いたします。',
          text2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
          contact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
        },
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

    // 最新のテンプレートを取得
    const latest = templates[0];
    
    res.json({
      weeklyReport: {
        recipient: latest.weeklyReportRecipient || '○○市役所　○○課長　様',
        title: latest.weeklyReportTitle || '地域おこし協力隊活動報告',
      },
      monthlyReport: {
        recipient: latest.monthlyReportRecipient || '長沼町長　齋　藤　良　彦　様',
        sender: latest.monthlyReportSender || '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
        title: latest.monthlyReportTitle || '長沼町地域おこし協力隊サポート業務月次報告',
        text1: latest.monthlyReportText1 || '表記業務の結果について別紙のとおり報告いたします。',
        text2: latest.monthlyReportText2 || '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
        contact: latest.monthlyReportContact || '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
      },
      inspection: {
        recipient: latest.inspectionRecipient || '長沼町長　齋　藤　良　彦　様',
        title: latest.inspectionTitle || '復命書',
        namePrefix: latest.inspectionNamePrefix || '〇〇課　地域おこし協力隊',
        text1: latest.inspectionText1 || '次の通り復命します。',
        item1: latest.inspectionItem1 || '（参考: 視察日時を記入してください）',
        item2: latest.inspectionItem2 || '（参考: 視察先の場所を記入してください）',
        item3: latest.inspectionItem3 || '（参考: 視察の用務内容を記入してください）',
        item4: latest.inspectionItem4 || '（参考: 視察の目的を記入してください）',
        item5: latest.inspectionItem5 || '（参考: 視察の内容を記入してください）',
        item6: latest.inspectionItem6 || '（参考: 処理の経過や結果を記入してください）',
        item7: latest.inspectionItem7 || '（参考: 所感や今後の予定を記入してください）',
        item8: latest.inspectionItem8 || '（参考: その他の報告事項があれば記入してください）',
      },
    });
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({ error: 'Failed to get document templates' });
  }
});

// テンプレート設定更新（SUPPORT/MASTERのみ）
router.put('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      weeklyReport: z.object({
        recipient: z.string().optional(),
        title: z.string().optional(),
      }).optional(),
      monthlyReport: z.object({
        recipient: z.string().optional(),
        sender: z.string().optional(),
        title: z.string().optional(),
        text1: z.string().optional(),
        text2: z.string().optional(),
        contact: z.string().optional(),
      }).optional(),
      inspection: z.object({
        recipient: z.string().optional(),
        title: z.string().optional(),
        namePrefix: z.string().optional(),
        text1: z.string().optional(),
        item1: z.string().optional(),
        item2: z.string().optional(),
        item3: z.string().optional(),
        item4: z.string().optional(),
        item5: z.string().optional(),
        item6: z.string().optional(),
        item7: z.string().optional(),
        item8: z.string().optional(),
      }).optional(),
    });

    const data = schema.parse(req.body);

    // 既存のテンプレートを取得または作成
    let template = null;
    try {
      template = await prisma.documentTemplate.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      // テーブルが存在しない場合はエラーを返す
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        return res.status(500).json({ 
          error: 'DocumentTemplateテーブルが存在しません。マイグレーションを実行してください。' 
        });
      }
      throw error;
    }

    if (!template) {
      try {
        template = await prisma.documentTemplate.create({
          data: {
            templateType: 'weekly_report',
            updatedBy: req.user!.id,
          },
        });
      } catch (error: any) {
        // テーブルが存在しない場合はエラーを返す
        if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
          return res.status(500).json({ 
            error: 'DocumentTemplateテーブルが存在しません。マイグレーションを実行してください。' 
          });
        }
        throw error;
      }
    }

    // 更新
    const updated = await prisma.documentTemplate.update({
      where: { id: template.id },
      data: {
        weeklyReportRecipient: data.weeklyReport?.recipient,
        weeklyReportTitle: data.weeklyReport?.title,
        monthlyReportRecipient: data.monthlyReport?.recipient,
        monthlyReportSender: data.monthlyReport?.sender,
        monthlyReportTitle: data.monthlyReport?.title,
        monthlyReportText1: data.monthlyReport?.text1,
        monthlyReportText2: data.monthlyReport?.text2,
        monthlyReportContact: data.monthlyReport?.contact,
        inspectionRecipient: data.inspection?.recipient,
        inspectionTitle: data.inspection?.title,
        inspectionNamePrefix: data.inspection?.namePrefix,
        inspectionText1: data.inspection?.text1,
        inspectionItem1: data.inspection?.item1,
        inspectionItem2: data.inspection?.item2,
        inspectionItem3: data.inspection?.item3,
        inspectionItem4: data.inspection?.item4,
        inspectionItem5: data.inspection?.item5,
        inspectionItem6: data.inspection?.item6,
        inspectionItem7: data.inspection?.item7,
        inspectionItem8: data.inspection?.item8,
        updatedBy: req.user!.id,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update document templates error:', error);
    res.status(500).json({ error: 'Failed to update document templates' });
  }
});

export default router;

