import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
// UIイベント → API → DB の流れを明確にするため、ここでデータ構造を定義
const citizenSchema = z.object({
  name: z.string().min(1, '氏名は必須です'),
  organization: z.string().optional(),
  category: z.string().optional(), // ジャンル
  relatedMembers: z.array(z.string()).default([]), // 関わった協力隊
  relationshipType: z.enum(['協力的', '要注意', '未知', '未登録']).optional(), // 関わり方
  memo: z.string().optional(), // 備考
  role: z.enum(['現役', 'OB', 'サポート', '役場']).optional(),
  startYear: z.number().int().min(2000).max(2100).optional(),
  endYear: z.number().int().min(2000).max(2100).optional(),
  tags: z.array(z.string()).default([]),
});

/**
 * 【API定義】町民（協力隊メンバー）追加
 * 
 * 役割: フロントエンドからのPOSTリクエストを受け取り、DBに保存する
 * エンドポイント: POST /api/citizens
 * 
 * データフロー:
 * 1. フロントエンドのonClick → handleSubmit → api.post('/api/citizens', data)
 * 2. このAPIがリクエストを受け取る
 * 3. バリデーション（zod）でデータを検証
 * 4. PrismaでDBに保存
 * 5. 成功時は200 + JSON、失敗時は400を返す
 */
router.post('/', async (req: AuthRequest, res) => {
  // DB接続先の確認（host/db部分のみ）
  const dbUrl = process.env.DATABASE_URL || '';
  const dbHostDb = dbUrl.split('@')[1]?.split('?')[0] || 'N/A';
  console.log('🔵 [API] POST /api/citizens - DB_URL_HOST_DB:', dbHostDb);
  
  console.log('🔵 [API] POST /api/citizens リクエスト受信');
  console.log('🔵 [API] リクエストボディ:', req.body);

  try {
    // DB実体確認: 生SQLで現在のDB名とrole列の存在を確認
    try {
      const dbNameResult = await prisma.$queryRaw<Array<{ db: string }>>`
        SELECT current_database() as db;
      `;
      console.log('🔵 [API] Current Database:', dbNameResult[0]?.db || 'N/A');

      const roleColumnResult = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name='Contact' AND column_name='role';
      `;
      const roleColumnExists = roleColumnResult.length > 0;
      console.log('🔵 [API] Contact.role column exists:', roleColumnExists, `(${roleColumnResult.length} row(s))`);
    } catch (sqlError) {
      console.error('⚠️ [API] SQL check error:', sqlError);
    }

    // バリデーション（データの形式チェック）
    const data = citizenSchema.parse(req.body);
    console.log('✅ [API] バリデーション成功:', data);

    // DBアクセス: Prismaを使ってContactテーブルに保存
    const contact = await prisma.contact.create({
      data: {
        createdBy: req.user!.id, // ログインユーザーID
        name: data.name,
        organization: data.organization || null,
        category: data.category || null, // ジャンル
        relatedMembers: data.relatedMembers || [], // 関わった協力隊
        relationshipType: data.relationshipType || null, // 関わり方
        memo: data.memo || null, // 備考
        tags: data.tags || [],
        role: data.role || null,
        startYear: data.startYear || null,
        endYear: data.endYear || null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    console.log('✅ [API] DB保存成功。作成されたID:', contact.id);

    // 成功時: status 200 + JSONを返す
    res.status(200).json(contact);
  } catch (error) {
    console.error('❌ [API] エラー発生:', error);

    // バリデーションエラーの場合
    if (error instanceof z.ZodError) {
      console.log('❌ [API] バリデーションエラー:', error.errors);
      return res.status(400).json({ 
        error: 'バリデーションエラー',
        details: error.errors 
      });
    }

    // その他のエラー
    console.error('❌ [API] 予期しないエラー:', error);
    res.status(500).json({ error: '町民情報の保存に失敗しました' });
  }
});

/**
 * 【API定義】町民一覧取得
 * 
 * 役割: 登録されている町民情報を一覧で取得
 * エンドポイント: GET /api/citizens
 * 
 * データフロー:
 * 1. フロントエンドのuseQuery → api.get('/api/citizens')
 * 2. このAPIがリクエストを受け取る
 * 3. PrismaでDBからデータを取得
 * 4. ステータス（在籍中/任期終了）を計算して返す
 */
router.get('/', async (req: AuthRequest, res) => {
  // DB接続先の確認（host/db部分のみ）
  const dbUrl = process.env.DATABASE_URL || '';
  const dbHostDb = dbUrl.split('@')[1]?.split('?')[0] || 'N/A';
  console.log('🔵 [API] GET /api/citizens - DB_URL_HOST_DB:', dbHostDb);
  
  console.log('🔵 [API] GET /api/citizens リクエスト受信');

  try {
    // DB実体確認: 生SQLで現在のDB名とrole列の存在を確認
    try {
      const dbNameResult = await prisma.$queryRaw<Array<{ db: string }>>`
        SELECT current_database() as db;
      `;
      console.log('🔵 [API] Current Database:', dbNameResult[0]?.db || 'N/A');

      const roleColumnResult = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name='Contact' AND column_name='role';
      `;
      const roleColumnExists = roleColumnResult.length > 0;
      console.log('🔵 [API] Contact.role column exists:', roleColumnExists, `(${roleColumnResult.length} row(s))`);
    } catch (sqlError) {
      console.error('⚠️ [API] SQL check error:', sqlError);
    }

    // DBアクセス: Prismaを使ってContactテーブルから取得
    const contacts = await prisma.contact.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        histories: {
          take: 3,
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ [API] ${contacts.length}件の町民情報を取得`);

    // ステータス（在籍中/任期終了）を計算して追加
    const contactsWithStatus = contacts.map(contact => {
      let status = '在籍中';
      
      if (contact.endYear) {
        const currentYear = new Date().getFullYear();
        if (currentYear > contact.endYear) {
          status = '任期終了';
        }
      }

      return {
        ...contact,
        status, // 計算されたステータスを追加
      };
    });

    // 成功時: status 200 + JSONを返す
    res.status(200).json(contactsWithStatus);
  } catch (error) {
    console.error('❌ [API] エラー発生:', error);
    res.status(500).json({ error: '町民情報の取得に失敗しました' });
  }
});

/**
 * 【API定義】町民（協力隊メンバー）更新
 * 
 * 役割: フロントエンドからのPUTリクエストを受け取り、DBを更新する
 * エンドポイント: PUT /api/citizens/:id
 */
router.put('/:id', async (req: AuthRequest, res) => {
  console.log(`🔵 [API] PUT /api/citizens/${req.params.id} リクエスト受信`);
  console.log('🔵 [API] リクエストボディ:', req.body);

  try {
    // バリデーション（データの形式チェック）
    const data = citizenSchema.parse(req.body);
    console.log('✅ [API] バリデーション成功:', data);

    // DBアクセス: Prismaを使ってContactテーブルを更新
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        organization: data.organization || null,
        category: data.category || null, // ジャンル
        relatedMembers: data.relatedMembers || [], // 関わった協力隊
        relationshipType: data.relationshipType || null, // 関わり方
        memo: data.memo || null, // 備考
        tags: data.tags || [],
        role: data.role || null,
        startYear: data.startYear || null,
        endYear: data.endYear || null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });

    console.log('✅ [API] DB更新成功。更新されたID:', contact.id);

    // 成功時: status 200 + JSONを返す
    res.status(200).json(contact);
  } catch (error) {
    console.error('❌ [API] エラー発生:', error);

    // バリデーションエラーの場合
    if (error instanceof z.ZodError) {
      console.log('❌ [API] バリデーションエラー:', error.errors);
      return res.status(400).json({ 
        error: 'バリデーションエラー',
        details: error.errors 
      });
    }

    // その他のエラー
    console.error('❌ [API] 予期しないエラー:', error);
    res.status(500).json({ error: '町民情報の更新に失敗しました' });
  }
});

export default router;

