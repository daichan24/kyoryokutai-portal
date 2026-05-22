-- Ensure the default work buckets are real mission/project records for every member.
INSERT INTO "Mission" (
  "id", "userId", "missionName", "missionType", "targetPercentage",
  "approvalStatus", "order", "startDate", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, u."id", '協力隊業務', 'PRIMARY', 100,
  'DRAFT', 0, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1 FROM "Mission" m
    WHERE m."userId" = u."id" AND m."missionName" = '協力隊業務'
  );

INSERT INTO "Mission" (
  "id", "userId", "missionName", "missionType", "targetPercentage",
  "approvalStatus", "order", "startDate", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, u."id", '役場業務', 'SUB', 100,
  'DRAFT', 1, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1 FROM "Mission" m
    WHERE m."userId" = u."id" AND m."missionName" = '役場業務'
  );

INSERT INTO "Project" (
  "id", "userId", "projectName", "phase", "missionId", "themeColor",
  "approvalStatus", "tags", "relatedContactIds", "order", "startDate", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, u."id", '協力隊業務', 'EXECUTION', m."id", '#3B82F6',
  'DRAFT', ARRAY[]::text[], ARRAY[]::text[], 0, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
JOIN "Mission" m ON m."userId" = u."id" AND m."missionName" = '協力隊業務'
WHERE u."role" = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."userId" = u."id" AND p."projectName" = '協力隊業務'
  );

INSERT INTO "Project" (
  "id", "userId", "projectName", "phase", "missionId", "themeColor",
  "approvalStatus", "tags", "relatedContactIds", "order", "startDate", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, u."id", '役場業務', 'EXECUTION', m."id", '#10B981',
  'DRAFT', ARRAY[]::text[], ARRAY[]::text[], 1, CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
JOIN "Mission" m ON m."userId" = u."id" AND m."missionName" = '役場業務'
WHERE u."role" = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."userId" = u."id" AND p."projectName" = '役場業務'
  );

UPDATE "Project" p
SET "missionId" = m."id", "updatedAt" = CURRENT_TIMESTAMP
FROM "Mission" m
WHERE p."userId" = m."userId"
  AND p."projectName" = m."missionName"
  AND p."projectName" IN ('協力隊業務', '役場業務')
  AND p."missionId" IS DISTINCT FROM m."id";

UPDATE "Task" t
SET "missionId" = m."id",
    "projectId" = p."id",
    "linkKind" = 'PROJECT',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Mission" old_m
JOIN "Mission" m ON m."userId" = old_m."userId" AND m."missionName" = '協力隊業務'
JOIN "Project" p ON p."userId" = old_m."userId" AND p."projectName" = '協力隊業務'
WHERE t."missionId" = old_m."id"
  AND t."projectId" IS NULL
  AND t."linkKind" = 'KYORYOKUTAI_WORK';

UPDATE "Task" t
SET "missionId" = m."id",
    "projectId" = p."id",
    "linkKind" = 'PROJECT',
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Mission" old_m
JOIN "Mission" m ON m."userId" = old_m."userId" AND m."missionName" = '役場業務'
JOIN "Project" p ON p."userId" = old_m."userId" AND p."projectName" = '役場業務'
WHERE t."missionId" = old_m."id"
  AND t."projectId" IS NULL
  AND t."linkKind" = 'YAKUBA_WORK';

UPDATE "Schedule" s
SET "projectId" = t."projectId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Task" t
WHERE s."taskId" = t."id"
  AND s."projectId" IS DISTINCT FROM t."projectId"
  AND t."projectId" IS NOT NULL;
