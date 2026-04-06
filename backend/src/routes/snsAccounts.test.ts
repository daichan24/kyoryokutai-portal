import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import snsAccountsRouter from './snsAccounts';
import prisma from '../lib/prisma';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/sns-accounts', snsAccountsRouter);

// Helper to create auth token
function createToken(userId: string, role: string = 'MEMBER') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

describe('SNS Account Management', () => {
  let testUserId: string;
  let testUser2Id: string;
  let authToken: string;
  let authToken2: string;
  let masterToken: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User 1',
        role: 'MEMBER',
        password: 'hashed',
      },
    });
    testUserId = user1.id;
    authToken = createToken(testUserId, 'MEMBER');

    const user2 = await prisma.user.create({
      data: {
        email: `test2-${Date.now()}@example.com`,
        name: 'Test User 2',
        role: 'MEMBER',
        password: 'hashed',
      },
    });
    testUser2Id = user2.id;
    authToken2 = createToken(testUser2Id, 'MEMBER');

    // Create master token
    const master = await prisma.user.create({
      data: {
        email: `master-${Date.now()}@example.com`,
        name: 'Master User',
        role: 'MASTER',
        password: 'hashed',
      },
    });
    masterToken = createToken(master.id, 'MASTER');
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.sNSAccount.deleteMany({ where: { userId: { in: [testUserId, testUser2Id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testUserId, testUser2Id] } } });
    await prisma.user.deleteMany({ where: { role: 'MASTER', email: { startsWith: 'master-' } } });
  });

  describe('5.1 デフォルトアカウント設定のテスト', () => {
    test('should automatically set first account as default', async () => {
      const response = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'instagram',
          accountName: '@testuser',
        });

      expect(response.status).toBe(201);
      expect(response.body.isDefault).toBe(true);
    });

    test('should set new account as default and unset others when isDefault=true', async () => {
      // Create first account (auto default)
      const account1 = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'instagram',
          accountName: '@testuser1',
        });

      expect(account1.body.isDefault).toBe(true);

      // Create second account with isDefault=true
      const account2 = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'twitter',
          accountName: '@testuser2',
          isDefault: true,
        });

      expect(account2.status).toBe(201);
      expect(account2.body.isDefault).toBe(true);

      // Check that first account is no longer default
      const accounts = await request(app)
        .get('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`);

      const acc1 = accounts.body.find((a: any) => a.id === account1.body.id);
      const acc2 = accounts.body.find((a: any) => a.id === account2.body.id);

      expect(acc1.isDefault).toBe(false);
      expect(acc2.isDefault).toBe(true);
    });

    test('should maintain only one default account per user', async () => {
      // Create 3 accounts
      await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'instagram', accountName: '@user1' });

      await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter', accountName: '@user2' });

      const account3 = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'tiktok', accountName: '@user3', isDefault: true });

      // Get all accounts
      const accounts = await request(app)
        .get('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`);

      // Count default accounts
      const defaultAccounts = accounts.body.filter((a: any) => a.isDefault);
      expect(defaultAccounts.length).toBe(1);
      expect(defaultAccounts[0].id).toBe(account3.body.id);
    });

    test('should update existing account to default and unset others', async () => {
      // Create 2 accounts
      const account1 = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'instagram', accountName: '@user1' });

      const account2 = await request(app)
        .post('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'twitter', accountName: '@user2' });

      // Update account2 to be default
      await request(app)
        .put(`/api/sns-accounts/${account2.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isDefault: true });

      // Check accounts
      const accounts = await request(app)
        .get('/api/sns-accounts')
        .set('Authorization', `Bearer ${authToken}`);

      const acc1 = accounts.body.find((a: any) => a.id === account1.body.id);
      const acc2 = accounts.body.find((a: any) => a.id === account2.body.id);

      expect(acc1.isDefault).toBe(false);
      expect(acc2.isDefault).toBe(true);
    });
  });

  describe('5.2 アカウント作成・更新・削除のテスト', () => {
    describe('正常系フロー', () => {
      test('should create account with all fields', async () => {
        const response = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            platform: 'instagram',
            accountName: '@testuser',
            displayName: 'Test User Display',
            url: 'https://instagram.com/testuser',
            isDefault: false,
          });

        expect(response.status).toBe(201);
        expect(response.body.platform).toBe('instagram');
        expect(response.body.accountName).toBe('@testuser');
        expect(response.body.displayName).toBe('Test User Display');
        expect(response.body.url).toBe('https://instagram.com/testuser');
        expect(response.body.userId).toBe(testUserId);
      });

      test('should create account with minimal fields', async () => {
        const response = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            platform: 'twitter',
            accountName: '@minimal',
          });

        expect(response.status).toBe(201);
        expect(response.body.platform).toBe('twitter');
        expect(response.body.accountName).toBe('@minimal');
        expect(response.body.displayName).toBeNull();
        expect(response.body.url).toBeNull();
      });

      test('should update account fields', async () => {
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@original' });

        const updated = await request(app)
          .put(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            accountName: '@updated',
            displayName: 'Updated Name',
          });

        expect(updated.status).toBe(200);
        expect(updated.body.accountName).toBe('@updated');
        expect(updated.body.displayName).toBe('Updated Name');
        expect(updated.body.platform).toBe('instagram'); // unchanged
      });

      test('should delete account', async () => {
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@todelete' });

        const deleteResponse = await request(app)
          .delete(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.message).toBe('削除しました');

        // Verify deletion
        const getResponse = await request(app)
          .get('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`);

        const found = getResponse.body.find((a: any) => a.id === account.body.id);
        expect(found).toBeUndefined();
      });
    });

    describe('権限チェック（自分のアカウントのみ操作可能）', () => {
      test('should not allow updating another user account (MEMBER)', async () => {
        // User 1 creates account
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@user1' });

        // User 2 tries to update it
        const response = await request(app)
          .put(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${authToken2}`)
          .send({ accountName: '@hacked' });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('権限がありません');
      });

      test('should not allow deleting another user account (MEMBER)', async () => {
        // User 1 creates account
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@user1' });

        // User 2 tries to delete it
        const response = await request(app)
          .delete(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${authToken2}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('権限がありません');
      });

      test('should allow MASTER to update any account', async () => {
        // User 1 creates account
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@user1' });

        // Master updates it
        const response = await request(app)
          .put(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${masterToken}`)
          .send({ accountName: '@updated_by_master' });

        expect(response.status).toBe(200);
        expect(response.body.accountName).toBe('@updated_by_master');
      });

      test('should allow MASTER to delete any account', async () => {
        // User 1 creates account
        const account = await request(app)
          .post('/api/sns-accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ platform: 'instagram', accountName: '@user1' });

        // Master deletes it
        const response = await request(app)
          .delete(`/api/sns-accounts/${account.body.id}`)
          .set('Authorization', `Bearer ${masterToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('削除しました');
      });

      test('should return 404 when updating non-existent account', async () => {
        const response = await request(app)
          .put('/api/sns-accounts/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ accountName: '@test' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('見つかりません');
      });

      test('should return 404 when deleting non-existent account', async () => {
        const response = await request(app)
          .delete('/api/sns-accounts/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('見つかりません');
      });
    });
  });
});
