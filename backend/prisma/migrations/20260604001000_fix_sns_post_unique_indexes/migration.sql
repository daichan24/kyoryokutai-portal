-- SNS posts must be unique per user/week/post type/account.
-- Older deployments kept userId+week or userId+week+postType unique indexes,
-- which blocks members from saving both STORY and FEED in the same week.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "week", "postType", COALESCE("accountId", '')
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "SNSPost"
)
DELETE FROM "SNSPost" p
USING ranked r
WHERE p."id" = r."id"
  AND r.rn > 1;

DROP INDEX IF EXISTS "SNSPost_userId_week_key";
DROP INDEX IF EXISTS "SNSPost_userId_week_postType_key";
DROP INDEX IF EXISTS "userId_week_postType_accountId";
DROP INDEX IF EXISTS "SNSPost_userId_week_postType_accountId";

CREATE UNIQUE INDEX "SNSPost_userId_week_postType_accountId"
ON "SNSPost" ("userId", "week", "postType", COALESCE("accountId", ''));
