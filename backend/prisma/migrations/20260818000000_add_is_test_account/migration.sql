ALTER TABLE "User" ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false;

-- 既存のテスト用メンバー（さとうだいち）を isTestAccount=true に移行
UPDATE "User" SET "isTestAccount" = true WHERE "name" = 'さとうだいち' AND "role" = 'MEMBER';
