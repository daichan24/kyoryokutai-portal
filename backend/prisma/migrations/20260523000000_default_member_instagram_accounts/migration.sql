-- Backfill the default Instagram account for every member.
-- Members are expected to have one Instagram account from the start of employment.
INSERT INTO "SNSAccount" (
  "id",
  "userId",
  "platform",
  "accountName",
  "displayName",
  "url",
  "isDefault",
  "createdAt",
  "updatedAt"
)
SELECT
  'default-instagram-' || u."id",
  u."id",
  'instagram',
  'instagram',
  'Instagram',
  NULL,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1
    FROM "SNSAccount" a
    WHERE a."userId" = u."id"
  );
