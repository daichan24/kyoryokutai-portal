import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users/login-hints
 * 開発環境でのみログイン用のテストアカウント一覧を返す
 * 認証不要、ただし本番環境では403を返す
 * 
 * 注意: このエンドポイントは router.use(authenticate) の前に配置されているため認証不要
 */
router.get('/login-hints', async (req, res) => {
  try {
    // 全ユーザーを取得（name, email, roleのみ）
    const users = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        role: true,
      },
      orderBy: [
        { role: 'asc' }, // roleでソート
        { name: 'asc' }, // 同じrole内では名前でソート
      ],
    });

    // 固定パスワード（開発用の表示のみ）
    // マスターの情報は伏せる
    const loginHints = users.map((user) => {
      if (user.role === 'MASTER') {
        return {
          name: '***',
          email: '***',
          role: user.role,
          password: '***',
        };
      }
      return {
        name: user.name,
        email: user.email,
        role: user.role,
        password: 'password123', // 固定表示（実際のDBには平文保存していない）
      };
    });

    res.setHeader('Cache-Control', 'private, max-age=120');
    res.json(loginHints);
  } catch (error) {
    console.error('Get login hints error:', error);
    res.status(500).json({ error: 'Failed to get login hints' });
  }
});

// 認証が必要なルート（この後のルートはすべて認証が必要）
router.use(authenticate);

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['MASTER', 'MEMBER', 'SUPPORT', 'GOVERNMENT']).optional(),
  missionType: z.enum(['FREE', 'MISSION']).optional(),
  department: z.string().optional(),
  termStart: z.string().optional(),
  termEnd: z.string().optional(),
  avatarColor: z.string().optional(),
  displayOrder: z.number().int().optional(), // 表示順（メンバー以外が設定可能）
});

router.get('/', authorize('MASTER', 'MEMBER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const { role } = req.query;
    const where: any = {};
    
    // 認可ルール: MASTER以外はMASTERユーザーを除外
    if (req.user!.role !== 'MASTER') {
      where.role = { not: 'MASTER' };
    }

    // roleフィルター（認可ルールより優先されるが、MASTER除外は維持）
    if (role && typeof role === 'string') {
      // MASTER以外のユーザーがMASTERをフィルターしようとした場合は無視
      if (req.user!.role !== 'MASTER' && role === 'MASTER') {
        // MASTER以外はMASTERを取得できないため、空配列を返す
        return res.json([]);
      }
      // roleフィルターを適用（MASTER除外条件を上書き）
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
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
        avatarLetter: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    console.log(`🔵 [API] GET /api/users - Role: ${req.user!.role}, Filter: ${role || 'all'}, Count: ${users.length}`);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'MASTER' && req.user!.role !== 'SUPPORT' && req.user!.id !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
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
        avatarLetter: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // displayOrderの更新はメンバー以外のみ可能
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // displayOrderの更新権限チェック
    if (req.body.displayOrder !== undefined) {
      if (req.user!.role === 'MEMBER') {
        return res.status(403).json({ error: 'メンバーは表示順を変更できません' });
      }
      // メンバー以外のユーザーのdisplayOrderは変更できない
      if (targetUser.role !== 'MEMBER') {
        return res.status(403).json({ error: 'メンバー以外の表示順は変更できません' });
      }
    }

    // その他の更新権限チェック
    if (req.user!.role !== 'MASTER' && req.user!.id !== id) {
      // displayOrder以外の更新は本人またはMASTERのみ
      if (req.body.displayOrder === undefined) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const data = updateUserSchema.parse(req.body);

    const updateData: any = { ...data };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    if (data.termStart) {
      updateData.termStart = new Date(data.termStart);
    }

    if (data.termEnd) {
      updateData.termEnd = new Date(data.termEnd);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', authorize('MASTER'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
