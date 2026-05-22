-- Backfill schedules created from tasks where the task has a project but
-- the linked schedule was left without projectId.
UPDATE "Schedule" s
SET "projectId" = t."projectId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Task" t
WHERE s."taskId" = t."id"
  AND s."projectId" IS NULL
  AND t."projectId" IS NOT NULL;
