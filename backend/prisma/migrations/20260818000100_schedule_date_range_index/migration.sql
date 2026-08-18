-- 期間検索（startDate〜endDateの範囲重なり判定）で使われるためのインデックス
CREATE INDEX "Schedule_startDate_endDate_idx" ON "Schedule"("startDate", "endDate");
