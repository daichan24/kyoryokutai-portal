UPDATE "Schedule"
SET
  "startTime" = lpad(split_part("startTime", ':', 1), 2, '0') || ':' || split_part("startTime", ':', 2),
  "updatedAt" = "updatedAt"
WHERE "startTime" ~ '^[0-9]{1}:[0-9]{2}$';

UPDATE "Schedule"
SET
  "endTime" = lpad(split_part("endTime", ':', 1), 2, '0') || ':' || split_part("endTime", ':', 2),
  "updatedAt" = "updatedAt"
WHERE "endTime" ~ '^[0-9]{1}:[0-9]{2}$';
