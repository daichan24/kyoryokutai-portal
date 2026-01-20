import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// すべてのルートで認証が必要
router.use(authenticate);

// ユーザー作成スキーマ
const createUserSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
  role: z.enum(['MASTER', 'MEMBER', 'SUPPORT', 'GOVERNMENT'], {
    errorMap: () => ({ message: '役割はMASTER/MEMBER/SUPPORT/GOVERNMENTのいずれかです' }),
  }),
  missionType: z.enum(['FREE', 'MISSION']).optional(),
  department: z.string().optional(),
  termStart: z.string().optional(),
  termEnd: z.string().optional(),
  avatarColor: z.string().optional(),
});

/**
 * POST /api/admin/users
 * 管理者（MASTER / SUPPORT）のみがユーザーを作成できる
 */
router.post('/users', authorize('MASTER', 'SUPPORT'), async (req: AuthRequest, res) => {
  try {
    console.log('🔵 [API] POST /api/admin/users リクエスト受信');
    console.log('🔵 [API] リクエストユーザー:', req.user?.email, req.user?.role);

    // バリデーション
    const data = createUserSchema.parse(req.body);
    console.log('✅ [API] バリデーション成功');

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      console.log('❌ [API] メールアドレス重複:', data.email);
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        missionType: data.missionType,
        department: data.department,
        termStart: data.termStart ? new Date(data.termStart) : null,
        termEnd: data.termEnd ? new Date(data.termEnd) : null,
        avatarColor: data.avatarColor || '#3B82F6',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        missionType: true,
        department: true,
        termStart: true,
        termEnd: true,
        avatarColor: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('✅ [API] ユーザー作成成功:', user.email);

    res.status(201).json(user);
  } catch (error) {
    console.error('❌ [API] エラー発生:', error);

    // バリデーションエラー
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: '入力内容に誤りがあります',
        details: error.errors,
      });
    }

    // その他のエラー
    res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
  }
});

/**
 * POST /api/admin/update-member-sato-name
 * メンバーの「佐藤大地」を「さとうだいち」に更新（MASTERのみ）
 */
router.post('/update-member-sato-name', authorize('MASTER'), async (req: AuthRequest, res) => {
  try {
    console.log('🔄 [API] Updating member 佐藤大地 to さとうだいち...');

    // メンバーで「佐藤大地」という名前のユーザーを検索
    const memberSato = await prisma.user.findFirst({
      where: {
        role: 'MEMBER',
        name: '佐藤大地',
      },
    });

    if (memberSato) {
      await prisma.user.update({
        where: { id: memberSato.id },
        data: { name: 'さとうだいち' },
      });
      console.log(`✅ [API] Updated user ${memberSato.email} from 佐藤大地 to さとうだいち`);
      return res.json({ 
        success: true, 
        message: `ユーザー ${memberSato.email} の名前を「佐藤大地」から「さとうだいち」に更新しました`,
        updatedUser: {
          id: memberSato.id,
          email: memberSato.email,
          oldName: '佐藤大地',
          newName: 'さとうだいち',
        }
      });
    } else {
      console.log('ℹ️ [API] No member with name 佐藤大地 found');
      
      // 念のため、メンバーで「さとうだいち」が存在するか確認
      const memberSatoHiragana = await prisma.user.findFirst({
        where: {
          role: 'MEMBER',
          name: 'さとうだいち',
        },
      });

      if (memberSatoHiragana) {
        return res.json({ 
          success: true, 
          message: 'メンバー「さとうだいち」は既に存在しています',
          existingUser: {
            id: memberSatoHiragana.id,
            email: memberSatoHiragana.email,
            name: memberSatoHiragana.name,
          }
        });
      } else {
        return res.json({ 
          success: false, 
          message: 'メンバー「佐藤大地」は見つかりませんでした。seed.tsを実行してメンバー「さとうだいち」を作成してください。'
        });
      }
    }
  } catch (error) {
    console.error('❌ [API] Error updating member name:', error);
    res.status(500).json({ 
      error: 'メンバー名の更新に失敗しました',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

