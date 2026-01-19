import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['MASTER', 'MEMBER', 'SUPPORT', 'GOVERNMENT']).optional(),
  missionType: z.enum(['FREE', 'MISSION']).optional(),
  department: z.string().optional(),
  termStart: z.string().optional(),
  termEnd: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role || 'MEMBER',
        missionType: data.missionType,
        department: data.department,
        termStart: data.termStart ? new Date(data.termStart) : null,
        termEnd: data.termEnd ? new Date(data.termEnd) : null,
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
        avatarLetter: true,
        darkMode: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // 存在するフィールドのみを明示的に指定して取得（wishesEnabledとdisplayOrderは除外）
    let user: any;
    try {
      user = await prisma.user.findUnique({
        where: { email: data.email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: true,
          missionType: true,
          department: true,
          termStart: true,
          termEnd: true,
          avatarColor: true,
          avatarLetter: true,
          darkMode: true,
          createdAt: true,
        },
      });
    } catch (dbError: any) {
      // P2022エラー（カラムが存在しない）の場合、生SQLで取得を試みる
      if (dbError.code === 'P2022') {
        console.warn('Column does not exist, trying alternative query:', dbError.meta);
        // 基本的なフィールドのみで取得を試みる
        const result = await prisma.$queryRaw`
          SELECT id, name, email, password, role, "missionType", department, "termStart", "termEnd", 
                 "avatarColor", "avatarLetter", "darkMode", "createdAt"
          FROM "User"
          WHERE email = ${data.email}
        `;
        user = Array.isArray(result) && result.length > 0 ? result[0] : null;
      } else {
        throw dbError;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    // displayOrderとwishesEnabledは常にデフォルト値を設定（データベースに存在しない場合でも）
    const userResponse: any = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      missionType: user.missionType,
      department: user.department,
      termStart: user.termStart,
      termEnd: user.termEnd,
      avatarColor: user.avatarColor,
      avatarLetter: user.avatarLetter,
      darkMode: user.darkMode,
      displayOrder: 0, // デフォルト値
      wishesEnabled: true, // デフォルト値
      createdAt: user.createdAt,
    };

    res.json({ user: userResponse, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Login error details:', { errorMessage, errorStack, errorName: error instanceof Error ? error.name : 'Unknown' });
    res.status(500).json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    // 存在するフィールドのみを明示的に指定して取得（wishesEnabledとdisplayOrderは除外）
    let user: any;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user!.id },
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
          darkMode: true,
          snsLinks: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (dbError: any) {
      // P2022エラー（カラムが存在しない）の場合、生SQLで取得を試みる
      if (dbError.code === 'P2022') {
        console.warn('Column does not exist, trying alternative query:', dbError.meta);
        // 基本的なフィールドのみで取得を試みる
        const result = await prisma.$queryRaw`
          SELECT id, name, email, role, "missionType", department, "termStart", "termEnd", 
                 "avatarColor", "avatarLetter", "darkMode", "snsLinks", "createdAt", "updatedAt"
          FROM "User"
          WHERE id = ${req.user!.id}
        `;
        user = Array.isArray(result) && result.length > 0 ? result[0] : null;
      } else {
        throw dbError;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // displayOrderとwishesEnabledは常にデフォルト値を設定（データベースに存在しない場合でも）
    const userResponse: any = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      missionType: user.missionType,
      department: user.department,
      termStart: user.termStart,
      termEnd: user.termEnd,
      avatarColor: user.avatarColor,
      avatarLetter: user.avatarLetter,
      darkMode: user.darkMode,
      displayOrder: 0, // デフォルト値
      wishesEnabled: true, // デフォルト値
      snsLinks: user.snsLinks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json(userResponse);
  } catch (error) {
    console.error('Get me error:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Get me error details:', { errorMessage, errorStack, errorName: error instanceof Error ? error.name : 'Unknown' });
    res.status(500).json({ 
      error: 'Failed to get user',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

export default router;
