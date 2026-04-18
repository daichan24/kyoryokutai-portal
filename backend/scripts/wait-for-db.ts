#!/usr/bin/env tsx
/**
 * DB接続確認スクリプト
 * 
 * Prisma migrate deploy 実行前にDB接続を確認し、
 * 接続が確立されるまで待機する。
 * 
 * Render Free Tierでは非アクティブ時にDBが停止するため、
 * 起動時に接続が確立されるまで時間がかかる場合がある。
 */

import { PrismaClient } from '@prisma/client';

const MAX_RETRIES = 30; // 最大リトライ回数
const RETRY_INTERVAL = 2000; // リトライ間隔（ミリ秒）

async function waitForDatabase() {
  const prisma = new PrismaClient();
  let retries = 0;

  console.log('🔍 [DB] Checking database connection...');

  while (retries < MAX_RETRIES) {
    try {
      // 簡単なクエリでDB接続を確認
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ [DB] Database connection established!');
      await prisma.$disconnect();
      process.exit(0);
    } catch (error: any) {
      retries++;
      console.log(`⏳ [DB] Connection attempt ${retries}/${MAX_RETRIES} failed: ${error.message}`);
      
      if (retries >= MAX_RETRIES) {
        console.error('❌ [DB] Failed to connect to database after maximum retries');
        await prisma.$disconnect();
        process.exit(1);
      }

      // 次のリトライまで待機
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }
  }
}

waitForDatabase();
